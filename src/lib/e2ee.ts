// End-to-End Encryption v2 untuk Chat TSG
//
// Desain:
//  - Tiap pengguna punya identitas ECDH P-256. Kunci privat TIDAK pernah meninggalkan
//    perangkat dalam bentuk terbuka: disimpan di IndexedDB sebagai CryptoKey non-extractable.
//  - Cadangan kunci privat disimpan di server HANYA dalam bentuk terenkripsi (PBKDF2-SHA256
//    600k iterasi -> AES-256-GCM) dengan kata sandi enkripsi chat yang hanya diketahui pengguna.
//  - Kunci pesan = ECDH(kunci privat sendiri, kunci publik lawan bicara) -> HKDF-SHA256 -> AES-256-GCM.
//    Server hanya melihat kunci publik dan ciphertext; tidak bisa membaca pesan.
//  - AAD mengikat ciphertext ke pengirim & penerima sehingga tidak bisa dipindah/dipalsukan.
//  - Fingerprint + pinning (TOFU) di klien untuk mendeteksi penggantian kunci lawan bicara.
//  - Tidak ada fallback plaintext: bila enkripsi gagal, pengiriman dibatalkan.

export const VIRTUAL_ID = "00000000-0000-0000-0000-000000000001";
export const LOCKED_PLACEHOLDER = "🔒 [Pesan Terenkripsi Tidak Dapat Didekripsi]";
export const PBKDF2_ITERATIONS = 600000;

export type PublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

export type ChatKeyRecord = {
  publicKey: PublicJwk;
  wrappedPrivateKey: string; // base64(iv[12] || ciphertext)
  kdfSalt: string; // base64
  kdfIterations: number;
  keyVersion: number;
};

export type LocalIdentity = {
  userId: string;
  privateKey: CryptoKey;
  publicJwk: PublicJwk;
  keyVersion: number;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------------- helpers ---------------- */

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pubOnly(jwk: any): PublicJwk {
  return { kty: "EC", crv: "P-256", x: String(jwk.x), y: String(jwk.y) };
}

/* ---------------- IndexedDB (kunci lokal) ---------------- */

const DB_NAME = "tsg-e2ee";
const STORE = "identity";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve((r.result as T) ?? null);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const idKey = (userId: string) => `identity:${userId}`;

export async function getLocalIdentity(userId: string): Promise<LocalIdentity | null> {
  try {
    return await idbGet<LocalIdentity>(idKey(userId));
  } catch {
    return null;
  }
}

export async function clearLocalIdentity(userId: string): Promise<void> {
  try {
    await idbDelete(idKey(userId));
  } catch {}
  keyCache.clear();
}

async function storeIdentity(
  userId: string,
  pkcs8: ArrayBuffer,
  publicJwk: PublicJwk,
  keyVersion: number
): Promise<void> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDH", namedCurve: "P-256" },
    false, // non-extractable
    ["deriveBits"]
  );
  const identity: LocalIdentity = { userId, privateKey, publicJwk, keyVersion };
  await idbSet(idKey(userId), identity);
  keyCache.clear();
}

/* ---------------- pembungkus kunci privat (kata sandi) ---------------- */

async function deriveWrapKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const wrapAad = (userId: string, keyVersion: number) => enc.encode(`tsg-e2ee-wrap|${userId}|${keyVersion}`);

/**
 * Membuat identitas baru. Kembalikan record untuk dipublikasikan ke server dan fungsi commit()
 * yang menyimpan kunci privat (non-extractable) di perangkat setelah publikasi berhasil.
 */
export async function createIdentity(
  userId: string,
  passphrase: string,
  keyVersion: number
): Promise<{ record: ChatKeyRecord; commit: () => Promise<void> }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicJwk = pubOnly(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await deriveWrapKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: wrapAad(userId, keyVersion) },
      wrapKey,
      pkcs8
    )
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv, 0);
  blob.set(ct, iv.length);

  const record: ChatKeyRecord = {
    publicKey: publicJwk,
    wrappedPrivateKey: bytesToB64(blob),
    kdfSalt: bytesToB64(salt),
    kdfIterations: PBKDF2_ITERATIONS,
    keyVersion,
  };
  return { record, commit: () => storeIdentity(userId, pkcs8, publicJwk, keyVersion) };
}

/** Membuka cadangan kunci dari server dengan kata sandi, lalu simpan non-extractable di perangkat. */
export async function unlockIdentity(userId: string, passphrase: string, record: ChatKeyRecord): Promise<boolean> {
  try {
    const blob = b64ToBytes(record.wrappedPrivateKey);
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const wrapKey = await deriveWrapKey(passphrase, b64ToBytes(record.kdfSalt), record.kdfIterations);
    const pkcs8 = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: wrapAad(userId, record.keyVersion) },
      wrapKey,
      ct
    );
    await storeIdentity(userId, pkcs8, pubOnly(record.publicKey), record.keyVersion);
    return true;
  } catch {
    return false; // kata sandi salah atau data rusak
  }
}

export function localMatchesRecord(local: LocalIdentity | null, record: ChatKeyRecord): boolean {
  return (
    !!local &&
    local.keyVersion === record.keyVersion &&
    local.publicJwk.x === record.publicKey.x &&
    local.publicJwk.y === record.publicKey.y
  );
}

/* ---------------- fingerprint, safety number, pinning ---------------- */

export async function fingerprintOf(jwk: PublicJwk): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(`${jwk.x}.${jwk.y}`));
  return toHex(d).toUpperCase();
}

export async function safetyNumber(fpA: string, fpB: string): Promise<string> {
  const joined = [fpA, fpB].sort().join("|");
  const d = new DataView(await crypto.subtle.digest("SHA-256", enc.encode(joined)));
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) groups.push(String(d.getUint32(i * 4) % 100000).padStart(5, "0"));
  return groups.join(" ");
}

const pinsKey = (myId: string) => `tsg_e2ee_pins_${myId}`;

function readPins(myId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(pinsKey(myId)) || "{}");
  } catch {
    return {};
  }
}

export function checkPeerPin(myId: string, peerId: string, fp: string): "new" | "same" | "changed" {
  const pinned = readPins(myId)[peerId];
  if (!pinned) return "new";
  return pinned === fp ? "same" : "changed";
}

export function pinPeer(myId: string, peerId: string, fp: string): void {
  const pins = readPins(myId);
  pins[peerId] = fp;
  try {
    localStorage.setItem(pinsKey(myId), JSON.stringify(pins));
  } catch {}
}

/* ---------------- enkripsi / dekripsi pesan ---------------- */

const keyCache = new Map<string, CryptoKey>();

async function getMessageKey(myId: string, peerId: string, peerPub: PublicJwk): Promise<CryptoKey> {
  const cacheKey = `${myId}|${peerId}|${peerPub.x}.${peerPub.y}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const me = await getLocalIdentity(myId);
  if (!me) throw new Error("E2EE_LOCKED");

  const peerKey = await crypto.subtle.importKey(
    "jwk",
    pubOnly(peerPub),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peerKey }, me.privateKey, 256);
  const hkdfBase = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const ids = [myId, peerId].sort().join("|");
  const key = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("tsg-chat-e2ee-v2"), info: enc.encode(ids) },
    hkdfBase,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  keyCache.set(cacheKey, key);
  return key;
}

const msgAad = (senderId: string, recipientId: string) => enc.encode(`tsg-chat-v2|${senderId}|${recipientId}`);

/** Enkripsi pesan. Melempar error bila gagal (TIDAK ada fallback plaintext). */
export async function encryptChatMessage(
  text: string,
  myId: string,
  peerId: string,
  peerPublicKey: PublicJwk
): Promise<string> {
  if (!text) throw new Error("EMPTY_MESSAGE");
  const key = await getMessageKey(myId, peerId, peerPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: msgAad(myId, peerId) },
      key,
      enc.encode(text)
    )
  );
  return `e2ee2:${bytesToB64(iv)}:${bytesToB64(ct)}`;
}

/**
 * Dekripsi pesan. senderId opsional: bila tidak diketahui (mis. last_message percakapan),
 * dicoba kedua arah (pengirim = saya / lawan bicara).
 */
export async function decryptChatMessage(
  payload: string,
  myId: string,
  peerId: string,
  senderId?: string,
  peerPublicKey?: PublicJwk | null
): Promise<string> {
  if (!payload) return "";

  if (payload.startsWith("e2ee2:")) {
    if (!peerPublicKey) return LOCKED_PLACEHOLDER;
    try {
      const parts = payload.split(":");
      if (parts.length !== 3) return LOCKED_PLACEHOLDER;
      const iv = b64ToBytes(parts[1]);
      const ct = b64ToBytes(parts[2]);
      const key = await getMessageKey(myId, peerId, peerPublicKey);

      const candidates = senderId ? [senderId] : [myId, peerId];
      for (const s of candidates) {
        const recipient = s === myId ? peerId : myId;
        try {
          const pt = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as BufferSource, additionalData: msgAad(s, recipient) },
            key,
            ct as BufferSource
          );
          return dec.decode(pt);
        } catch {
          // coba kandidat berikutnya
        }
      }
      return LOCKED_PLACEHOLDER;
    } catch {
      return LOCKED_PLACEHOLDER;
    }
  }

  if (payload.startsWith("e2ee:")) {
    return legacyDecrypt(payload, myId, peerId);
  }

  // Pesan lama / non-enkripsi (mis. kartu verifikasi dari sistem)
  return payload;
}

/* ---------------- skema LAMA (v1) ----------------
 * Kunci v1 diturunkan dari ID pengguna sehingga TIDAK aman (bukan E2EE sungguhan).
 * Dipertahankan hanya untuk: (1) membaca riwayat lama, (2) percakapan dengan Akun Resmi
 * (akun virtual milik server, tidak punya kunci pribadi).
 */

async function legacyKey(userA: string, userB: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode([userA, userB].sort().join("::tsg-e2ee-salt::")),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("TSG-WEB-XZRAY-E2EE-FIXED-SALT-V1"), iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function legacyDecrypt(payload: string, userA: string, userB: string): Promise<string> {
  try {
    const parts = payload.split(":");
    if (parts.length < 3) return payload;
    const key = await legacyKey(userA, userB);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(parts[1]) as BufferSource }, key, b64ToBytes(parts[2]) as BufferSource);
    return dec.decode(pt);
  } catch {
    return LOCKED_PLACEHOLDER;
  }
}

/** Hanya untuk percakapan dengan Akun Resmi (akun virtual server). */
export async function encryptLegacyChatMessage(text: string, userA: string, userB: string): Promise<string> {
  if (!text) throw new Error("EMPTY_MESSAGE");
  const key = await legacyKey(userA, userB);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(text)));
  return `e2ee:${bytesToB64(iv)}:${bytesToB64(ct)}`;
}

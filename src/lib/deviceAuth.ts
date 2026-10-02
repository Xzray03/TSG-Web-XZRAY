// Kunci perangkat (ECDSA P-256, non-extractable) untuk pengikatan perangkat.
// Kunci privat TIDAK pernah keluar dari browser; server hanya menyimpan kunci publik.

export type PublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

const DB_NAME = "tsg-device-auth";
const STORE = "keys";
const KEY_NAME = "device-key-v1";

type Stored = { privateKey: CryptoKey; publicJwk: PublicJwk };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<Stored | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY_NAME);
    r.onsuccess = () => resolve((r.result as Stored) ?? null);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(v: Stored): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(v, KEY_NAME);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let cached: Stored | null = null;

export async function getDeviceIdentity(): Promise<Stored> {
  if (cached) return cached;
  let stored = await idbGet();
  if (!stored) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    const jwk: any = await crypto.subtle.exportKey("jwk", pair.publicKey);
    stored = {
      privateKey: pair.privateKey,
      publicJwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
    };
    await idbPut(stored);
  }
  cached = stored;
  return stored;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function signMessage(message: string): Promise<string> {
  const { privateKey } = await getDeviceIdentity();
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(message));
  return bytesToB64(new Uint8Array(sig)); // format IEEE P1363 (r||s, 64 byte)
}

export const proofMessage = (purpose: string, nonce: string, subjectId: string) =>
  `tsg-device-proof|${purpose}|${nonce}|${subjectId}`;

export function getDeviceInfo() {
  if (typeof navigator === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as any).userAgentData?.platform || navigator.platform || "",
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}

/** Bukti perangkat untuk penyelesaian login (nonce dari beginLogin/register). */
export async function buildLoginProof(nonce: string, loginId: string) {
  const { publicJwk } = await getDeviceIdentity();
  return {
    devicePublicJwk: publicJwk,
    signature: await signMessage(proofMessage("login", nonce, loginId)),
    deviceInfo: getDeviceInfo(),
  };
}

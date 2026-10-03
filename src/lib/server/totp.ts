import crypto from "crypto";
import { db } from "./db";
import { AuthError, requireSecret } from "./secrets";
import { AccountRow } from "./account";
import { IP_POLICY, TOTP_POLICY, audit, clearFailures, clientIpHash, isLocked, recordFailure } from "./rateLimit";

// ==============================================================================
// TSG-Web-XZRAY: Utilitas TOTP 2FA (RFC 6238: HMAC-SHA1, 6 digit, periode 30s)
// ==============================================================================

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // toleransi ±1 step (~90 detik) untuk mengantisipasi time drift

/** Kunci enkripsi AES-256 dari env TOTP_KEY_SECRET (fail-closed, min 32 char). */
function key(): Buffer {
  return crypto.createHash("sha256").update(requireSecret("TOTP_KEY_SECRET")).digest();
}

/** Hash secret ke Base32 (RFC 4648, tanpa padding) — untuk Setup Key & otpauth. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let out = "";
  let bits = 0;
  let acc = 0;
  for (const b of buf) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer | null {
  const clean = s.trim().replace(/=+$/, "").toUpperCase();
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  const bytes: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of clean) {
    acc = (acc << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Enkripsi secret Base32 (AES-256-GCM, AAD "totp|"+userId). Format v1.iv.tag.ct */
export function encryptTotpSecret(secretBase32: string, userId: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(`totp|${userId}`));
  const ct = Buffer.concat([c.update(secretBase32, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
}

export function decryptTotpSecret(stored: string, userId: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new AuthError("Secret 2FA rusak.", "SERVER_ERROR");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(parts[1], "base64"));
  d.setAAD(Buffer.from(`totp|${userId}`));
  d.setAuthTag(Buffer.from(parts[2], "base64"));
  return Buffer.concat([d.update(Buffer.from(parts[3], "base64")), d.final()]).toString("utf8");
}

/** URI otpauth untuk QR Code / input manual. */
export function otpauthUrl(accountLabel: string, secretBase32: string): string {
  const label = `TSG 2FA:${accountLabel}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: "TSG 2FA",
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

/** Hitung kode TOTP HMAC-SHA1 untuk counter tertentu. */
function hotp(secret: Buffer, counter: bigint): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac("sha1", secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function currentWindow(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD));
}

/**
 * Verifikasi kode TOTP 6 digit terhadap secret (dengan toleransi ±1 window).
 * Mengembalikan window yang cocok, atau null bila tidak cocok.
 */
export function verifyTotpWindow(secretBase32: string, code: string): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  if (!secret || secret.length === 0) return null;
  const now = currentWindow();
  for (let d = -TOTP_WINDOW; d <= TOTP_WINDOW; d++) {
    const w = now + BigInt(d);
    if (w < BigInt(0)) continue;
    const expected = hotp(secret, w);
    if (expected.length === code.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return w;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Recovery Codes
// ---------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // tanpa I,O,L,0,1 (tidak ambigu)

export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.randomBytes(9);
    const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    codes.push(`${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`);
  }
  return codes;
}

/** Normalisasi input pengguna: uppercase, buang '-' dan spasi. */
export function normalizeRecoveryCode(code: any): string | null {
  if (typeof code !== "string") return null;
  const n = code.trim().toUpperCase().replace(/[-\s]/g, "");
  if (n.length !== 12 || !/^[A-Z2-9]{12}$/.test(n)) return null;
  return n;
}

/** Hash recovery code: HMAC-SHA512(code_normalized + userId, SESSION_SECRET). */
export function hashRecoveryCode(normalized: string, userId: string): string {
  return crypto
    .createHmac("sha512", requireSecret("SESSION_SECRET"))
    .update(`${normalized}|${userId}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Helper gate server-side
// ---------------------------------------------------------------------------

export const totpActiveOf = (acc: AccountRow) =>
  Boolean(acc.totp_verified) && (acc.login_preferences as any)?.totp === true;

/**
 * Verifikasi kode TOTP / recovery code untuk gate aksi sensitif & login.
 * Mengembalikan window yang cocok (number) bila kode TOTP valid,
 * atau { recovery: true } bila recovery code valid (sekali pakai — dihapus di pemanggil).
 */
export async function verifyUserTotpCode(
  acc: AccountRow,
  code: any
): Promise<{ ok: true; window?: bigint; recoveryHash?: string } | { ok: false }> {
  const normalized = typeof code === "string" ? code.trim() : "";
  if (!normalized) return { ok: false };
  // 1) Coba sebagai kode TOTP 6 digit (anti-replay via last_used_totp_window — dicek pemanggil).
  if (/^\d{6}$/.test(normalized) && acc.totp_secret) {
    try {
      const secret = decryptTotpSecret(acc.totp_secret, acc.id);
      const w = verifyTotpWindow(secret, normalized);
      // ponytail: window equality check assumes last_used_totp_window stored as Number-compatible int64.
      if (w !== null && Number(w) > Number(acc.last_used_totp_window || 0)) {
        return { ok: true, window: w };
      }
    } catch {
      return { ok: false };
    }
  }
  // 2) Coba sebagai recovery code (sekali pakai).
  const rec = normalizeRecoveryCode(normalized);
  if (rec && Array.isArray(acc.recovery_codes_hash)) {
    const h = hashRecoveryCode(rec, acc.id);
    const match = (acc.recovery_codes_hash as string[]).find(
      (stored) => stored.length === h.length && crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(h))
    );
    if (match) return { ok: true, recoveryHash: match };
  }
  return { ok: false };
}

/** Tandai window TOTP sudah terpakai (anti-replay atomik). */
export async function markTotpWindowUsed(userId: string, window: bigint): Promise<void> {
  await db().from("user_accounts").update({ last_used_totp_window: Number(window) }).eq("id", userId);
}

/** Hapus recovery code yang sudah dipakai (sekali pakai) dari array hash. */
export async function consumeRecoveryCode(userId: string, hashToRemove: string): Promise<void> {
  const { data } = await db().from("user_accounts").select("recovery_codes_hash").eq("id", userId).maybeSingle();
  const arr = Array.isArray((data as any)?.recovery_codes_hash) ? ((data as any).recovery_codes_hash as string[]) : [];
  await db()
    .from("user_accounts")
    .update({ recovery_codes_hash: arr.filter((h) => h !== hashToRemove) })
    .eq("id", userId);
}

/** Gate pembantu seragam untuk aksi sensitif (dipanggil di authActions & chatKeyActions). */
export async function assertTotpForAction(acc: AccountRow, code: any): Promise<void> {
  if (!code) throw new AuthError("Kode 2FA diperlukan untuk melanjutkan.", "TOTP_REQUIRED");
  const keys = [`totp:${acc.id}`, `ip:${await clientIpHash()}`];
  const l = await isLocked(keys[0]);
  if (l.locked) throw new AuthError(`Terlalu banyak percobaan. Coba lagi dalam ${Math.max(1, Math.ceil(l.retryAfterSec / 60))} menit.`, "LOCKED");
  const lIp = await isLocked(keys[1]);
  if (lIp.locked) throw new AuthError(`Terlalu banyak percobaan dari jaringan ini. Coba lagi dalam ${Math.max(1, Math.ceil(lIp.retryAfterSec / 60))} menit.`, "LOCKED");

  const res = await verifyUserTotpCode(acc, code);
  if (!res.ok) {
    await recordFailure(keys[0], TOTP_POLICY);
    await recordFailure(keys[1], IP_POLICY);
    await audit(acc.id, "totp_rejected", { reason: "invalid_code" });
    throw new AuthError("Kode 2FA tidak valid.", "TOTP_INVALID");
  }
  if (res.window !== undefined) {
    await markTotpWindowUsed(acc.id, res.window);
  }
  if (res.recoveryHash) {
    await consumeRecoveryCode(acc.id, res.recoveryHash);
    await audit(acc.id, "recovery_used");
  }
  await clearFailures(keys[0]);
}

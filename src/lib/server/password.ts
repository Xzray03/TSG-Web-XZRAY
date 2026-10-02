import crypto from "crypto";
import { promisify } from "util";
import { safeEqual } from "./secrets";

const scrypt = promisify(crypto.scrypt) as (
  pw: string,
  salt: Buffer,
  keylen: number,
  opts: crypto.ScryptOptions
) => Promise<Buffer>;

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 96 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored) return { ok: false, needsUpgrade: false };
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 6) return { ok: false, needsUpgrade: false };
    const n = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    const dk = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
    const ok = dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
    return { ok, needsUpgrade: ok && (n !== N || r !== R || p !== P) };
  }
  // Hash lama (sha256 tanpa salt): terima sekali, lalu upgrade otomatis ke scrypt.
  const legacy = crypto.createHash("sha256").update(password).digest("hex");
  const ok = safeEqual(legacy, stored);
  return { ok, needsUpgrade: ok };
}

/** Menyamakan waktu respon ketika akun tidak ada. */
export async function dummyVerify(): Promise<void> {
  await scrypt("dummy-password", Buffer.alloc(16), KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
}

export function passwordPolicyError(pw: string): string | null {
  if (
    typeof pw !== "string" ||
    pw.length < 12 ||
    pw.length > 200 ||
    !/[A-Z]/.test(pw) ||
    !/[a-z]/.test(pw) ||
    !/[0-9]/.test(pw) ||
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)
  ) {
    return "Password tidak memenuhi kriteria keamanan (Min 12 Karakter, A-Z, a-z, 0-9, Simbol).";
  }
  return null;
}

import crypto from "crypto";

export class AuthError extends Error {
  code: string;
  constructor(message: string, code = "UNAUTHENTICATED") {
    super(message);
    this.code = code;
  }
}

/** Fail-closed: lempar error bila env tidak ada / terlalu pendek. */
export function requireSecret(name: "SESSION_SECRET" | "FACE_DATA_KEY"): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    throw new AuthError(`${name} belum dikonfigurasi di server.`, "MISCONFIGURED");
  }
  return v;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hmacHex(data: string, purpose = "tok"): string {
  return crypto.createHmac("sha256", requireSecret("SESSION_SECRET")).update(`${purpose}|${data}`).digest("hex");
}

export const tokenHash = (token: string) => hmacHex(token, "tok");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Jawaban seragam untuk kegagalan autentikasi (hindari enumerasi akun). */
export const GENERIC_AUTH_ERROR = "Nama atau kredensial salah.";

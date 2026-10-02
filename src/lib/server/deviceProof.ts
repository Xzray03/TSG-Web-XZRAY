import crypto from "crypto";
import { db } from "./db";
import { AuthError, randomToken, tokenHash } from "./secrets";

export type PublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

const B64URL43 = /^[A-Za-z0-9_-]{43}$/;

export function validPublicJwk(k: any): k is PublicJwk {
  return !!k && k.kty === "EC" && k.crv === "P-256" && typeof k.x === "string" && typeof k.y === "string" && B64URL43.test(k.x) && B64URL43.test(k.y);
}

/** ID perangkat = thumbprint SHA-256 dari kunci publik (stabil dan tidak bisa dipilih penyerang). */
export function deviceIdOf(jwk: PublicJwk): string {
  return crypto.createHash("sha256").update(`${jwk.crv}|${jwk.kty}|${jwk.x}|${jwk.y}`).digest("base64url");
}

export function proofMessage(purpose: string, nonce: string, userId: string): string {
  return `tsg-device-proof|${purpose}|${nonce}|${userId}`;
}

export function verifySignature(jwk: PublicJwk, message: string, signatureB64: string): boolean {
  try {
    const key = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, format: "jwk" });
    const sig = Buffer.from(signatureB64, "base64");
    if (sig.length !== 64) return false;
    return crypto.verify("sha256", Buffer.from(message), { key, dsaEncoding: "ieee-p1363" }, sig);
  } catch {
    return false;
  }
}

/** Terbitkan nonce sekali pakai (2 menit) untuk bukti kepemilikan perangkat. */
export async function issueNonce(userId: string, sessionId: string, purpose: string) {
  const nonce = randomToken(24);
  const { data, error } = await db()
    .from("auth_nonces")
    .insert({
      user_id: userId,
      session_id: sessionId,
      purpose,
      nonce_hash: tokenHash(nonce),
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new AuthError("Gagal membuat tantangan perangkat.", "SERVER_ERROR");
  return { nonceId: data.id as string, nonce };
}

export type DeviceProof = { nonceId: string; nonce: string; signature: string };

/**
 * Verifikasi bukti perangkat untuk aksi sensitif. Nonce dikonsumsi (sekali pakai),
 * terikat pada sesi, pengguna, dan tujuan aksi; tanda tangan harus dari kunci perangkat sesi.
 */
export async function requireDeviceProof(
  ctx: { userId: string; sessionId: string; deviceId: string },
  purpose: string,
  proof: DeviceProof | undefined
): Promise<void> {
  if (!proof || typeof proof.nonceId !== "string" || typeof proof.nonce !== "string" || typeof proof.signature !== "string") {
    throw new AuthError("Verifikasi perangkat diperlukan.", "DEVICE_PROOF_REQUIRED");
  }
  const supabase = db();
  const { data: row } = await supabase.from("auth_nonces").select("*").eq("id", proof.nonceId).maybeSingle();
  if (
    !row ||
    row.used_at ||
    row.user_id !== ctx.userId ||
    row.session_id !== ctx.sessionId ||
    row.purpose !== purpose ||
    new Date(row.expires_at).getTime() < Date.now() ||
    row.nonce_hash !== tokenHash(proof.nonce)
  ) {
    throw new AuthError("Verifikasi perangkat tidak valid atau kedaluwarsa.", "DEVICE_PROOF_INVALID");
  }
  // Konsumsi atomik: hanya satu permintaan yang berhasil menandai used_at.
  const { data: consumed } = await supabase
    .from("auth_nonces")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id");
  if (!consumed || consumed.length === 0) {
    throw new AuthError("Verifikasi perangkat sudah dipakai.", "DEVICE_PROOF_INVALID");
  }

  const { data: dev } = await supabase
    .from("auth_devices")
    .select("public_key, status")
    .eq("user_id", ctx.userId)
    .eq("id", ctx.deviceId)
    .maybeSingle();
  if (!dev || dev.status !== "active" || !validPublicJwk(dev.public_key)) {
    throw new AuthError("Perangkat tidak sah.", "DEVICE_PROOF_INVALID");
  }
  if (!verifySignature(dev.public_key, proofMessage(purpose, proof.nonce, ctx.userId), proof.signature)) {
    throw new AuthError("Tanda tangan perangkat tidak valid.", "DEVICE_PROOF_INVALID");
  }
}

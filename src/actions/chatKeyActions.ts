"use server";

import { createClient } from "@supabase/supabase-js";
import { guarded, getSession } from "@/lib/server/session";
import { AuthError, randomToken, tokenHash } from "@/lib/server/secrets";
import { findAccountById, hasFaceOf } from "@/lib/server/account";
import { audit, clientIpHash, isLocked, recordFailure, clearFailures, LOGIN_POLICY, IP_POLICY } from "@/lib/server/rateLimit";
import { totpActiveOf, assertTotpForAction } from "@/lib/server/totp";
import { verifyPassword } from "@/lib/server/password";
import { validateVectors, matchFace, decryptTemplate, legacyAnchor } from "@/lib/server/faceTemplate";
import { issueNonce } from "@/lib/server/deviceProof";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ID hanya boleh alfanumerik/strip: mencegah injeksi filter PostgREST.
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const B64URL_RE = /^[A-Za-z0-9_-]{43}$/; // koordinat P-256 (32 byte) base64url

function validJwk(k: any): boolean {
  return (
    k &&
    k.kty === "EC" &&
    k.crv === "P-256" &&
    typeof k.x === "string" &&
    typeof k.y === "string" &&
    B64URL_RE.test(k.x) &&
    B64URL_RE.test(k.y)
  );
}

type KeyRow = {
  user_id: string;
  public_key: any;
  wrapped_private_key: string;
  kdf_salt: string;
  kdf_iterations: number;
  key_version: number;
};

function toRecord(r: KeyRow) {
  return {
    publicKey: r.public_key,
    wrappedPrivateKey: r.wrapped_private_key,
    kdfSalt: r.kdf_salt,
    kdfIterations: r.kdf_iterations,
    keyVersion: r.key_version,
  };
}

/** Ambil record kunci milik sendiri (termasuk cadangan terenkripsi kata sandi). */
export async function getChatKeyAction(_ignored?: string) {
  // Hanya pemilik (sesi) yang boleh mengambil cadangan kunci terenkripsi miliknya.
  const sess = await getSession();
  if (!sess) return { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali.", code: "UNAUTHENTICATED" };
  const userId = sess.userId;
  try {
    const { data, error } = await getSupabaseClient()
      .from("chat_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (error.code === "42P01") return { error: "Tabel chat_keys belum ada. Jalankan sql/chat_e2ee.sql." };
      return { error: error.message };
    }
    return { record: data ? toRecord(data as KeyRow) : null };
  } catch (err: any) {
    return { error: err.message || "Gagal memuat kunci." };
  }
}

/** Ambil KUNCI PUBLIK beberapa pengguna (tanpa cadangan privat). */
export async function getPublicKeysAction(userIds: string[]) {
  const sess = await getSession();
  if (!sess) return { keys: {}, error: "Sesi tidak valid.", code: "UNAUTHENTICATED" };
  if (!Array.isArray(userIds)) return { keys: {} };
  const ids = Array.from(new Set(userIds.filter((i) => typeof i === "string" && ID_RE.test(i)))).slice(0, 60);
  if (ids.length === 0) return { keys: {} };
  try {
    const { data, error } = await getSupabaseClient()
      .from("chat_keys")
      .select("user_id, public_key, key_version")
      .in("user_id", ids);
    if (error) return { keys: {}, error: error.message };
    const keys: Record<string, { publicKey: any; keyVersion: number }> = {};
    for (const row of data || []) {
      keys[row.user_id] = { publicKey: row.public_key, keyVersion: row.key_version };
    }
    return { keys };
  } catch (err: any) {
    return { keys: {}, error: err.message || "Gagal memuat kunci publik." };
  }
}

/** Verifikasi wajah server-side khusus untuk reset chat key: menghasilkan token status valid 2 menit. */
export async function verifyFaceForChatKeyResetAction(faceVectors: number[][]) {
  return guarded(async () => {
    const sess = await getSession();
    if (!sess) return { error: "Sesi tidak valid.", code: "UNAUTHENTICATED" };
    const acc = await findAccountById(sess.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (!hasFaceOf(acc)) return { error: "Wajah tidak terdaftar pada akun ini." };

    const vectors = validateVectors(faceVectors);
    if (!vectors) return { error: "Data wajah tidak valid." };

    let template: number[][] | null = null;
    if (acc.face_template) {
      try {
        template = decryptTemplate(acc.face_template, acc.id);
      } catch {}
    } else {
      const anchor = legacyAnchor(acc.face_vectors);
      if (anchor) {
        template = validateVectors(anchor.length === 4 ? anchor : [anchor[0], anchor[0], anchor[0], anchor[0]]);
      }
    }

    if (!template || !matchFace(template, vectors)) {
      await audit(acc.id, "chat_key_reset_face_failed");
      return { error: "Verifikasi Wajah Gagal: Wajah tidak cocok dengan patokan akun." };
    }

    // Terbitkan nonce token status verified sekali pakai (2 menit)
    const token = randomToken(32);
    await getSupabaseClient().from("auth_nonces").insert({
      user_id: acc.id,
      session_id: sess.sessionId,
      purpose: "chat_key_reset_face",
      nonce_hash: tokenHash(token),
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    });

    await audit(acc.id, "chat_key_reset_face_passed");
    return { success: true, faceVerifiedToken: token };
  });
}

/**
 * Publikasikan kunci baru. Tanpa replace=true, gagal bila kunci sudah ada (mencegah penimpaan tak sengaja).
 * replace=true dipakai untuk reset kunci; lawan bicara akan melihat peringatan "kunci berubah".
 */
export async function publishChatKeyAction(body: {
  userId?: string; // diabaikan: selalu dari sesi
  record: {
    publicKey: any;
    wrappedPrivateKey: string;
    kdfSalt: string;
    kdfIterations: number;
    keyVersion: number;
  };
  replace?: boolean;
  password?: string;
  faceVerifiedToken?: string;
  totpCode?: string;
}) {
  return guarded(async () => {
    const sess = await getSession();
    if (!sess) return { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali.", code: "UNAUTHENTICATED" };
    const userId = sess.userId;
    const { record, replace, password, faceVerifiedToken, totpCode } = body || ({} as any);
    if (
      !record ||
      !validJwk(record.publicKey) ||
      typeof record.wrappedPrivateKey !== "string" ||
      record.wrappedPrivateKey.length > 4096 ||
      !B64_RE.test(record.wrappedPrivateKey) ||
      typeof record.kdfSalt !== "string" ||
      record.kdfSalt.length > 64 ||
      !B64_RE.test(record.kdfSalt) ||
      !Number.isInteger(record.kdfIterations) ||
      record.kdfIterations < 600000 ||
      record.kdfIterations > 5000000 ||
      !Number.isInteger(record.keyVersion) ||
      record.keyVersion < 1 ||
      record.keyVersion > 1000000
    ) {
      return { error: "Data kunci tidak valid." };
    }

    const acc = await findAccountById(userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");

    // Saat mengganti/mereset kunci (replace === true), WAJIB verifikasi password / status wajah AI
    if (replace) {
      if (acc.password_hash) {
        if (!password) return { error: "Password wajib diisi untuk mereset kunci enkripsi.", code: "PASSWORD_REQUIRED" };
        const keys = [`pw:${acc.id}`, `ip:${await clientIpHash()}`];
        const l = await isLocked(keys[0]);
        if (l.locked) return { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.max(1, Math.ceil(l.retryAfterSec / 60))} menit.` };
        const v = await verifyPassword(password, acc.password_hash);
        if (!v.ok) {
          await recordFailure(keys[0], LOGIN_POLICY);
          await recordFailure(keys[1], IP_POLICY);
          await audit(acc.id, "chat_key_reset_pass_failed");
          return { error: "Password salah." };
        }
        await clearFailures(keys[0]);
      } else if (hasFaceOf(acc)) {
        if (!faceVerifiedToken || typeof faceVerifiedToken !== "string") {
          return { error: "Verifikasi Wajah AI diperlukan untuk mereset kunci.", code: "FACE_REQUIRED" };
        }
        // Validasi dan konsumsi token status verifikasi wajah
        const supabase = getSupabaseClient();
        const { data: row } = await supabase
          .from("auth_nonces")
          .select("id, expires_at, used_at, user_id, session_id")
          .eq("nonce_hash", tokenHash(faceVerifiedToken))
          .eq("purpose", "chat_key_reset_face")
          .maybeSingle();

        if (
          !row ||
          row.used_at ||
          row.user_id !== userId ||
          row.session_id !== sess.sessionId ||
          new Date(row.expires_at).getTime() < Date.now()
        ) {
          return { error: "Status verifikasi wajah tidak valid atau telah kedaluwarsa. Ulangi verifikasi wajah.", code: "FACE_INVALID" };
        }

        // Konsumsi token atomik
        await supabase
          .from("auth_nonces")
          .update({ used_at: new Date().toISOString() })
          .eq("id", row.id);
      }

      // Jika 2FA (TOTP) aktif, WAJIB verifikasi kode TOTP / recovery code
      if (totpActiveOf(acc)) {
        await assertTotpForAction(acc, totpCode);
      }
    }

    const supabase = getSupabaseClient();
    const publicKey = { kty: "EC", crv: "P-256", x: record.publicKey.x, y: record.publicKey.y };

    if (!replace) {
      const { error } = await supabase.from("chat_keys").insert({
        user_id: userId,
        public_key: publicKey,
        wrapped_private_key: record.wrappedPrivateKey,
        kdf_salt: record.kdfSalt,
        kdf_iterations: record.kdfIterations,
        key_version: 1,
      });
      if (error) {
        if (error.code === "23505") return { error: "exists" };
        if (error.code === "42P01") return { error: "Tabel chat_keys belum ada." };
        return { error: error.message };
      }
      await audit(userId, "chat_key_published");
      return { success: true, keyVersion: 1 };
    }

    const { data: existing } = await supabase
      .from("chat_keys")
      .select("key_version")
      .eq("user_id", userId)
      .maybeSingle();
    const nextVersion = (existing?.key_version || 0) + 1;
    const { error } = await supabase.from("chat_keys").upsert({
      user_id: userId,
      public_key: publicKey,
      wrapped_private_key: record.wrappedPrivateKey,
      kdf_salt: record.kdfSalt,
      kdf_iterations: record.kdfIterations,
      key_version: nextVersion,
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };
    await audit(userId, "chat_key_reset", { nextVersion });
    return { success: true, keyVersion: nextVersion };
  });
}

"use server";

import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/server/session";

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
}) {
  const sess = await getSession();
  if (!sess) return { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali.", code: "UNAUTHENTICATED" };
  const userId = sess.userId;
  const { record, replace } = body || ({} as any);
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

  const supabase = getSupabaseClient();
  const publicKey = { kty: "EC", crv: "P-256", x: record.publicKey.x, y: record.publicKey.y };
  try {
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
    return { success: true, keyVersion: nextVersion };
  } catch (err: any) {
    return { error: err.message || "Gagal menyimpan kunci." };
  }
}

"use server";

import { createClient } from "@supabase/supabase-js";
import { sanitize, sanitizeUrl } from "@/lib/sanitize";
import { getSession } from "@/lib/server/session";

function cleanSocialMedia(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of Object.keys(v).slice(0, 12)) {
      if (/^[a-z_]{2,20}$/i.test(k)) out[k] = sanitize(String(v[k] ?? ""), 200);
    }
  }
  return out;
}

/**
 * Memeriksa apakah nickname termasuk nama/kata reserved yang dilarang (sistem/akun resmi TSG).
 */
export async function isReservedNickname(nickname: string): Promise<boolean> {
  if (!nickname) return false;
  const raw = nickname.trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]/g, "");

  if (
    normalized === "tsg" ||
    normalized.includes("tsgofficial") ||
    normalized.includes("officialtsg") ||
    /^tsg[_\.\-]?official/i.test(raw) ||
    /^official[_\.\-]?tsg/i.test(raw) ||
    /^tsg[_\.\-]/i.test(raw)
  ) {
    return true;
  }
  return false;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function checkNicknameAction(nickname: string, excludeAccountId?: string) {
  if (!nickname) {
    return { exists: false, available: false };
  }

  const cleanNick = nickname.trim().toLowerCase();
  if (await isReservedNickname(cleanNick)) {
    return { exists: true, available: false, error: "Nickname ini dilarang karena merupakan nama akun resmi/sistem." };
  }

  const serverSupabase = getSupabaseClient();

  try {
    let query = serverSupabase
      .from("public_accounts")
      .select("id, nickname, real_account_id")
      .ilike("nickname", cleanNick);

    if (excludeAccountId) {
      query = query.neq("real_account_id", excludeAccountId);
    }

    const { data, error } = await query.limit(1);

    if (error && error.code === "42P01") {
      return { exists: false, available: true };
    }

    const exists = Boolean(data && data.length > 0);
    return { exists, available: !exists };
  } catch (error: any) {
    return { error: error.message || "Gagal memeriksa nickname" };
  }
}

export async function getPublicAccountAction(_ignored?: string) {
  // Hanya data akun publik MILIK SENDIRI (dari sesi server). Parameter dari klien diabaikan
  // sehingga ID akun tidak bisa dipakai untuk menarik data akun orang lain (IDOR).
  const sess = await getSession();
  if (!sess) {
    return { publicAccount: null };
  }
  const realAccountId = sess.userId;

  const serverSupabase = getSupabaseClient();

  try {
    const { data, error } = await serverSupabase
      .from("public_accounts")
      .select("*")
      .eq("real_account_id", realAccountId)
      .limit(1);

    if (error && error.code === "42P01") {
      return { publicAccount: null };
    }

    if (data && data.length > 0) {
      const pubAcc = data[0];
      const { data: realAcc } = await serverSupabase
        .from("user_accounts")
        .select("photo, created_at")
        .eq("id", realAccountId)
        .limit(1);

      if (realAcc && realAcc.length > 0) {
        // Fallback foto asli hanya untuk akun publik yang belum pernah memasang avatar sendiri.
        // Akun yang avatar_url-nya sudah diset (walau kosong karena user menghapusnya) tidak di-overwrite.
        if (pubAcc.avatar_url === null && realAcc[0].photo) {
          pubAcc.avatar_url = realAcc[0].photo;
        }
        if (realAcc[0].created_at) {
          pubAcc.created_at = realAcc[0].created_at;
          pubAcc.real_account_created_at = realAcc[0].created_at;
        }
      }
      return { publicAccount: pubAcc };
    }

    return { publicAccount: null };
  } catch (error: any) {
    return { error: error.message || "Gagal mengambil data akun publik" };
  }
}

export async function savePublicAccountAction(body: {
  realAccountId?: string; // diabaikan: selalu dari sesi
  nickname: string;
  name: string;
  age?: number | string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  showTsgMember?: boolean;
  socialMedia?: any;
  website?: string | null;
}) {
  const sess = await getSession();
  if (!sess) {
    return { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali.", code: "UNAUTHENTICATED" };
  }
  const realAccountId = sess.userId;
  const { nickname, name, age, bio, avatarUrl, showTsgMember, website } = body;
  const socialMedia = cleanSocialMedia(body.socialMedia);

  if (!nickname || !name || typeof nickname !== "string" || typeof name !== "string") {
    return { error: "Nickname dan nama wajib diisi." };
  }
  if (age !== undefined && age !== null && age !== "" && !(Number.isInteger(Number(age)) && Number(age) >= 5 && Number(age) <= 120)) {
    return { error: "Umur tidak valid." };
  }

  const cleanNickname = nickname.trim();
  if (cleanNickname.length < 3 || /\s/.test(cleanNickname)) {
    return { error: "Nickname minimal 3 karakter dan tidak boleh mengandung spasi." };
  }

  if (await isReservedNickname(cleanNickname)) {
    return { error: "Nickname ini dilarang karena merupakan nama akun resmi/sistem." };
  }

  const serverSupabase = getSupabaseClient();

  try {
    const { data: realAccData, error: realAccErr } = await serverSupabase
      .from("user_accounts")
      .select("id, is_tsg_member, photo")
      .eq("id", realAccountId)
      .limit(1);

    if (realAccErr || !realAccData || realAccData.length === 0) {
      return { error: "Akun asli (real account) tidak ditemukan." };
    }

    const realAcc = realAccData[0];
    const isRealTsgMember = !!realAcc.is_tsg_member;
    const finalAvatarUrl =
      avatarUrl && typeof avatarUrl === "string" && avatarUrl.trim()
        ? avatarUrl.trim()
        : null;

    const finalShowTsg = showTsgMember && isRealTsgMember;

    const { data: existingNick } = await serverSupabase
      .from("public_accounts")
      .select("id, real_account_id")
      .ilike("nickname", cleanNickname)
      .limit(1);

    if (existingNick && existingNick.length > 0) {
      if (existingNick[0].real_account_id !== realAccountId) {
        return { error: "Nickname sudah digunakan oleh akun publik lain. Pilih nickname lain." };
      }
    }

    const nowIso = new Date().toISOString();

    const { data: existingPub } = await serverSupabase
      .from("public_accounts")
      .select("id")
      .eq("real_account_id", realAccountId)
      .limit(1);

    if (existingPub && existingPub.length > 0) {
      const { error: updateErr } = await serverSupabase
        .from("public_accounts")
        .update({
          nickname: sanitize(cleanNickname, 50),
          name: sanitize(name, 100),
          age: age ? parseInt(String(age), 10) : null,
          bio: bio ? sanitize(bio, 500) : null,
          avatar_url: sanitizeUrl(finalAvatarUrl || ''),
          show_tsg_member: finalShowTsg,
          social_media: socialMedia || {},
          website: website ? sanitizeUrl(website) : null,
          updated_at: nowIso,
        })
        .eq("real_account_id", realAccountId);

      if (updateErr) {
        return { error: updateErr.message || "Gagal memperbarui akun publik." };
      }
    } else {
      const { error: insertErr } = await serverSupabase
        .from("public_accounts")
        .insert({
          real_account_id: realAccountId,
          nickname: sanitize(cleanNickname, 50),
          name: sanitize(name, 100),
          age: age ? parseInt(String(age), 10) : null,
          bio: bio ? sanitize(bio, 500) : null,
          avatar_url: sanitizeUrl(finalAvatarUrl || ''),
          show_tsg_member: finalShowTsg,
          social_media: socialMedia || {},
          website: website ? sanitizeUrl(website) : null,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (insertErr) {
        return { error: insertErr.message || "Gagal membuat akun publik." };
      }
    }

    return { success: true, message: "Akun publik berhasil disimpan." };
  } catch (error: any) {
    return { error: error.message || "Gagal menyimpan akun publik" };
  }
}

"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

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

export async function getPublicAccountAction(realAccountId: string) {
  if (!realAccountId) {
    return { publicAccount: null };
  }

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
        if (!pubAcc.avatar_url && realAcc[0].photo) {
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
  realAccountId: string;
  nickname: string;
  name: string;
  age?: number | string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  showTsgMember?: boolean;
  socialMedia?: any;
  website?: string | null;
}) {
  const { realAccountId, nickname, name, age, bio, avatarUrl, showTsgMember, socialMedia, website } = body;

  if (!realAccountId || !nickname || !name) {
    return { error: "Real Account ID, nickname, dan nama wajib diisi." };
  }

  const cleanNickname = nickname.trim();
  if (cleanNickname.length < 3 || /\s/.test(cleanNickname)) {
    return { error: "Nickname minimal 3 karakter dan tidak boleh mengandung spasi." };
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
        : realAcc.photo || null;

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
          nickname: cleanNickname,
          name: name.trim(),
          age: age ? parseInt(String(age), 10) : null,
          bio: bio ? bio.trim() : null,
          avatar_url: finalAvatarUrl,
          show_tsg_member: finalShowTsg,
          social_media: socialMedia || {},
          website: website ? website.trim() : null,
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
          nickname: cleanNickname,
          name: name.trim(),
          age: age ? parseInt(String(age), 10) : null,
          bio: bio ? bio.trim() : null,
          avatar_url: finalAvatarUrl,
          show_tsg_member: finalShowTsg,
          social_media: socialMedia || {},
          website: website ? website.trim() : null,
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

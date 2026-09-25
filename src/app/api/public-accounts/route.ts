import { NextResponse } from "next/server";
import { getSupabaseClient } from "../auth/utils";
import { verifyApiRequest } from "@/lib/api-guard";

export async function GET(request: Request) {
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

  const { searchParams } = new URL(request.url);
  const realAccountId = searchParams.get("realAccountId");
  const checkNickname = searchParams.get("checkNickname");
  const excludeAccountId = searchParams.get("excludeAccountId");

  const serverSupabase = getSupabaseClient();

  try {
    if (checkNickname) {
      const cleanNick = checkNickname.trim().toLowerCase();
      let query = serverSupabase
        .from("public_accounts")
        .select("id, nickname, real_account_id")
        .ilike("nickname", cleanNick);

      if (excludeAccountId) {
        query = query.neq("real_account_id", excludeAccountId);
      }

      const { data, error } = await query.limit(1);

      if (error && error.code === "42P01") {
        return NextResponse.json({ exists: false, available: true });
      }

      const exists = data && data.length > 0;
      return NextResponse.json({ exists, available: !exists });
    }

    if (realAccountId) {
      const { data, error } = await serverSupabase
        .from("public_accounts")
        .select("*")
        .eq("real_account_id", realAccountId)
        .limit(1);

      if (error && error.code === "42P01") {
        return NextResponse.json({ publicAccount: null });
      }

      if (data && data.length > 0) {
        return NextResponse.json({ publicAccount: data[0] });
      }

      return NextResponse.json({ publicAccount: null });
    }

    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengambil data akun publik" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

  try {
    const body = await request.json();
    const { realAccountId, nickname, name, age, bio, avatarUrl, showTsgMember, socialMedia, website } = body;

    if (!realAccountId || !nickname || !name) {
      return NextResponse.json({ error: "Real Account ID, nickname, dan nama wajib diisi." }, { status: 400 });
    }

    const cleanNickname = nickname.trim();
    if (cleanNickname.length < 3 || /\s/.test(cleanNickname)) {
      return NextResponse.json({ error: "Nickname minimal 3 karakter dan tidak boleh mengandung spasi." }, { status: 400 });
    }

    const serverSupabase = getSupabaseClient();

    // 1. Verify real account exists and get its tsg status
    const { data: realAccData, error: realAccErr } = await serverSupabase
      .from("user_accounts")
      .select("id, is_tsg_member")
      .eq("id", realAccountId)
      .limit(1);

    if (realAccErr || !realAccData || realAccData.length === 0) {
      return NextResponse.json({ error: "Akun asli (real account) tidak ditemukan." }, { status: 404 });
    }

    const realAcc = realAccData[0];
    const isRealTsgMember = !!realAcc.is_tsg_member;

    // Validate showTsgMember permission
    const finalShowTsg = showTsgMember && isRealTsgMember;

    // 2. Check nickname uniqueness (if already taken by another real account)
    const { data: existingNick, error: nickErr } = await serverSupabase
      .from("public_accounts")
      .select("id, real_account_id")
      .ilike("nickname", cleanNickname)
      .limit(1);

    if (existingNick && existingNick.length > 0) {
      if (existingNick[0].real_account_id !== realAccountId) {
        return NextResponse.json({ error: "Nickname sudah digunakan oleh akun publik lain. Pilih nickname lain." }, { status: 400 });
      }
    }

    const nowIso = new Date().toISOString();

    // 3. Check if public account already exists for this real account
    const { data: existingPub } = await serverSupabase
      .from("public_accounts")
      .select("id")
      .eq("real_account_id", realAccountId)
      .limit(1);

    if (existingPub && existingPub.length > 0) {
      // Update
      const { error: updateErr } = await serverSupabase
        .from("public_accounts")
        .update({
          nickname: cleanNickname,
          name: name.trim(),
          age: age ? parseInt(age, 10) : null,
          bio: bio ? bio.trim() : null,
          avatar_url: avatarUrl ? avatarUrl.trim() : null,
          show_tsg_member: finalShowTsg,
          social_media: socialMedia || {},
          website: website ? website.trim() : null,
          updated_at: nowIso,
        })
        .eq("real_account_id", realAccountId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message || "Gagal memperbarui akun publik." }, { status: 500 });
      }
    } else {
      // Insert
      const { error: insertErr } = await serverSupabase
        .from("public_accounts")
        .insert({
          real_account_id: realAccountId,
          nickname: cleanNickname,
          name: name.trim(),
          age: age ? parseInt(age, 10) : null,
          bio: bio ? bio.trim() : null,
          avatar_url: avatarUrl ? avatarUrl.trim() : null,
          show_tsg_member: finalShowTsg,
          social_media: socialMedia || {},
          website: website ? website.trim() : null,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message || "Gagal membuat akun publik." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Akun publik berhasil disimpan." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menyimpan akun publik" }, { status: 500 });
  }
}

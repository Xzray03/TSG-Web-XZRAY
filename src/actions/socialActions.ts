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

export async function getSocialPostsAction() {
  const supabase = getSupabaseClient();
  try {
    const { data: posts, error } = await supabase
      .from("social_posts")
      .select(`
        *,
        public_accounts (
          id,
          real_account_id,
          nickname,
          name,
          age,
          bio,
          avatar_url,
          show_tsg_member,
          social_media,
          website
        ),
        user_accounts (
          id,
          generation,
          is_tsg_member
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        return { posts: [], error: "Tabel social_posts belum ada. Jalankan social.sql." };
      }
      return { posts: [], error: error.message };
    }

    // Fetch comments for these posts
    const postIds = (posts || []).map((p: any) => p.id);
    let commentsMap: Record<string, any[]> = {};

    if (postIds.length > 0) {
      const { data: comments, error: commError } = await supabase
        .from("social_comments")
        .select(`
          *,
          public_accounts (
            id,
            real_account_id,
            nickname,
            name,
            age,
            bio,
            avatar_url,
            show_tsg_member,
            social_media,
            website
          )
        `)
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      if (!commError && comments) {
        comments.forEach((c: any) => {
          if (!commentsMap[c.post_id]) {
            commentsMap[c.post_id] = [];
          }
          commentsMap[c.post_id].push(c);
        });
      }
    }

    const enrichedPosts = (posts || []).map((p: any) => ({
      ...p,
      comments: commentsMap[p.id] || [],
    }));

    return { posts: enrichedPosts };
  } catch (err: any) {
    return { posts: [], error: err.message || "Gagal mengambil data postingan" };
  }
}

export async function createSocialPostAction(body: {
  realAccountId: string;
  content: string;
  linkUrl?: string;
}) {
  const { realAccountId, content, linkUrl } = body;
  if (!realAccountId || !content || !content.trim()) {
    return { error: "Konten postingan wajib diisi." };
  }

  const supabase = getSupabaseClient();
  try {
    // Get public account id for this real account
    const { data: pubData, error: pubErr } = await supabase
      .from("public_accounts")
      .select("id")
      .eq("real_account_id", realAccountId)
      .limit(1);

    if (pubErr || !pubData || pubData.length === 0) {
      return { error: "Akun publik belum diatur." };
    }

    const publicAccountId = pubData[0].id;

    const { error: insertErr } = await supabase.from("social_posts").insert({
      real_account_id: realAccountId,
      public_account_id: publicAccountId,
      content: content.trim(),
      link_url: linkUrl && linkUrl.trim() ? linkUrl.trim() : null,
    });

    if (insertErr) {
      return { error: insertErr.message || "Gagal membuat postingan" };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal membuat postingan" };
  }
}

export async function createSocialCommentAction(body: {
  postId: string;
  realAccountId: string;
  content: string;
}) {
  const { postId, realAccountId, content } = body;
  if (!postId || !realAccountId || !content || !content.trim()) {
    return { error: "Komentar wajib diisi." };
  }

  const supabase = getSupabaseClient();
  try {
    const { data: pubData, error: pubErr } = await supabase
      .from("public_accounts")
      .select("id")
      .eq("real_account_id", realAccountId)
      .limit(1);

    if (pubErr || !pubData || pubData.length === 0) {
      return { error: "Akun publik belum diatur." };
    }

    const publicAccountId = pubData[0].id;

    const { error: insertErr } = await supabase.from("social_comments").insert({
      post_id: postId,
      real_account_id: realAccountId,
      public_account_id: publicAccountId,
      content: content.trim(),
    });

    if (insertErr) {
      return { error: insertErr.message || "Gagal mengirim komentar" };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal mengirim komentar" };
  }
}

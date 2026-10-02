"use server";

import { createClient } from "@supabase/supabase-js";
import { sanitize, sanitizeUrl } from "@/lib/sanitize";
import { guarded, requireSession } from "@/lib/server/session";
import { findAccountById, isCreator } from "@/lib/server/account";
import { hit } from "@/lib/server/rateLimit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getSocialPostsAction(page = 0, limit = 10) {
  const supabase = getSupabaseClient();
  const from = page * limit;
  const to = from + limit - 1;

  try {
    const { data: posts, count, error } = await supabase
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
          is_tsg_member,
          created_at
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      if (error.code === "42P01") {
        return { posts: [], totalCount: 0, error: "Tabel social_posts belum ada. Jalankan social.sql." };
      }
      return { posts: [], totalCount: 0, error: error.message };
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

    return { posts: enrichedPosts, totalCount: count || 0 };
  } catch (err: any) {
    return { posts: [], totalCount: 0, error: err.message || "Gagal mengambil data postingan" };
  }
}

export async function createSocialPostAction(body: {
  realAccountId: string;
  content: string;
  linkUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  attachments?: any[];
}) {
  const { content, linkUrl, mediaUrl, mediaType } = body;
  if (!content || typeof content !== "string" || !content.trim()) {
    return { error: "Konten postingan wajib diisi." };
  }

  return guarded(async () => {
  // Identitas HANYA dari sesi server (parameter realAccountId dari klien diabaikan).
  const session = await requireSession();
  const realAccountId = session.userId;
  if (!(await hit(`post:${realAccountId}`, { max: 30, windowSec: 3600, lockSec: 1800 }))) {
    return { error: "Terlalu banyak postingan. Coba lagi nanti." };
  }
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .slice(0, 10)
        .map((a: any) => ({
          url: sanitizeUrl(String(a?.url || "")),
          name: sanitize(String(a?.name || ""), 200),
          size: Number.isFinite(a?.size) ? Number(a.size) : 0,
          mime: sanitize(String(a?.mime || ""), 100),
          ext: sanitize(String(a?.ext || ""), 10),
        }))
        .filter((a: any) => a.url)
    : [];

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

    const { error: insertErr } = await supabase.from("social_posts").insert({
      real_account_id: realAccountId,
      public_account_id: publicAccountId,
      content: sanitize(content, 2000),
      link_url: sanitizeUrl(linkUrl || ''),
      media_url: sanitizeUrl(mediaUrl || attachments?.[0]?.url || ''),
      media_type: sanitize(mediaType || '', 50),
      attachments,
    });

    if (insertErr) {
      return { error: insertErr.message || "Gagal membuat postingan" };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal membuat postingan" };
  }
  });
}

export async function uploadSocialFilesAction(formData: FormData) {
  return guarded(async () => {
  const session = await requireSession();
  if (!(await hit(`upload:${session.userId}`, { max: 40, windowSec: 3600, lockSec: 1800 }))) {
    return { error: "Terlalu banyak unggahan. Coba lagi nanti." };
  }
  try {
    const files = formData.getAll("files") as File[];
    if (!files || files.length === 0) {
      return { error: "Tidak ada file yang diunggah." };
    }

    if (files.length > 10) {
      return { error: "Maksimal 10 file per postingan." };
    }

    let totalSize = 0;
    for (const f of files) {
      totalSize += f.size;
    }

    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB
    if (totalSize > MAX_TOTAL_SIZE) {
      return { error: "Total ukuran file melebihi batas maksimal 100MB." };
    }

    const uploadedFiles = [];

    for (const file of files) {
      const catboxForm = new FormData();
      catboxForm.append("reqtype", "fileupload");
      catboxForm.append("fileToUpload", file, file.name);

      const response = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: catboxForm,
      });

      if (!response.ok) {
        throw new Error(`Upload gagal untuk ${file.name} (status ${response.status})`);
      }

      const fileUrl = await response.text();
      if (!fileUrl || !fileUrl.startsWith("http")) {
        throw new Error(`Respon tidak valid untuk ${file.name}: ${fileUrl}`);
      }

      uploadedFiles.push({
        url: fileUrl.trim(),
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        ext: (file.name.split(".").pop() || "").toLowerCase(),
      });
    }

    return { success: true, files: uploadedFiles };
  } catch (err: any) {
    return { error: err.message || "Gagal mengunggah file" };
  }
  });
}

export async function createSocialCommentAction(body: {
  postId: string;
  realAccountId: string;
  content: string;
}) {
  const { postId, content } = body;
  if (!postId || typeof postId !== "string" || !content || typeof content !== "string" || !content.trim()) {
    return { error: "Komentar wajib diisi." };
  }

  return guarded(async () => {
  const session = await requireSession();
  const realAccountId = session.userId;
  if (!(await hit(`comment:${realAccountId}`, { max: 60, windowSec: 3600, lockSec: 1800 }))) {
    return { error: "Terlalu banyak komentar. Coba lagi nanti." };
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
      content: sanitize(content, 1000),
    });

    if (insertErr) {
      return { error: insertErr.message || "Gagal mengirim komentar" };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal mengirim komentar" };
  }
  });
}

export async function deleteSocialPostAction(body: {
  postId: string;
  realAccountId: string;
}) {
  const { postId } = body;
  if (!postId || typeof postId !== "string") {
    return { error: "ID Postingan atau Akun tidak valid." };
  }

  return guarded(async () => {
  const session = await requireSession();
  const realAccountId = session.userId;

  const supabase = getSupabaseClient();
  try {
    const { data: postData, error: postErr } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .limit(1);

    if (postErr || !postData || postData.length === 0) {
      return { error: "Postingan tidak ditemukan." };
    }

    const post = postData[0];

    const userAcc = await findAccountById(realAccountId);
    if (!userAcc) {
      return { error: "Akun pengguna tidak ditemukan." };
    }

    const isOwner = post.real_account_id === realAccountId;
    // Creator ditentukan dari data server (anggota TSG terverifikasi + generasi dari roster), bukan dari nama.
    const canModerate = isCreator(userAcc);

    if (!isOwner && !canModerate) {
      return { error: "Anda tidak memiliki izin untuk menghapus postingan ini." };
    }

    const { error: delErr } = await supabase
      .from("social_posts")
      .delete()
      .eq("id", postId);

    if (delErr) {
      return { error: delErr.message || "Gagal menghapus postingan." };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Gagal menghapus postingan." };
  }
  });
}

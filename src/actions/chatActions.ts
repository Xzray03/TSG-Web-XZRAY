"use server";

import { createClient } from "@supabase/supabase-js";
import { sanitize } from "@/lib/sanitize";
import { getSiteSettings } from "@/sanity/queries";
import { getSession } from "@/lib/server/session";
import { hit } from "@/lib/server/rateLimit";

const UNAUTH = { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali.", code: "UNAUTHENTICATED" };

/** Pastikan pengguna sesi adalah peserta percakapan; kembalikan ID lawan bicara. */
async function conversationPeer(conversationId: string, userId: string): Promise<string | null> {
  const { data } = await getSupabaseClient()
    .from("chat_conversations")
    .select("user1_id, user2_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  if (data.user1_id === userId) return data.user2_id;
  if (data.user2_id === userId) return data.user1_id;
  return null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ID hanya boleh alfanumerik/strip: mencegah injeksi filter PostgREST pada .or()/.eq().
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const VIRTUAL_ID = "00000000-0000-0000-0000-000000000001";
const E2EE_V2_RE = /^e2ee2:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/;
const E2EE_V1_RE = /^e2ee:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getConversationsAction(_ignored?: string) {
  // Identitas dari sesi server; parameter dari klien diabaikan.
  const sess = await getSession();
  if (!sess) return { conversations: [], ...UNAUTH };
  const realAccountId = sess.userId;
  const supabase = getSupabaseClient();

  // Start Sanity fetch early so it runs in parallel with the Supabase query below.
  const tsgLogoPromise = getSiteSettings()
    .then((s) => s?.logoUrl || "/logo.webp")
    .catch(() => "/logo.webp");

  try {
    const { data, error } = await supabase
      .from("chat_conversations")
      .select(`
        *,
        user1:user_accounts!user1_id (
          id,
          name,
          generation,
          photo,
          is_tsg_member,
          created_at,
          public_accounts (
            id,
            nickname,
            name,
            avatar_url,
            show_tsg_member,
            bio,
            website,
            social_media,
            age
          )
        ),
        user2:user_accounts!user2_id (
          id,
          name,
          generation,
          photo,
          is_tsg_member,
          created_at,
          public_accounts (
            id,
            nickname,
            name,
            avatar_url,
            show_tsg_member,
            bio,
            website,
            social_media,
            age
          )
        )
      `)
      .or(`user1_id.eq.${realAccountId},user2_id.eq.${realAccountId}`)
      .order("last_message_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        return { conversations: [], error: "Tabel chat_conversations belum ada. Jalankan chat.sql." };
      }
      return { conversations: [], error: error.message };
    }

    let conversations = (data || []).map((c: any) => {
      const otherUser = c.user1_id === realAccountId ? c.user2 : c.user1;
      const otherPublic = Array.isArray(otherUser?.public_accounts)
        ? otherUser?.public_accounts[0]
        : otherUser?.public_accounts;

      return {
        id: c.id,
        user1_id: c.user1_id,
        user2_id: c.user2_id,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        otherUser: {
          id: otherUser?.id,
          name: otherPublic?.name || otherUser?.name || "Anonim",
          nickname: otherPublic?.nickname || "",
          photo: otherPublic?.avatar_url || otherUser?.photo || "",
          is_tsg_member: otherPublic?.show_tsg_member || otherUser?.is_tsg_member || false,
          generation: otherUser?.generation || "",
          bio: otherPublic?.bio || "",
          website: otherPublic?.website || "",
          social_media: otherPublic?.social_media || {},
          age: otherPublic?.age,
          created_at: otherUser?.created_at,
          badge: (otherUser as any)?.id === "00000000-0000-0000-0000-000000000001" ? "AKUN RESMI" : undefined,
          is_virtual: (otherUser as any)?.id === "00000000-0000-0000-0000-000000000001",
        } as any,
      };
    });

    const VIRTUAL_ID = "00000000-0000-0000-0000-000000000001";
    let virtualConv: any = conversations.find((c: any) => c.otherUser.id === VIRTUAL_ID);

    if (!virtualConv) {
      const tsgLogoUrl = await tsgLogoPromise;
      virtualConv = {
        id: "",
        user1_id: realAccountId,
        user2_id: VIRTUAL_ID,
        last_message: "AKUN RESMI THE SMART GENERATION",
        last_message_at: new Date().toISOString(),
        otherUser: {
          id: VIRTUAL_ID,
          name: "The Smart Generation",
          nickname: "tsg_official",
          photo: tsgLogoUrl,
          is_tsg_member: true,
          is_virtual: true,
          badge: "AKUN RESMI",
          generation: "Official",
          bio: "AKUN RESMI THE SMART GENERATION",
          website: "",
          social_media: {},
          age: null,
          created_at: new Date().toISOString(),
        },
      };
      conversations = [virtualConv, ...conversations];
    } else {
      if (virtualConv.otherUser) {
        virtualConv.otherUser.badge = "AKUN RESMI";
        virtualConv.otherUser.is_virtual = true;
        // Override photo with fresh Sanity logo (fallback to existing/"/logo.webp").
        const tsgLogoUrl = await tsgLogoPromise;
        if (tsgLogoUrl && tsgLogoUrl !== "/logo.webp") {
          virtualConv.otherUser.photo = tsgLogoUrl;
        } else if (!virtualConv.otherUser.photo) {
          virtualConv.otherUser.photo = "/logo.webp";
        }
      }
      conversations = [virtualConv, ...conversations.filter((c: any) => c.otherUser.id !== VIRTUAL_ID)];
    }

    return { conversations };
  } catch (err: any) {
    return { conversations: [], error: err.message || "Gagal memuat percakapan" };
  }
}

export async function getChatMessagesAction(conversationId: string) {
  const sess = await getSession();
  if (!sess) return { messages: [], ...UNAUTH };
  if (!conversationId || !ID_RE.test(conversationId)) return { messages: [] };
  if (!(await conversationPeer(conversationId, sess.userId))) {
    return { messages: [], error: "Percakapan tidak ditemukan." };
  }
  const supabase = getSupabaseClient();

  try {
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      return { messages: [], error: error.message };
    }

    return { messages: messages || [] };
  } catch (err: any) {
    return { messages: [], error: err.message || "Gagal memuat pesan" };
  }
}

export async function sendChatMessageAction(body: {
  conversationId?: string;
  senderId?: string; // diabaikan: pengirim selalu dari sesi server
  recipientId: string;
  encryptedContent: string;
}) {
  const sess = await getSession();
  if (!sess) return UNAUTH;
  const senderId = sess.userId;
  const { conversationId, encryptedContent } = body;
  let recipientId = body.recipientId;
  if (!recipientId || !encryptedContent) {
    return { error: "Data pesan tidak lengkap." };
  }
  if (!(await hit(`chat:${senderId}`, { max: 120, windowSec: 60, lockSec: 60 }))) {
    return { error: "Terlalu cepat. Coba lagi sebentar." };
  }
  if (conversationId) {
    // Penerima ditentukan dari percakapan (bukan dari klien) dan pengirim harus peserta.
    if (!ID_RE.test(conversationId)) return { error: "ID tidak valid." };
    const peer = await conversationPeer(conversationId, senderId);
    if (!peer) return { error: "Percakapan tidak ditemukan." };
    recipientId = peer;
  } else {
    const { data: rcp } = await getSupabaseClient().from("user_accounts").select("id").eq("id", recipientId).maybeSingle();
    if (!rcp) return { error: "Penerima tidak ditemukan." };
  }
  if (recipientId === senderId) return { error: "Tidak bisa mengirim pesan ke diri sendiri." };
  // Validate encrypted payload: must be string, bounded length (prevents abuse; content itself is client-encrypted)
  if (typeof encryptedContent !== "string" || encryptedContent.length > 10000) {
    return { error: "Payload pesan tidak valid." };
  }
  if (
    !ID_RE.test(senderId) ||
    !ID_RE.test(recipientId) ||
    (conversationId && !ID_RE.test(conversationId))
  ) {
    return { error: "ID tidak valid." };
  }
  // Server hanya menerima ciphertext E2EE v2. Skema lama (v1) hanya untuk Akun Resmi (akun virtual server).
  const involvesVirtual = senderId === VIRTUAL_ID || recipientId === VIRTUAL_ID;
  const payloadOk = E2EE_V2_RE.test(encryptedContent) || (involvesVirtual && E2EE_V1_RE.test(encryptedContent));
  if (!payloadOk) {
    return { error: "Pesan harus terenkripsi end-to-end." };
  }

  const supabase = getSupabaseClient();
  try {
    let targetConvId = conversationId;
    const nowIso = new Date().toISOString();

    if (!targetConvId) {
      // Find or create conversation
      const [u1, u2] = [senderId, recipientId].sort();
      const { data: existing, error: findErr } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user1_id", u1)
        .eq("user2_id", u2)
        .limit(1);

      if (existing && existing.length > 0) {
        targetConvId = existing[0].id;
      } else {
        const { data: newConv, error: createErr } = await supabase
          .from("chat_conversations")
          .insert({
            user1_id: u1,
            user2_id: u2,
            last_message: encryptedContent,
            last_message_at: nowIso,
          })
          .select("id")
          .single();

        if (createErr || !newConv) {
          return { error: createErr?.message || "Gagal membuat percakapan." };
        }
        targetConvId = newConv.id;
      }
    }

    // Insert message
    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: targetConvId,
        sender_id: senderId,
        content: encryptedContent,
      })
      .select("*")
      .single();

    if (msgErr) {
      return { error: msgErr.message || "Gagal mengirim pesan." };
    }

    // Update conversation last_message
    await supabase
      .from("chat_conversations")
      .update({
        last_message: encryptedContent,
        last_message_at: nowIso,
      })
      .eq("id", targetConvId);

    return { success: true, conversationId: targetConvId, message: msg };
  } catch (err: any) {
    return { error: err.message || "Gagal mengirim pesan" };
  }
}

export async function searchUsersAction(query: string, _ignored?: string) {
  const sess = await getSession();
  if (!sess) return { users: [], ...UNAUTH };
  const currentUserId = sess.userId;
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return { users: [] };
  }
  if (!(await hit(`search:${currentUserId}`, { max: 60, windowSec: 60, lockSec: 60 }))) {
    return { users: [], error: "Terlalu banyak pencarian." };
  }

  // Buang karakter yang bisa memecah sintaks filter PostgREST (koma, kurung, wildcard, dll).
  const cleanQ = query.trim().toLowerCase().replace(/[^\p{L}\p{N}_ .-]/gu, "");
  if (cleanQ.length < 2) return { users: [] };
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("public_accounts")
      .select(`
        *,
        user_accounts (
          id,
          name,
          generation,
          is_tsg_member,
          photo,
          created_at
        )
      `)
      .or(`nickname.ilike.%${cleanQ}%,name.ilike.%${cleanQ}%`)
      .limit(15);

    if (error) {
      return { users: [], error: error.message };
    }

    const users = (data || [])
      .filter((p: any) => p.real_account_id !== currentUserId)
      .map((p: any) => ({
        id: p.real_account_id,
        nickname: p.nickname,
        name: p.name,
        avatar_url: p.avatar_url || p.user_accounts?.photo || "",
        show_tsg_member: p.show_tsg_member || p.user_accounts?.is_tsg_member || false,
        bio: p.bio || "",
        website: p.website || "",
        social_media: p.social_media || {},
        age: p.age,
        created_at: p.user_accounts?.created_at || p.created_at,
      }));

    return { users };
  } catch (err: any) {
    return { users: [], error: err.message || "Gagal mencari pengguna" };
  }
}

"use server";

import { createClient } from "@supabase/supabase-js";
import { sanitize } from "@/lib/sanitize";
import { getSiteSettings } from "@/sanity/queries";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getConversationsAction(realAccountId: string) {
  if (!realAccountId) return { conversations: [] };
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
  if (!conversationId) return { messages: [] };
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
  senderId: string;
  recipientId: string;
  encryptedContent: string;
}) {
  const { conversationId, senderId, recipientId, encryptedContent } = body;
  if (!senderId || !recipientId || !encryptedContent) {
    return { error: "Data pesan tidak lengkap." };
  }
  // Validate encrypted payload: must be string, bounded length (prevents abuse; content itself is client-encrypted)
  if (typeof encryptedContent !== "string" || encryptedContent.length > 10000) {
    return { error: "Payload pesan tidak valid." };
  }
  if (senderId.length > 64 || recipientId.length > 64 || (conversationId && conversationId.length > 64)) {
    return { error: "ID tidak valid." };
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

export async function searchUsersAction(query: string, currentUserId: string) {
  if (!query || query.trim().length < 2) {
    return { users: [] };
  }

  const cleanQ = query.trim().toLowerCase();
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

"use server";

import { createClient } from "@supabase/supabase-js";
import { sanitize, sanitizeUrl } from "@/lib/sanitize";
import { guarded, requireSession } from "@/lib/server/session";
import { clientIpHash, hit } from "@/lib/server/rateLimit";
import { findAccountById, isCreator, lookupRoster } from "@/lib/server/account";
import { AuthError } from "@/lib/server/secrets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const VIRTUAL_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Upload base64 image snapshot to Catbox.moe anonymously
 */
export async function uploadToCatboxAction(base64Data: string, filename = "snapshot.jpg") {
  if (!base64Data || typeof base64Data !== "string") return { error: "Data gambar kosong" };
  // Endpoint publik (dipakai sebelum login): batasi ukuran, tipe, dan laju per IP.
  if (base64Data.length > 2_500_000 || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(base64Data)) {
    return { error: "Format atau ukuran gambar tidak valid." };
  }
  if (!(await hit(`catbox:${await clientIpHash()}`, { max: 8, windowSec: 3600, lockSec: 3600 }))) {
    return { error: "Terlalu banyak unggahan. Coba lagi nanti." };
  }
  filename = sanitize(String(filename || "snapshot.jpg"), 60);

  try {
    // Convert base64 to Blob / Buffer
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Clean, "base64");

    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", new Blob([buffer], { type: "image/jpeg" }), filename);

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Catbox upload failed with status ${response.status}`);
    }

    const fileUrl = await response.text();
    if (!fileUrl || !fileUrl.startsWith("http")) {
      throw new Error("Invalid response from Catbox: " + fileUrl);
    }

    return { success: true, url: fileUrl.trim() };
  } catch (err: any) {
    console.error("Catbox upload error:", err);
    // Fallback: return base64 or error
    return { error: err.message || "Gagal mengunggah ke Catbox.moe" };
  }
}

/**
 * Submit verification request and broadcast chat message to all creator accounts
 */
export async function submitRegistrationVerificationAction(body: {
  deviceId: string;
  browser: string;
  name: string;
  generation: string;
  snapshotUrl: string;
}) {
  const { deviceId, browser, name, generation, snapshotUrl } = body;
  if (!deviceId || !name || !snapshotUrl) {
    return { error: "Data verifikasi tidak lengkap" };
  }

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();

  if (!(await hit(`verif:${await clientIpHash()}`, { max: 6, windowSec: 3600, lockSec: 3600 }))) {
    return { error: "Terlalu banyak pengajuan. Coba lagi nanti." };
  }
  // Hanya nama yang ada di roster anggota yang boleh diajukan; generasi diambil dari roster (bukan klien).
  const roster = await lookupRoster(String(name));
  if (!roster) return { error: "Nama tidak ditemukan di daftar anggota TSG." };

  // Sanitize user inputs
  const safeName = sanitize(roster.name || name, 100);
  const safeGeneration = sanitize(roster.categoryName || generation, 50);
  const safeBrowser = sanitize(browser, 100);
  const safeSnapshotUrl = sanitizeUrl(snapshotUrl);
  const safeDeviceId = sanitize(deviceId, 64);

  if (!safeSnapshotUrl) {
    return { error: "URL snapshot tidak valid" };
  }

  try {
    // Check if there is already an active pending verification for this device or name
    const { data: existing } = await supabase
      .from("tsg_member_verifications")
      .select("*")
      .ilike("name", safeName.replace(/[\\%_]/g, (c) => `\\${c}`))
      .eq("device_id", safeDeviceId)
      .eq("status", "pending")
      .limit(1);

    let verificationId = "";

    if (existing && existing.length > 0) {
      verificationId = existing[0].id;
    } else {
      // Create new verification
      const { data: newVerif, error: insertErr } = await supabase
        .from("tsg_member_verifications")
        .insert({
          device_id: safeDeviceId,
          browser: safeBrowser || "Unknown",
          name: safeName,
          generation: safeGeneration || "Member",
          snapshot_url: safeSnapshotUrl,
          status: "pending",
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();

      if (insertErr || !newVerif) {
        return { error: insertErr?.message || "Gagal menyimpan pengajuan verifikasi" };
      }
      verificationId = newVerif.id;
    }

    // Find all creator accounts in user_accounts
    const { data: creators, error: creatorErr } = await supabase
      .from("user_accounts")
      .select("id, name, generation")
      .eq("is_tsg_member", true)
      .ilike("generation", "creator");

    if (creatorErr) {
      console.error("Error fetching creator accounts:", creatorErr);
    }

    const creatorList = creators || [];

    // Message payload content
    const msgContent = JSON.stringify({
      type: "tsg_verification_request",
      verificationId,
      name: name.trim(),
      generation: generation || "Member",
      deviceId,
      browser: browser || "Unknown",
      snapshotUrl,
      status: "pending",
      text: `Permohonan Pendaftaran Anggota TSG Baru:\nNama: ${name.trim()}\nGenerasi: ${generation || "Member"}\nDevice: ${browser || deviceId}\nFoto Buka Mulut: ${snapshotUrl}`,
    });

    // Send chat from Virtual Account (00000000-0000-0000-0000-000000000001) to each creator
    for (const creator of creatorList) {
      if (creator.id === VIRTUAL_ACCOUNT_ID) continue;

      const [u1, u2] = [VIRTUAL_ACCOUNT_ID, creator.id].sort();

      // Find or create conversation between Virtual Account and Creator
      let { data: convData } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user1_id", u1)
        .eq("user2_id", u2)
        .limit(1);

      let convId = "";
      if (convData && convData.length > 0) {
        convId = convData[0].id;
      } else {
        const { data: newConv } = await supabase
          .from("chat_conversations")
          .insert({
            user1_id: u1,
            user2_id: u2,
            last_message: msgContent,
            last_message_at: nowIso,
          })
          .select("id")
          .single();
        if (newConv) {
          convId = newConv.id;
        }
      }

      if (convId) {
        // Insert message
        await supabase.from("chat_messages").insert({
          conversation_id: convId,
          sender_id: VIRTUAL_ACCOUNT_ID,
          content: msgContent,
        });

        // Update conversation last_message
        await supabase
          .from("chat_conversations")
          .update({
            last_message: msgContent,
            last_message_at: nowIso,
          })
          .eq("id", convId);
      }
    }

    return { success: true, verificationId };
  } catch (err: any) {
    return { error: err.message || "Gagal mengirim pengajuan verifikasi" };
  }
}

/**
 * Check verification status for a given name or device
 */
export async function checkVerificationStatusAction(name: string, deviceId: string) {
  if (!name) return { status: "none" };
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("tsg_member_verifications")
      .select("*")
      .ilike("name", String(name).trim().replace(/[\\%_]/g, (c) => `\\${c}`))
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return { status: "none" };
    }

    const verif = data[0];
    const now = new Date().getTime();
    const expiresAt = new Date(verif.expires_at).getTime();
    // Status "approved" hanya berlaku bagi perangkat yang mengajukan.
    if (verif.status === "approved" && deviceId && verif.device_id !== deviceId) {
      return { status: "none" };
    }

    // Check timeout (30 days)
    if (verif.status === "pending" && now > expiresAt) {
      await supabase
        .from("tsg_member_verifications")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", verif.id);

      return { status: "expired" };
    }

    return { status: verif.status };
  } catch (err: any) {
    return { status: "none", error: err.message };
  }
}

/**
 * Creator responds to verification (Approve or Reject)
 */
export async function respondVerificationAction(body: {
  verificationId: string;
  responderUserId?: string; // diabaikan: responder selalu dari sesi server
  responderUsername?: string; // diabaikan
  action: "approve" | "reject";
}) {
  return guarded(async () => {
    const sess = await requireSession();
    const { verificationId, action } = body || ({} as any);
    if (!verificationId || typeof verificationId !== "string" || (action !== "approve" && action !== "reject")) {
      return { error: "Data respons tidak lengkap" };
    }
    // Hanya Creator (anggota TSG terverifikasi dengan generasi "Creator" di DB server) yang boleh merespons.
    const responder = await findAccountById(sess.userId);
    if (!responder || !isCreator(responder)) {
      throw new AuthError("Hanya Creator yang dapat merespons pengajuan ini.", "FORBIDDEN");
    }
    const responderUserId = responder.id;

    const supabase = getSupabaseClient();
    const nowIso = new Date().toISOString();
    const newStatus = action === "approve" ? "approved" : "rejected";

    let resolvedUsername = "";
    const { data: pubAcc } = await supabase
      .from("public_accounts")
      .select("nickname, name")
      .eq("real_account_id", responderUserId)
      .limit(1);
    if (pubAcc && pubAcc.length > 0) resolvedUsername = pubAcc[0].nickname || pubAcc[0].name || "";
    const finalResponderName = resolvedUsername || responder.name || "Creator";

  try {
    const { data: verif, error: fetchErr } = await supabase
      .from("tsg_member_verifications")
      .select("*")
      .eq("id", verificationId)
      .single();

    if (fetchErr || !verif) {
      return { error: "Pengajuan verifikasi tidak ditemukan" };
    }
    if (verif.status !== "pending") {
      return { error: "Pengajuan ini sudah diproses." };
    }

    // Update verification status
    const { error: updateErr } = await supabase
      .from("tsg_member_verifications")
      .update({
        status: newStatus,
        responded_by: responderUserId,
        responded_by_username: finalResponderName,
        updated_at: nowIso,
      })
      .eq("id", verificationId);

    if (updateErr) {
      return { error: updateErr.message || "Gagal memperbarui status verifikasi" };
    }

    // Update chat messages involving this verification
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, content")
      .ilike("content", `%${verificationId}%`);

    if (messages) {
      for (const m of messages) {
        try {
          const parsed = JSON.parse(m.content);
          if (parsed && parsed.verificationId === verificationId) {
            parsed.status = newStatus;
            parsed.respondedByUsername = finalResponderName;
            const updatedContent = JSON.stringify(parsed);

            await supabase
              .from("chat_messages")
              .update({ content: updatedContent })
              .eq("id", m.id);

            await supabase
              .from("chat_conversations")
              .update({ last_message: updatedContent })
              .eq("id", m.conversation_id);
          }
        } catch (e) {
          // not JSON content
        }
      }
    }

    return { success: true, status: newStatus };
  } catch (err: any) {
    return { error: err.message || "Gagal merespon verifikasi" };
  }
  });
}

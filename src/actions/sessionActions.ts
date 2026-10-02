"use server";

import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/rateLimit";
import { guarded, requireSession } from "@/lib/server/session";
import { DeviceProof, requireDeviceProof } from "@/lib/server/deviceProof";

const PENDING_TTL_MS = 15 * 60 * 1000;
const UUID_OR_ID = /^[A-Za-z0-9_.-]{8,64}$/;

/** Denyut perangkat: memperbarui last_seen dan (khusus perangkat utama) mengembalikan permintaan login baru. */
export async function sessionHeartbeatAction() {
  return guarded(async () => {
    const s = await requireSession();
    const supabase = db();
    await supabase
      .from("auth_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", s.userId)
      .eq("id", s.deviceId);

    const { data: me } = await supabase
      .from("auth_devices")
      .select("is_primary")
      .eq("user_id", s.userId)
      .eq("id", s.deviceId)
      .maybeSingle();

    let pendingRequests: any[] = [];
    if (me?.is_primary) {
      const { data } = await supabase
        .from("auth_devices")
        .select("id, info, last_seen_at")
        .eq("user_id", s.userId)
        .eq("status", "pending")
        .gt("last_seen_at", new Date(Date.now() - PENDING_TTL_MS).toISOString())
        .order("last_seen_at", { ascending: false })
        .limit(3);
      pendingRequests = (data || []).map((d: any) => ({
        deviceId: d.id,
        requester_device_info: d.info || {},
        requestedAt: d.last_seen_at,
      }));
    }
    return { success: true, isPrimary: Boolean(me?.is_primary), pendingRequests };
  });
}

/** Perangkat utama menyetujui/menolak perangkat baru (butuh bukti kunci perangkat). */
export async function respondDeviceRequestAction(body: {
  deviceId: string;
  decision: "approved" | "rejected";
  proof: DeviceProof;
}) {
  return guarded(async () => {
    const s = await requireSession();
    if (!body || !UUID_OR_ID.test(body.deviceId || "") || (body.decision !== "approved" && body.decision !== "rejected")) {
      return { error: "Data tidak valid." };
    }
    const supabase = db();
    const { data: me } = await supabase
      .from("auth_devices")
      .select("is_primary, status")
      .eq("user_id", s.userId)
      .eq("id", s.deviceId)
      .maybeSingle();
    if (!me || me.status !== "active" || !me.is_primary) {
      return { error: "Hanya perangkat utama yang dapat memberi persetujuan." };
    }
    await requireDeviceProof(s, "approve_device", body.proof);

    const { data: updated } = await supabase
      .from("auth_devices")
      .update({ status: body.decision === "approved" ? "active" : "rejected" })
      .eq("user_id", s.userId)
      .eq("id", body.deviceId)
      .eq("status", "pending")
      .select("id");
    if (!updated || updated.length === 0) return { error: "Permintaan tidak ditemukan atau sudah diproses." };
    await audit(s.userId, body.decision === "approved" ? "device_approved" : "device_rejected", {
      device: body.deviceId.slice(0, 8),
    });
    return { success: true };
  });
}

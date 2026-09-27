"use server";

import { supabase } from "@/lib/supabase";

export async function sessionCheckAction(userId: string, deviceKey: string, deviceInfo?: any) {
  if (!userId || !deviceKey) {
    return { error: "Missing userId or deviceKey" };
  }

  const now = new Date();

  try {
    const { data: existingSessions, error: fetchError } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Supabase device_sessions fetch error:", fetchError);
      return {
        status: "rejected",
        message: "Tabel Supabase belum siap. Jalankan script SUPABASE_SETUP.sql.",
      };
    }

    const currentDeviceSession = existingSessions?.find((s: any) => s.device_key === deviceKey);
    if (currentDeviceSession) {
      await supabase
        .from("device_sessions")
        .update({ last_active_at: now.toISOString() })
        .eq("id", currentDeviceSession.id);

      return { status: "allowed", isPrimary: currentDeviceSession.is_primary };
    }

    if (!existingSessions || existingSessions.length === 0) {
      await supabase.from("device_sessions").insert({
        user_id: userId,
        device_key: deviceKey,
        device_info: deviceInfo || {},
        is_primary: true,
        last_active_at: now.toISOString(),
        status: "active",
      });
      return { status: "allowed", isPrimary: true };
    }

    const primarySession = existingSessions[0];
    const lastActivePrimary = new Date(primarySession.last_active_at).getTime();
    const diffMinutes = (now.getTime() - lastActivePrimary) / (1000 * 60);

    if (diffMinutes > 10) {
      return {
        status: "rejected",
        message:
          "Perangkat utama sedang offline (tidak aktif). Perangkat utama wajib online untuk memberikan persetujuan login.",
      };
    }

    const { data: existingReqs } = await supabase
      .from("login_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "waiting")
      .order("created_at", { ascending: false })
      .limit(1);

    let activeReqId = null;
    if (existingReqs && existingReqs.length > 0) {
      activeReqId = existingReqs[0].id;
    } else {
      const { data: newReq, error: reqError } = await supabase
        .from("login_requests")
        .insert({
          user_id: userId,
          requester_device_info: deviceInfo || {},
          status: "waiting",
        })
        .select()
        .single();

      if (reqError) {
        return { error: "Gagal membuat permintaan login" };
      }
      activeReqId = newReq.id;
    }

    return {
      status: "waiting",
      requestId: activeReqId,
      message: "Menunggu persetujuan dari perangkat utama...",
    };
  } catch (err: any) {
    return { error: err.message || "Internal Server Error" };
  }
}

export async function sessionHeartbeatAction(userId: string, deviceKey: string) {
  if (!userId || !deviceKey) {
    return { error: "Missing parameters" };
  }

  const now = new Date().toISOString();

  try {
    await supabase
      .from("device_sessions")
      .update({ last_active_at: now })
      .eq("user_id", userId)
      .eq("device_key", deviceKey);

    const { data: sessionData } = await supabase
      .from("device_sessions")
      .select("is_primary")
      .eq("user_id", userId)
      .eq("device_key", deviceKey)
      .single();

    let pendingRequest = null;
    if (sessionData?.is_primary) {
      const { data: reqs } = await supabase
        .from("login_requests")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(1);

      if (reqs && reqs.length > 0) {
        pendingRequest = reqs[0];
      }
    }

    if (!sessionData?.is_primary) {
      const { data: activeSessions } = await supabase
        .from("device_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (activeSessions && activeSessions.length > 0 && activeSessions[0].device_key === deviceKey) {
        await supabase
          .from("device_sessions")
          .update({ is_primary: true })
          .eq("id", activeSessions[0].id);

        const { data: reqs } = await supabase
          .from("login_requests")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "waiting")
          .order("created_at", { ascending: false })
          .limit(1);

        if (reqs && reqs.length > 0) {
          pendingRequest = reqs[0];
        }
      }
    }

    return { success: true, pendingRequest };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function sessionRespondAction(
  requestId: string,
  decision: string,
  userId: string,
  requesterDeviceInfo?: any
) {
  if (!requestId || !decision) {
    return { error: "Missing requestId or decision" };
  }

  try {
    await supabase
      .from("login_requests")
      .update({ status: decision })
      .eq("id", requestId);

    if (decision === "approved" && userId) {
      await supabase.from("device_sessions").insert({
        user_id: userId,
        device_key: "dev_req_" + Math.random().toString(36).substring(2),
        device_info: requesterDeviceInfo || {},
        is_primary: false,
        last_active_at: new Date().toISOString(),
        status: "active",
      });
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function sessionLogoutAction(userId: string, deviceKey: string) {
  if (!userId || !deviceKey) {
    return { error: "Missing parameters" };
  }

  try {
    const { data: session } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("device_key", deviceKey)
      .single();

    if (session) {
      await supabase
        .from("device_sessions")
        .update({ status: "logged_out" })
        .eq("id", session.id);

      if (session.is_primary) {
        const { data: nextSessions } = await supabase
          .from("device_sessions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1);

        if (nextSessions && nextSessions.length > 0) {
          await supabase
            .from("device_sessions")
            .update({ is_primary: true })
            .eq("id", nextSessions[0].id);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

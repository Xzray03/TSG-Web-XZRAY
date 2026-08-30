import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId, deviceKey } = await request.json();

    if (!userId || !deviceKey) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update last_active_at perangkat ini
    await supabase
      .from("device_sessions")
      .update({ last_active_at: now })
      .eq("user_id", userId)
      .eq("device_key", deviceKey);

    // Cek apakah perangkat ini adalah perangkat utama (is_primary = true)
    const { data: sessionData } = await supabase
      .from("device_sessions")
      .select("is_primary")
      .eq("user_id", userId)
      .eq("device_key", deviceKey)
      .single();

    let pendingRequest = null;
    if (sessionData?.is_primary) {
      // Cek apakah ada request login dengan status waiting untuk user ini
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

    // Jika perangkat ini bukan utama tetapi sesi utamanya sudah logged_out / tidak aktif,
    // promosikan perangkat ini menjadi utama agar notifikasi tidak buntu
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

    return NextResponse.json({ success: true, pendingRequest });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

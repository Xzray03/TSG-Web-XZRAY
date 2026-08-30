import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId, deviceKey } = await request.json();

    if (!userId || !deviceKey) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Ambil sesi perangkat yang akan logout
    const { data: session } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("device_key", deviceKey)
      .single();

    if (session) {
      // Set status logged_out atau hapus
      await supabase
        .from("device_sessions")
        .update({ status: "logged_out" })
        .eq("id", session.id);

      // Jika perangkat ini adalah utama, promosikan sesi berikutnya menjadi utama
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

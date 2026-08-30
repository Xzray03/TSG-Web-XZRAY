import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { requestId, decision, userId, requesterDeviceInfo } = await request.json();

    if (!requestId || !decision) {
      return NextResponse.json({ error: "Missing requestId or decision" }, { status: 400 });
    }

    // Update status login request
    await supabase
      .from("login_requests")
      .update({ status: decision }) // 'approved' atau 'rejected'
      .eq("id", requestId);

    // Jika disetujui, daftarkan perangkat baru ke device_sessions sebagai perangkat sekunder
    if (decision === "approved" && userId) {
      await supabase.from("device_sessions").insert({
        user_id: userId,
        device_key: 'dev_req_' + Math.random().toString(36).substring(2),
        device_info: requesterDeviceInfo || {},
        is_primary: false,
        last_active_at: new Date().toISOString(),
        status: "active"
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

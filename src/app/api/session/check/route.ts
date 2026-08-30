import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId, deviceKey, deviceInfo } = await request.json();

    if (!userId || !deviceKey) {
      return NextResponse.json({ error: "Missing userId or deviceKey" }, { status: 400 });
    }

    const now = new Date();

    // 1. Ambil semua sesi aktif untuk akun ini
    const { data: existingSessions, error: fetchError } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Supabase device_sessions fetch error:", fetchError);
      return NextResponse.json({ 
        status: "rejected", 
        message: "Tabel Supabase belum siap. Jalankan script SUPABASE_SETUP.sql." 
      }, { status: 500 });
    }

    // 2. Jika perangkat ini sudah terdaftar di sesi aktif
    const currentDeviceSession = existingSessions?.find(s => s.device_key === deviceKey);
    if (currentDeviceSession) {
      await supabase
        .from("device_sessions")
        .update({ last_active_at: now.toISOString() })
        .eq("id", currentDeviceSession.id);

      return NextResponse.json({ status: "allowed", isPrimary: currentDeviceSession.is_primary });
    }

    // 3. Jika BELUM ADA sesi sama sekali (Login pertama kali / akun bersih)
    if (!existingSessions || existingSessions.length === 0) {
      await supabase.from("device_sessions").insert({
        user_id: userId,
        device_key: deviceKey,
        device_info: deviceInfo || {},
        is_primary: true,
        last_active_at: now.toISOString(),
        status: "active"
      });
      return NextResponse.json({ status: "allowed", isPrimary: true });
    }

    // 4. SUDAH ADA perangkat lain yang login! Cek apakah perangkat utama (urutan pertama) online (aktif dalam 3-10 menit terakhir)
    const primarySession = existingSessions[0];
    const lastActivePrimary = new Date(primarySession.last_active_at).getTime();
    const diffMinutes = (now.getTime() - lastActivePrimary) / (1000 * 60);

    // Jika perangkat utama offline (> 10 menit tidak aktif / heartbeat)
    if (diffMinutes > 10) {
      return NextResponse.json({ 
        status: "rejected", 
        message: "Perangkat utama sedang offline (tidak aktif). Perangkat utama wajib online untuk memberikan persetujuan login." 
      }, { status: 403 });
    }

    // 5. Perangkat utama online! Buat / cek login_requests yang berstatus waiting agar perangkat utama menerima notifikasi
    // Cek apakah sudah ada request waiting yang sama dari device info ini agar tidak spam duplikat
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
          status: "waiting"
        })
        .select()
        .single();

      if (reqError) {
        return NextResponse.json({ error: "Gagal membuat permintaan login" }, { status: 500 });
      }
      activeReqId = newReq.id;
    }

    return NextResponse.json({ 
      status: "waiting", 
      requestId: activeReqId,
      message: "Menunggu persetujuan dari perangkat utama..." 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
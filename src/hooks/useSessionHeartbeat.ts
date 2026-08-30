"use client";

import React, { useEffect } from "react";
import { getOrCreateDeviceKey } from "@/lib/deviceKeyManager";

export function useSessionHeartbeat(userId: string | null, onPendingLogin?: (requestData: any) => void) {
  useEffect(() => {
    if (!userId) return;

    const deviceKey = getOrCreateDeviceKey();

    // Kirim heartbeat setiap 10 menit (atau 30 detik untuk demo responsif)
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/session/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, deviceKey })
        });
        const data = await res.json();
        if (data.pendingRequest && onPendingLogin) {
          onPendingLogin(data.pendingRequest);
        }
      } catch (e) {
        console.error("Heartbeat error:", e);
      }
    }, 30000); // 30 detik pengecekan ping/heartbeat aktif

    return () => clearInterval(interval);
  }, [userId, onPendingLogin]);
}

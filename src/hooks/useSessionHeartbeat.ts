"use client";

import { useEffect, useRef } from "react";
import { sessionHeartbeatAction } from "@/actions/sessionActions";

/**
 * Denyut perangkat setiap 30 detik selama pengguna login (sesi dicek server).
 * Perangkat utama menerima daftar permintaan login perangkat baru lewat onPendingLogin.
 */
export function useSessionHeartbeat(isLoggedIn: boolean, onPendingLogin?: (requestData: any) => void) {
  const cb = useRef(onPendingLogin);
  cb.current = onPendingLogin;

  useEffect(() => {
    if (!isLoggedIn) return;
    let stopped = false;

    const beat = async () => {
      try {
        const data: any = await sessionHeartbeatAction();
        if (stopped || !data || data.error) return;
        const first = Array.isArray(data.pendingRequests) ? data.pendingRequests[0] : null;
        if (first && cb.current) cb.current({ ...first, id: first.deviceId });
      } catch (e) {
        console.error("Heartbeat error:", e);
      }
    };

    beat();
    const interval = setInterval(beat, 30000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [isLoggedIn]);
}

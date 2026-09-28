"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { respondVerificationAction } from "@/actions/tsgVerifActions";

export function TsgVerificationCard({ payload, currentUserId, isCreator }: { payload: any; currentUserId: string; isCreator: boolean }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const verificationId = payload.verificationId || "";
  const status = payload.status || "pending";
  const snapshotUrl = payload.snapshotUrl || "";
  const name = payload.name || "Member";
  const generation = payload.generation || "Member";
  const deviceInfo = payload.browser || payload.deviceId || "-";
  const respondedBy = payload.respondedByUsername || "";

  const handleRespond = async (action: "approve" | "reject") => {
    if (isProcessing) return;
    if (!verificationId) return;
    setIsProcessing(true);
    try {
      await respondVerificationAction({
        verificationId,
        responderUserId: currentUserId,
        responderUsername: payload?.responderUsername || "Creator",
        action,
      });
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-200">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Permohonan Pendaftaran Anggota
      </div>

      <div className="space-y-1.5">
        <p><span className="text-white/50">Nama:</span> <span className="font-semibold text-white">{name}</span></p>
        <p><span className="text-white/50">Generasi:</span> <span className="font-semibold text-white">{generation}</span></p>
        <p><span className="text-white/50">Device:</span> <span className="font-medium text-white/80">{deviceInfo}</span></p>

        {snapshotUrl ? (
          <div className="pt-2">
            <div className="relative h-32 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900">
              <Image
                src={snapshotUrl}
                alt={`Snapshot ${name}`}
                fill
                className="object-cover"
                crossOrigin="anonymous"
              />
            </div>
          </div>
        ) : null}
      </div>

      {status === "pending" ? (
        isCreator ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleRespond("approve")}
              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Setuju
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleRespond("reject")}
              className="flex items-center justify-center gap-1 rounded-xl bg-rose-500 px-3 py-2 font-bold text-white transition hover:bg-rose-400 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Tolak
            </button>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-center text-[11px] text-white/60">
            Menunggu keputusan akun Creator.
          </p>
        )
      ) : (
        <p className={`mt-3 rounded-xl px-3 py-2 text-center text-[11px] font-bold ${status === "approved" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
          {status === "approved" ? `Disetujui oleh @${respondedBy || "creator"}` : status === "expired" ? "Ditolak otomatis karena timeout" : `Ditolak oleh @${respondedBy || "creator"}`}
        </p>
      )}
    </div>
  );
}

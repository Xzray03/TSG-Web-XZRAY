"use client";

import React from "react";
import { ShieldAlert, Check, X } from "lucide-react";

export default function DeviceApprovalModal({
  requestData,
  onRespond,
}: {
  requestData: any;
  onRespond: (decision: "approved" | "rejected") => void;
}) {
  if (!requestData) return null;

  const info = requestData.requester_device_info || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-red-500/50 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center space-x-3 text-red-400 mb-4">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
          <h3 className="text-xl font-bold tracking-tight">Permintaan Login Baru</h3>
        </div>

        <p className="text-slate-300 text-sm mb-4 leading-relaxed">
          Perangkat lain mencoba masuk ke akun Anda. Karena akun Anda sudah aktif di perangkat ini, persetujuan Anda diperlukan untuk melanjutkan.
        </p>

        <div className="bg-slate-800/80 rounded-xl p-4 text-xs space-y-2 mb-6 border border-slate-700">
          <div className="flex justify-between">
            <span className="text-slate-400">Platform:</span>
            <span className="font-medium text-slate-200">{info.platform || "Unknown"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Browser/UA:</span>
            <span className="font-medium text-slate-200 truncate max-w-[200px]" title={info.userAgent}>
              {info.userAgent || "Unknown"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Resolusi Layar:</span>
            <span className="font-medium text-slate-200">{info.screen || "Unknown"}</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => onRespond("rejected")}
            className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-lg shadow-red-600/30 cursor-pointer"
          >
            <X className="w-5 h-5" />
            <span>Tolak</span>
          </button>
          <button
            onClick={() => onRespond("approved")}
            className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <Check className="w-5 h-5" />
            <span>Setuju</span>
          </button>
        </div>
      </div>
    </div>
  );
}

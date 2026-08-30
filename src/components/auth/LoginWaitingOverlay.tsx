"use client";

import React from "react";
import { Loader2, ShieldAlert } from "lucide-react";

export default function LoginWaitingOverlay({
  message = "Menunggu persetujuan dari perangkat utama...",
  onCancel,
}: {
  message?: string;
  onCancel?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-sm w-full p-6 text-white text-center shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
        
        <h3 className="text-lg font-bold text-amber-400 mb-2">Status: WAITING</h3>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          {message}
        </p>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors border border-slate-700 cursor-pointer"
          >
            Batalkan Login
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { Camera, Lock, X, ShieldCheck } from "lucide-react";

interface AuthMethodChoiceModalProps {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
  onSelectMethod: (method: "face" | "password") => void;
}

export default function AuthMethodChoiceModal({
  isOpen,
  userName,
  onClose,
  onSelectMethod,
}: AuthMethodChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">Pendaftaran Akun Baru</h3>
          <p className="text-sm text-white/70">
            Halo{" "}
            <span className="font-semibold text-emerald-400">{userName}</span>,
            akun Anda belum terdaftar. Silakan pilih metode autentikasi yang
            ingin digunakan:
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            onClick={() => onSelectMethod("face")}
            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/30 hover:border-emerald-400 hover:scale-[1.02] transition text-left group"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30 transition">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-white group-hover:text-emerald-300 transition">
                Verifikasi Wajah
              </div>
              <p className="text-xs text-white/60">
                Pindai data wajah & liveness untuk login tanpa password di masa
                mendatang.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectMethod("password")}
            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-900/80 border border-white/15 hover:border-blue-400 hover:scale-[1.02] transition text-left group"
          >
            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-white group-hover:text-blue-300 transition">
                Gunakan Password
              </div>
              <p className="text-xs text-white/60">
                Buat password minimal 12 karakter (kombinasi huruf, angka &
                simbol).
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

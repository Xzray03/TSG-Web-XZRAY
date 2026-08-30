"use client";

import React from "react";
import { LogOut, Trash2, X, ShieldAlert } from "lucide-react";

interface LogoutChoiceModalProps {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
  onSelectLogoutOnly: () => void;
  onSelectDeleteAccount: () => void;
}

export default function LogoutChoiceModal({
  isOpen,
  userName,
  onClose,
  onSelectLogoutOnly,
  onSelectDeleteAccount,
}: LogoutChoiceModalProps) {
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
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">Opsi Keluar Profil</h3>
          <p className="text-sm text-white/70">
            Pilih tindakan yang ingin Anda lakukan untuk akun <span className="font-semibold text-emerald-400">{userName}</span>:
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            onClick={onSelectLogoutOnly}
            className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/80 border border-white/15 hover:border-blue-400 hover:scale-[1.02] transition text-left group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition shrink-0">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-white group-hover:text-blue-300 transition">
                Keluar Saja (Logout)
              </div>
              <p className="text-xs text-white/60">
                Mengakhiri sesi saat ini. Akun & data Anda tetap tersimpan di database.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSelectDeleteAccount}
            className="flex items-center gap-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 hover:border-rose-400 hover:scale-[1.02] transition text-left group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 group-hover:bg-rose-500/30 transition shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-rose-300 group-hover:text-rose-200 transition">
                Hapus Akun Permanen
              </div>
              <p className="text-xs text-rose-300/60">
                Menghapus seluruh akun beserta histori data secara permanen.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

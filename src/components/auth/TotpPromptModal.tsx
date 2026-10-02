"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertCircle, Loader2, X, KeyRound } from "lucide-react";

interface TotpPromptModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string;
  onSubmit: (code: string) => void;
  onClose: () => void;
}

/**
 * Modal input kode TOTP / recovery code untuk gate aksi sensitif & login.
 * Dipakai di ManageAccountModal (changePassword, setEmail, addFace, loginPeferences, delete) dan login flow.
 */
export default function TotpPromptModal({
  isOpen,
  title = "Verifikasi 2FA Diperlukan",
  subtitle = "Masukkan kode dari aplikasi authenticator atau recovery code",
  isLoading = false,
  error,
  onSubmit,
  onClose,
}: TotpPromptModalProps) {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"totp" | "recovery">("totp");

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setMode("totp");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = mode === "recovery" ? code.trim() : code.trim();
    if (!normalized) return;
    onSubmit(normalized);
  };

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative my-auto w-full max-w-sm sm:max-w-md rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-2xl border shrink-0 ${mode === "recovery" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
            {mode === "recovery" ? <KeyRound className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{mode === "recovery" ? "Masukkan Recovery Code" : title}</h3>
            <p className="text-xs text-white/60">{mode === "recovery" ? "Format: XXXX-XXXX-XXXX (sekali pakai)" : subtitle}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3 rounded-xl border border-rose-900/50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "totp" ? (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              autoFocus
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-center text-lg tracking-[0.5em] font-mono text-white placeholder-white/20 focus:border-blue-400 focus:outline-none"
            />
          ) : (
            <input
              type="text"
              autoComplete="off"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoFocus
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-center text-sm tracking-widest font-mono text-white placeholder-white/20 focus:border-amber-400 focus:outline-none"
            />
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Verifikasi</span>}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "totp" ? "recovery" : "totp")}
          className="w-full mt-3 text-[11px] text-white/40 hover:text-white/70 transition cursor-pointer"
        >
          {mode === "totp" ? "Gunakan recovery code" : "Gunakan kode authenticator"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 text-[11px] text-white/30 hover:text-white/50 transition cursor-pointer"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Copy, Check, X, AlertTriangle } from "lucide-react";

interface TotpRecoveryCodesModalProps {
  isOpen: boolean;
  codes: string[];
  onClose: () => void;
}

/**
 * Menampilkan 10 recovery code SATU KALI. Tombol X memicu dialog peringatan
 * bahwa kode tidak akan pernah ditampilkan lagi (tombol Kembali & Tutup).
 */
export default function TotpRecoveryCodesModal({ isOpen, codes, onClose }: TotpRecoveryCodesModalProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopiedIdx(null);
      setAllCopied(false);
      setShowConfirmClose(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyCode = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {}
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[1000001] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative my-auto w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-emerald-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
        <button
          type="button"
          onClick={() => setShowConfirmClose(true)}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">2FA Aktif!</h3>
            <p className="text-xs text-white/60">Simpan 10 recovery code berikut</p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 text-amber-300 text-xs bg-amber-950/50 p-3.5 rounded-xl border border-amber-500/30">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Kode ini <b>tidak akan pernah ditampilkan lagi</b> setelah modal ditutup. Simpan di tempat aman.
            Setiap kode hanya bisa dipakai <b>satu kali</b>.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {codes.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => copyCode(c, i)}
              title="Klik untuk salin"
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer group"
            >
              <code className="text-xs font-mono text-emerald-300 select-all">{c}</code>
              {copiedIdx === i ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 shrink-0" />
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={copyAll}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-xs text-white/80 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            {allCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{allCopied ? "Tersalin" : "Salin Semua"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmClose(true)}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition cursor-pointer"
          >
            Saya Sudah Menyimpan
          </button>
        </div>
      </div>

      {/* Dialog peringatan saat tombol X / "Saya Sudah Menyimpan" ditekan */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-[1000002] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-5 shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold">Recovery code tidak akan pernah ditampilkan lagi</p>
            </div>
            <p className="text-xs text-white/70 leading-relaxed mb-4">
              Setelah modal ditutup, 10 recovery code di atas{" "}
              <b className="text-rose-300">tidak bisa dilihat kembali</b> (tersimpan hanya sebagai hash).
              Pastikan sudah disimpan di tempat aman.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-xs text-white/80 transition cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

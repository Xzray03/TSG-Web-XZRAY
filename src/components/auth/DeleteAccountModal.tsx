"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  AlertTriangle,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  CanvasCaptcha,
  CanvasCaptchaRef,
} from "@/components/auth/CanvasCaptcha";

interface DeleteAccountModalProps {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
  onAccountDeleted: () => void;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respon server tidak valid (${res.status}). Mohon coba beberapa saat lagi.`);
  }
}

export default function DeleteAccountModal({
  isOpen,
  userName,
  onClose,
  onAccountDeleted,
}: DeleteAccountModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [captchaInput, setCaptchaInput] = useState("");
  const [expectedCaptcha, setExpectedCaptcha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const captchaRef = useRef<CanvasCaptchaRef>(null);

  useEffect(() => {
    setStep(1);
    setCaptchaInput("");
    setErrorMsg("");
    setIsLoading(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNextStep1 = () => {
    setErrorMsg("");
    setStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMsg("");
    setStep(3);
  };

  const handleFinalDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (
      !captchaInput.trim() ||
      captchaInput.trim().toUpperCase() !== expectedCaptcha.toUpperCase()
    ) {
      setErrorMsg("Kode Captcha tidak sesuai. Silakan coba lagi.");
      captchaRef.current?.refresh();
      setCaptchaInput("");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "delete_account",
          name: userName,
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus akun secara permanen.");
      }

      onAccountDeleted();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menghapus akun.");
      captchaRef.current?.refresh();
      setCaptchaInput("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-rose-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(225,29,72,0.3)] text-white scrollbar-thin">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header Indicator Step */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-widest text-rose-400 uppercase bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/40">
              PERINGATAN {step} DARI 3
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Penghapusan Akun
            </h3>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3.5 rounded-xl border border-rose-900/50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-2 text-xs leading-relaxed text-rose-200/90">
              <p className="font-bold text-rose-300 text-sm">
                Menghapus Seluruh Data Akun
              </p>
              <p>
                Tindakan ini akan menghapus akun{" "}
                <span className="font-bold text-white">{userName}</span> secara
                menyeluruh dari database, termasuk data autentikasi, histori
                vektor wajah, dan data lainnya.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-xs text-white/80 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleNextStep1}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <span>Lanjutkan (1/3)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 space-y-2 text-xs leading-relaxed text-rose-200">
              <p className="font-bold text-rose-300 text-sm">
                Tidak Dapat Dibatalkan!
              </p>
              <p>
                Perhatian: Proses penghapusan ini bersifat{" "}
                <span className="font-bold text-rose-400 underline">
                  PERMANEN
                </span>
                . Setelah dihapus, data akun Anda tidak dapat dipulihkan atau
                dibangkitkan kembali dengan cara apapun.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-xs text-white/80 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleNextStep2}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <span>Saya Mengerti (2/3)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <form onSubmit={handleFinalDelete} className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/60 space-y-2 text-xs leading-relaxed text-rose-100">
              <p className="font-bold text-rose-300 text-sm">
                Pernyataan Kesadaran Penuh
              </p>
              <p>
                Saya menyatakan dengan sadar bahwa saya hendak menghapus akun{" "}
                <span className="font-bold text-white">{userName}</span> secara
                permanen dan menyetujui penghapusan seluruh data.
              </p>
            </div>

            <div className="space-y-2 pt-1 border-t border-white/10">
              <label className="text-xs font-medium text-white/80">
                Masukkan Captcha Konfirmasi
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <CanvasCaptcha
                  ref={captchaRef}
                  onCodeChange={setExpectedCaptcha}
                />
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Kode Captcha"
                  required
                  className="flex-1 px-4 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-rose-400 uppercase tracking-widest text-center font-mono transition"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-xs text-white/80 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-rose-600/40 transition disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>HAPUS PERMANEN AKUN</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

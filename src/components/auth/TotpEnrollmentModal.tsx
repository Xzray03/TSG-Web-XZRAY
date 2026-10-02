"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Check,
  X,
  Copy,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  enableTotpStartAction,
  rotateTotpSecretAction,
  verifyTotpAction,
} from "@/actions/authActions";
import { getStepUpProof } from "@/lib/stepUp";
import { generateQRSvg } from "@/lib/qr";
import TotpRecoveryCodesModal from "@/components/auth/TotpRecoveryCodesModal";

interface TotpEnrollmentModalProps {
  isOpen: boolean;
  userName: string;
  hasPassword: boolean;
  onClose: () => void;
  onActivated: () => void;
}

export default function TotpEnrollmentModal({
  isOpen,
  userName,
  hasPassword,
  onClose,
  onActivated,
}: TotpEnrollmentModalProps) {
  const [step, setStep] = useState<"warning" | "password" | "scan" | "recovery" | "scan-password-skip">("warning");
  const [password, setPassword] = useState("");
  const [secretBase32, setSecretBase32] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const timerRef = useRef<any>(null);

  // Reset saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setStep("warning");
      setPassword("");
      setSecretBase32("");
      setOtpauthUrl("");
      setCode("");
      setCountdown(30);
      setIsLoading(false);
      setErrorMsg("");
      setSuccessMsg("");
      setRecoveryCodes([]);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen]);

  // Countdown 30 detik → rotasi secret otomatis
  useEffect(() => {
    if (!isOpen || step !== "scan") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setCountdown(30);
    timerRef.current = setInterval(async () => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Waktu habis → rotasi secret
          void handleRotate();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, step, secretBase32]);

  const handleStartEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (hasPassword && !password) {
      setErrorMsg("Masukkan password saat ini untuk melanjutkan.");
      return;
    }
    setIsLoading(true);
    try {
      const proof = await getStepUpProof("enable_totp");
      const data: any = await enableTotpStartAction({ password: password || undefined, proof });
      if (!data?.success) {
        throw new Error(data?.error || "Gagal memulai enrollment 2FA.");
      }
      setSecretBase32(data.secretBase32);
      setOtpauthUrl(data.otpauthUrl);
      setStep("scan");
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotate = async () => {
    setIsRotating(true);
    try {
      const data: any = await rotateTotpSecretAction();
      if (data?.success) {
        setSecretBase32(data.secretBase32);
        setOtpauthUrl(data.otpauthUrl);
        setCode("");
        setCountdown(30);
        setSuccessMsg("QR Code & Setup Key diperbarui (secret lama dibatalkan).");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else if (data?.code === "TOTP_VERIFIED") {
        // Sudah terverifikasi di tab lain — tutup
        onActivated();
        onClose();
      }
    } catch (err: any) {
      // diamkan rotasi gagal jaringan; timer akan coba lagi
    } finally {
      setIsRotating(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMsg("Masukkan 6 digit kode TOTP dari aplikasi authenticator.");
      return;
    }
    setIsLoading(true);
    try {
      const data: any = await verifyTotpAction({ code: code.trim() });
      if (!data?.success) {
        if (data?.code === "TOTP_EXPIRED") {
          // Secret kadaluarsa → rotasi lalu minta kode baru
          await handleRotate();
          throw new Error("Waktu 30 detik habis. Secret baru dibuat — scan ulang lalu masukkan kode baru.");
        }
        throw new Error(data?.error || "Verifikasi gagal.");
      }
      setRecoveryCodes(data.recoveryCodes || []);
      setStep("recovery");
      if (timerRef.current) clearInterval(timerRef.current);
      onActivated();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const qrSvg = otpauthUrl ? generateQRSvg(otpauthUrl, 200) : "";

  return (
    <>
      <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
        <div className="relative my-auto w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-amber-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3.5 rounded-xl border border-rose-900/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 flex items-center gap-2 text-emerald-300 text-xs bg-emerald-950/60 p-3.5 rounded-xl border border-emerald-500/30">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP: WARNING */}
          {step === "warning" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Aktifkan 2FA</h3>
                  <p className="text-xs text-white/60">Autentikasi dua faktor untuk <span className="font-semibold text-emerald-400">{userName}</span></p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2 text-xs leading-relaxed text-amber-200/90">
                <p className="font-bold text-amber-300 text-sm">Peringatan Penting</p>
                <p>
                  Setelah 2FA ditambahkan, aplikasi authenticator akan menjadi{" "}
                  <span className="font-bold text-white">verifikasi penting</span> untuk setiap login
                  dan aksi sensitif (ganti password, email, wajah, metode login, hapus akun).
                </p>
                <p>
                  Simpan <span className="font-bold text-white">10 recovery code</span> yang akan
                  ditampilkan setelah verifikasi — kode tersebut{" "}
                  <span className="font-bold text-white">tidak akan pernah ditampilkan lagi</span> setelah
                  modal ditutup, dan masing-masing hanya bisa dipakai{" "}
                  <span className="font-bold text-white">satu kali</span>.
                </p>
                <p>Tidak ada jalur bantuan / pemulihan lain bila authenticator dan recovery code hilang.</p>
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
                  onClick={() => setStep(hasPassword ? "password" : "scan-password-skip")}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-xs text-white transition cursor-pointer"
                >
                  Saya Mengerti, Lanjutkan
                </button>
              </div>
            </div>
          )}

          {/* STEP: PASSWORD (hanya bila akun punya password) */}
          {step === "password" && (
            <form onSubmit={handleStartEnroll} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <KeyRound className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Verifikasi Identitas</h3>
                  <p className="text-xs text-white/60">Masukkan password saat ini</p>
                </div>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password saat ini"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:border-amber-400 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("warning")}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-xs text-white/80 transition cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Mulai Enrollment</span>}
                </button>
              </div>
            </form>
          )}

          {/* STEP: SCAN (lanjutkan otomatis bila face-only — password skip, mulai enroll langsung) */}
          {(step === "scan" || step === "scan-password-skip") && (
            <ScanStep
              countdown={countdown}
              qrSvg={qrSvg}
              secretBase32={secretBase32}
              code={code}
              setCode={setCode}
              isLoading={isLoading}
              isRotating={isRotating}
              onVerify={handleVerify}
              onRotate={handleRotate}
              onAutoStart={step === "scan-password-skip" ? handleStartEnroll : undefined}
            />
          )}
        </div>
      </div>

      {/* Modal recovery code — ditampilkan setelah verifikasi berhasil */}
      <TotpRecoveryCodesModal
        isOpen={step === "recovery"}
        codes={recoveryCodes}
        onClose={() => {
          setStep("warning");
          onClose();
        }}
      />
    </>
  );
}

function ScanStep({
  countdown,
  qrSvg,
  secretBase32,
  code,
  setCode,
  isLoading,
  isRotating,
  onVerify,
  onRotate,
  onAutoStart,
}: {
  countdown: number;
  qrSvg: string;
  secretBase32: string;
  code: string;
  setCode: (v: string) => void;
  isLoading: boolean;
  isRotating: boolean;
  onVerify: (e: React.FormEvent) => void;
  onRotate: () => void;
  onAutoStart?: (e: React.FormEvent) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (onAutoStart && !secretBase32) {
      onAutoStart({ preventDefault: () => {} } as React.FormEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(secretBase32);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Countdown di atas tengah modal */}
      <div className="flex flex-col items-center gap-1">
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-bold tabular-nums ${countdown <= 5 ? "bg-rose-950/60 border-rose-500/40 text-rose-300" : "bg-white/5 border-white/15 text-white/80"}`}>
          {isRotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{countdown}s</span>}
        </div>
        <p className="text-[11px] text-white/50">QR & Setup Key diperbarui otomatis tiap 30 detik</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Pindai QR Code</h3>
          <p className="text-xs text-white/60">Google Authenticator / Authy / 1Password</p>
        </div>
      </div>

      {qrSvg ? (
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-2xl" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>
      ) : (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      )}

      {/* Setup Key */}
      <div>
        <label className="block text-[11px] font-medium text-white/70 mb-1">Setup Key (input manual)</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-xs text-white font-mono break-all select-all">
            {secretBase32 || "Memuat..."}
          </code>
          <button
            type="button"
            onClick={copyKey}
            title="Salin Setup Key"
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/70 hover:text-white transition cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <form onSubmit={onVerify} className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-white/70 mb-1">Kode 6 Digit dari Authenticator</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-center text-lg tracking-[0.5em] font-mono text-white placeholder-white/20 focus:border-amber-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !secretBase32}
          className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Verifikasi & Aktifkan 2FA</span>}
        </button>
      </form>

      <button
        type="button"
        onClick={onRotate}
        disabled={isRotating}
        className="w-full text-[11px] text-white/40 hover:text-white/70 flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <RefreshCw className={`w-3 h-3 ${isRotating ? "animate-spin" : ""}`} />
        <span>Generate ulang sekarang</span>
      </button>
    </div>
  );
}

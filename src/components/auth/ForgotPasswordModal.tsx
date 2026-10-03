"use client";

import React, { useState, useRef } from "react";
import { KeyRound, Camera, CheckCircle2, X, Loader2, AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { CanvasCaptcha, CanvasCaptchaRef } from "@/components/auth/CanvasCaptcha";
import TotpPromptModal from "@/components/auth/TotpPromptModal";
import FaceVerificationModal from "@/components/auth/FaceVerificationModal";
import { resetPasswordWithFaceAction } from "@/actions/authActions";
import { getStepUpProof } from "@/lib/stepUp";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  userName: string;
  hasTotp: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "face" | "newpass";

export default function ForgotPasswordModal({ isOpen, userName, hasTotp, onClose, onSuccess }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>("face");
  const [isFaceOpen, setIsFaceOpen] = useState(false);
  const [faceToken, setFaceToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [expectedCaptcha, setExpectedCaptcha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isTotpOpen, setIsTotpOpen] = useState(false);
  const [totpError, setTotpError] = useState("");
  const [isTotpSubmitting, setIsTotpSubmitting] = useState(false);
  const captchaRef = useRef<CanvasCaptchaRef>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep("face");
    setFaceToken("");
    setNewPassword("");
    setConfirmPassword("");
    setCaptchaInput("");
    setIsSubmitting(false);
    setErrorMsg("");
    setIsTotpOpen(false);
    setTotpError("");
  };

  const handleClose = () => {
    resetState();
    setIsFaceOpen(false);
    onClose();
  };

  const handleFaceVerified = (result: any) => {
    const token = result?.faceVerifiedToken;
    if (!token) {
      setErrorMsg("Verifikasi wajah gagal. Coba lagi.");
      return;
    }
    setFaceToken(token);
    setIsFaceOpen(false);
    setStep("newpass");
    setErrorMsg("");
  };

  const validateNew = (): string => {
    if (!faceToken) return "Verifikasi wajah terlebih dahulu.";
    if (newPassword !== confirmPassword) return "Konfirmasi password baru tidak cocok.";
    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== expectedCaptcha.toUpperCase()) {
      return "Kode Captcha tidak sesuai. Silakan coba lagi.";
    }
    return "";
  };

  const doReset = async (totpCode?: string) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const proof = await getStepUpProof("reset_password");
      const data: any = await resetPasswordWithFaceAction({
        faceVerifiedToken: faceToken,
        newPassword,
        proof,
        totpCode,
      });
      if (!data?.success) {
        // TOTP gate dari server → buka prompt TOTP
        if (data?.code === "TOTP_REQUIRED" || data?.code === "TOTP_INVALID") {
          setTotpError(data?.error || "");
          setIsTotpOpen(true);
          setIsSubmitting(false);
          return;
        }
        // Token wajah kedaluwarsa → kembali ke langkah wajah
        if (data?.code === "FACE_REQUIRED" || data?.code === "FACE_INVALID") {
          setFaceToken("");
          setStep("face");
          throw new Error(data?.error || "Verifikasi wajah ulang diperlukan.");
        }
        throw new Error(data?.error || "Gagal memperbarui password.");
      }
      setIsTotpOpen(false);
      resetState();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
      captchaRef.current?.refresh();
      setCaptchaInput("");
      setIsSubmitting(false);
    }
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateNew();
    if (v) {
      setErrorMsg(v);
      if (v.includes("Captcha")) {
        captchaRef.current?.refresh();
        setCaptchaInput("");
      }
      return;
    }
    if (hasTotp) {
      setTotpError("");
      setIsTotpOpen(true);
      return;
    }
    await doReset();
  };

  const handleTotpSubmit = async (code: string) => {
    setIsTotpSubmitting(true);
    setTotpError("");
    try {
      await doReset(code);
    } finally {
      setIsTotpSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
        <div className="relative my-auto w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Lupa Password</h3>
              <p className="text-[11px] text-white/60">
                Reset password akun <span className="font-semibold text-emerald-400">{userName}</span> via verifikasi wajah
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3.5 rounded-xl border border-rose-900/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: verifikasi wajah */}
          {step === "face" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs leading-relaxed text-amber-200/90">
                Untuk keamanan, reset password memerlukan verifikasi wajah AI
                {hasTotp ? " dan kode 2FA" : ""}. Sesi lain akan dicabut setelah password diperbarui.
              </div>
              <button
                type="button"
                onClick={() => setIsFaceOpen(true)}
                className="w-full py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Verifikasi Wajah AI</span>
              </button>
            </div>
          )}

          {/* STEP 2: password baru + captcha */}
          {step === "newpass" && (
            <form onSubmit={handleSubmitNew} className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 text-xs bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="flex-1">Wajah terverifikasi ✓</span>
                <button
                  type="button"
                  onClick={() => {
                    setFaceToken("");
                    setStep("face");
                  }}
                  className="text-[11px] text-amber-300 underline cursor-pointer"
                >
                  Ulangi
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-white/70 mb-1">
                  Password Baru (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-white/15 bg-slate-800/80 px-3.5 py-2 pr-10 text-xs text-white placeholder-white/30 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-white/50 hover:text-white cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-white/70 mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-white/15 bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-white/10">
                <label className="text-xs font-medium text-white/80">Masukkan Captcha Konfirmasi</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <CanvasCaptcha ref={captchaRef} onCodeChange={setExpectedCaptcha} />
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="Kode Captcha"
                    required
                    className="flex-1 px-4 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400 uppercase tracking-widest text-center font-mono transition"
                  />
                </div>
              </div>

              {hasTotp && (
                <p className="text-[11px] text-white/50">Setelah menekan tombol: Anda akan diminta kode 2FA.</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Perbarui Password</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Modal verifikasi wajah: hanya STATUS token yang keluar */}
      <FaceVerificationModal
        isOpen={isFaceOpen}
        mode="reauth"
        reauthAction="password_reset"
        initialName={userName}
        onClose={() => setIsFaceOpen(false)}
        onVerified={handleFaceVerified}
      />

      <TotpPromptModal
        isOpen={isTotpOpen}
        title="Reset Password via Wajah"
        subtitle="Masukkan kode 6 digit dari aplikasi authenticator atau recovery code"
        isLoading={isTotpSubmitting}
        error={totpError}
        onSubmit={handleTotpSubmit}
        onClose={() => {
          setIsTotpOpen(false);
          setTotpError("");
        }}
      />
    </>
  );
}

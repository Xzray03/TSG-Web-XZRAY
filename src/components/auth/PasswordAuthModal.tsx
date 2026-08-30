"use client";

import React, { useState, useRef, useEffect } from "react";
import { Lock, KeyRound, Check, X, AlertCircle, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { CanvasCaptcha, CanvasCaptchaRef } from "@/components/auth/CanvasCaptcha";

interface PasswordAuthModalProps {
  isOpen: boolean;
  mode: "register" | "login";
  userName: string;
  isTsgMember: boolean;
  tsgInfo?: any;
  onClose: () => void;
  onSuccess: (profileData: any) => void;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respon server tidak valid (${res.status}). Mohon coba beberapa saat lagi.`);
  }
}

export default function PasswordAuthModal({
  isOpen,
  mode,
  userName,
  isTsgMember,
  tsgInfo,
  onClose,
  onSuccess,
}: PasswordAuthModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [expectedCaptcha, setExpectedCaptcha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const captchaRef = useRef<CanvasCaptchaRef>(null);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setCaptchaInput("");
    setErrorMsg("");
    setShowPassword(false);
    setIsLoading(false);
  }, [isOpen]);

  if (!isOpen) return null;

  // Criteria checks for password
  const hasMinLength = password.length >= 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validate Captcha
    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== expectedCaptcha.toUpperCase()) {
      setErrorMsg("Kode Captcha tidak sesuai. Silakan coba lagi.");
      captchaRef.current?.refresh();
      setCaptchaInput("");
      return;
    }

    if (mode === "register") {
      if (!isPasswordValid) {
        setErrorMsg("Password belum memenuhi semua kriteria keamanan.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Konfirmasi password tidak cocok.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = "/api/auth";
      const body = {
        action: mode === "register" ? "register_password" : "login_password",
        name: userName,
        password: password,
        isTsgMember: isTsgMember,
        tsgInfo: tsgInfo,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify(body),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses autentikasi password.");
      }

      // Success
      const profile = {
        name: userName,
        isTsgMember: isTsgMember,
        generation: tsgInfo?.categoryName || "",
        email: tsgInfo?.email || "",
        authMethod: "password",
        iconDataUrl: tsgInfo?.photo || "",
      };

      localStorage.setItem("tsg_user_profile", JSON.stringify(profile));

      onSuccess(profile);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan pada server.");
      captchaRef.current?.refresh();
      setCaptchaInput("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">
              {mode === "register" ? "Buat Password Akun" : "Autentikasi Password"}
            </h3>
            <p className="text-xs text-white/60">User: <span className="text-emerald-400 font-semibold">{userName}</span></p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 p-3.5 rounded-xl border border-rose-900/50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/80">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                className="w-full pl-4 pr-10 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/80">Konfirmasi Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  required
                  className="w-full px-4 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition"
                />
              </div>

              <div className="p-3 bg-slate-800/50 rounded-xl border border-white/10 space-y-1 text-xs">
                <span className="text-white/60 font-medium block mb-1">Kriteria Password:</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-400" : "text-white/40"}`}>
                    <Check className="w-3.5 h-3.5" /> Min 12 Karakter
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpperCase ? "text-emerald-400" : "text-white/40"}`}>
                    <Check className="w-3.5 h-3.5" /> Huruf Besar (A-Z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLowerCase ? "text-emerald-400" : "text-white/40"}`}>
                    <Check className="w-3.5 h-3.5" /> Huruf Kecil (a-z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-400" : "text-white/40"}`}>
                    <Check className="w-3.5 h-3.5" /> Ada Angka (0-9)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSymbol ? "text-emerald-400" : "text-white/40"}`}>
                    <Check className="w-3.5 h-3.5" /> Ada Simbol (!@#$)
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Captcha Section */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <label className="text-xs font-medium text-white/80">Verifikasi Captcha</label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <CanvasCaptcha ref={captchaRef} onCodeChange={setExpectedCaptcha} />
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="Kode Captcha"
                required
                className="flex-1 px-4 py-2.5 bg-slate-800/80 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400 uppercase tracking-widest text-center font-mono transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === "register" ? (
              "Daftar"
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

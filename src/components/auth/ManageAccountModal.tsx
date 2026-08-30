"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Camera,
  KeyRound,
  ShieldCheck,
  UserCheck,
  LogOut,
  AlertCircle,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Mail,
  Edit3,
  Send,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface ManageAccountModalProps {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
  onSwitchAccount: () => void;
  onLogout: () => void;
  onRefreshProfile: () => void;
  onAddFaceTrigger: () => void;
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "";
  const [user, domain] = email.split("@");
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const first = user[0];
  const last = user[user.length - 1];
  const stars = "*".repeat(user.length - 2);
  return `${first}${stars}${last}@${domain}`;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respon server tidak valid (${res.status}). Mohon coba beberapa saat lagi.`);
  }
}

export default function ManageAccountModal({
  isOpen,
  userName,
  onClose,
  onSwitchAccount,
  onLogout,
  onRefreshProfile,
  onAddFaceTrigger,
}: ManageAccountModalProps) {
  const [hasPassword, setHasPassword] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isLoadingStatus, setIsLoadingLoadingStatus] = useState(false);

  // Login preference toggles
  const [loginPrefPassword, setLoginPrefPassword] = useState(true);
  const [loginPrefFace, setLoginPrefFace] = useState(true);
  const [loginPrefEmail, setLoginPrefEmail] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSuccessMsg, setPrefsSuccessMsg] = useState("");
  const [prefsErrorMsg, setPrefsErrorMsg] = useState("");

  // Form states
  const [activeForm, setActiveForm] = useState<
    "none" | "add_password" | "reset_password" | "add_email" | "change_email" | "login_prefs"
  >("none");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [currentPassForEmail, setCurrentPassForEmail] = useState("");

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showEmailPass, setShowEmailPass] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ConfirmationURL Pop-up states for Password Reset
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [confErrorMsg, setConfErrorMsg] = useState("");
  const [confSuccessMsg, setConfSuccessMsg] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const fetchStatus = async () => {
    if (!userName.trim()) return;
    setIsLoadingLoadingStatus(true);
    try {
      const res = await fetch(
        `/api/auth?action=check&name=${encodeURIComponent(userName.trim())}`,
        {
          headers: { "x-tsg-client-verify": "true" },
        }
      );
      const data = await parseJsonResponse(res);
      if (res.ok && data.exists) {
        setHasPassword(!!data.hasPassword);
        setHasFace(!!data.hasFace);
        setRegisteredEmail(data.email || "");
        if (data.loginPreferences) {
          setLoginPrefPassword(data.loginPreferences.password ?? true);
          setLoginPrefFace(data.loginPreferences.face ?? true);
          setLoginPrefEmail(data.loginPreferences.email ?? false);
        }
      }
    } catch (e) {
    } finally {
      setIsLoadingLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setActiveForm("none");
      setErrorMsg("");
      setSuccessMsg("");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewEmailInput("");
      setCurrentPassForEmail("");
      setIsConfirmationModalOpen(false);
    } else {
      setActiveForm("none");
      setErrorMsg("");
      setSuccessMsg("");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewEmailInput("");
      setCurrentPassForEmail("");
      setIsConfirmationModalOpen(false);
      onRefreshProfile();
    }
  }, [isOpen, userName]);

  useEffect(() => {
    setErrorMsg("");
    setSuccessMsg("");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewEmailInput("");
    setCurrentPassForEmail("");
  }, [activeForm]);

  // Countdown timer for Confirmation Link Resend
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Listen for ConfirmationURL magic link authentication automatically during password reset
  useEffect(() => {
    if (!isConfirmationModalOpen) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        await finalizePasswordResetAfterConfirmation();
      }
    });

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          await finalizePasswordResetAfterConfirmation();
        }
      } catch (e) {}
    }, 2500);

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [isConfirmationModalOpen, newPassword]);

  if (!isOpen) return null;

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "add_password",
          name: userName,
          newPassword,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menambahkan password.");
      }

      setSuccessMsg("Password berhasil ditambahkan ke akun Anda!");
      setHasPassword(true);
      setActiveForm("none");
      setNewPassword("");
      setConfirmPassword("");
      onRefreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendConfirmationLinkToEmail = async (emailAddr: string) => {
    setIsSendingConfirmation(true);
    setConfErrorMsg("");
    setConfSuccessMsg("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "send_confirmation",
          name: userName,
          targetEmail: emailAddr,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengirimkan tautan konfirmasi.");
      }

      setConfSuccessMsg(`Tautan konfirmasi (ConfirmationURL) berhasil dikirim ke ${maskEmail(emailAddr)}`);
      setResendCountdown(60);
    } catch (err: any) {
      setConfErrorMsg(err.message || "Gagal mengirim tautan konfirmasi.");
    } finally {
      setIsSendingConfirmation(false);
    }
  };

  const finalizePasswordResetAfterConfirmation = async () => {
    try {
      const resReset = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "reset_password",
          name: userName,
          oldPassword,
          newPassword,
          isConfirmationVerified: true,
        }),
      });

      const dataReset = await resReset.json();
      if (!resReset.ok || !dataReset.success) {
        throw new Error(dataReset.error || "Gagal memperbarui password.");
      }

      setIsConfirmationModalOpen(false);
      setSuccessMsg("Verifikasi Tautan Konfirmasi Berhasil! Password baru berhasil diperbarui.");
      setActiveForm("none");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onRefreshProfile();
    } catch (err: any) {
      setConfErrorMsg(err.message || "Gagal menyelesaikan pembaruan password.");
    }
  };

  const handleCheckManualConfirmation = async () => {
    setIsCheckingSession(true);
    setConfErrorMsg("");
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await finalizePasswordResetAfterConfirmation();
      } else {
        setConfErrorMsg("Tautan konfirmasi belum diklik atau sesi belum aktif.");
      }
    } catch (e) {
      setConfErrorMsg("Gagal memeriksa status konfirmasi.");
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "reset_password",
          name: userName,
          oldPassword,
          newPassword,
          isConfirmationVerified: false,
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses ganti password.");
      }

      if (data.requireConfirmation) {
        setIsConfirmationModalOpen(true);
        setConfErrorMsg("");
        setConfSuccessMsg("");
        sendConfirmationLinkToEmail(data.email || registeredEmail);
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg("Password berhasil diperbarui!");
      setActiveForm("none");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onRefreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!newEmailInput.trim() || !newEmailInput.includes("@")) {
      setErrorMsg("Masukkan alamat email yang valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "add_email",
          name: userName,
          email: newEmailInput,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menambahkan email.");
      }

      setSuccessMsg(`Email ${newEmailInput} berhasil terhubung dengan akun!`);
      setRegisteredEmail(newEmailInput.trim().toLowerCase());
      setActiveForm("none");
      setNewEmailInput("");
      onRefreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!newEmailInput.trim() || !newEmailInput.includes("@")) {
      setErrorMsg("Masukkan alamat email baru yang valid.");
      return;
    }

    if (hasPassword && !currentPassForEmail) {
      setErrorMsg("Password saat ini wajib diisi untuk verifikasi ganti email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "change_email",
          name: userName,
          password: currentPassForEmail,
          newEmail: newEmailInput,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memperbarui email.");
      }

      setSuccessMsg(`Email akun berhasil diperbarui menjadi ${newEmailInput}!`);
      setRegisteredEmail(newEmailInput.trim().toLowerCase());
      setActiveForm("none");
      setNewEmailInput("");
      setCurrentPassForEmail("");
      onRefreshProfile();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLoginPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsErrorMsg("");
    setPrefsSuccessMsg("");

    // Validasi aturan: Jika password dan wajah kedua-duanya terdaftar (ada), minimal harus ada 1 antara password atau wajah yang di-centang.
    if (hasPassword && hasFace) {
      if (!loginPrefPassword && !loginPrefFace) {
        setPrefsErrorMsg("Minimal harus mencentang salah satu antara verifikasi password atau verifikasi wajah.");
        return;
      }
    }

    setIsSavingPrefs(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          action: "update_login_preferences",
          name: userName,
          preferences: {
            password: loginPrefPassword,
            face: loginPrefFace,
            email: loginPrefEmail,
          },
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan preferensi metode login.");
      }

      setPrefsSuccessMsg("Preferensi metode login berhasil diperbarui!");
      setTimeout(() => {
        setActiveForm("none");
        setPrefsSuccessMsg("");
      }, 1000);
    } catch (err: any) {
      setPrefsErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
        <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Kelola Akun</h3>
              <p className="text-xs text-white/60">
                Pengaturan autentikasi & keamanan akun <span className="font-semibold text-emerald-400">{userName}</span>
              </p>
            </div>
          </div>

          {isLoadingStatus && (
            <div className="mb-4 flex items-center justify-center gap-2 text-blue-300 text-xs bg-blue-950/50 p-3.5 rounded-xl border border-blue-500/30 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
              <span>Mengambil data status akun... Mohon tunggu.</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 text-emerald-300 text-xs bg-emerald-950/60 p-3.5 rounded-xl border border-emerald-500/30">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3.5 rounded-xl border border-rose-900/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: METODE LOGIN */}
          <div className="rounded-2xl bg-white/5 p-4 border border-white/10 space-y-4 mb-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold tracking-wider text-white/80 uppercase">
                Metode Login Terpasang
              </span>
              <div className="flex items-center gap-2">
                {activeForm !== "login_prefs" && (
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("login_prefs");
                      setPrefsErrorMsg("");
                      setPrefsSuccessMsg("");
                    }}
                    className="py-1.5 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Metode Login</span>
                  </button>
                )}
                {isLoadingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                ) : (
                  <button
                    type="button"
                    onClick={fetchStatus}
                    title="Refresh Status"
                    className="text-white/40 hover:text-white transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Status Email */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${registeredEmail ? "bg-blue-950/40 border-blue-500/30 text-blue-300" : "bg-white/5 border-white/10 text-white/40"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-bold">Email</p>
                </div>
                <p className="text-[10px] opacity-90 truncate font-mono" title={registeredEmail ? registeredEmail : undefined}>
                  {registeredEmail ? maskEmail(registeredEmail) : "Belum Ada"}
                </p>
              </div>

              {/* Status Password */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${hasPassword ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-white/5 border-white/10 text-white/40"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-bold">Password</p>
                </div>
                <p className="text-[10px] opacity-80">{hasPassword ? "Aktif" : "Belum Ada"}</p>
              </div>

              {/* Status Face Verification */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${hasFace ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-white/5 border-white/10 text-white/40"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Camera className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-bold">Wajah AI</p>
                </div>
                <p className="text-[10px] opacity-80">{hasFace ? "Aktif" : "Belum Ada"}</p>
              </div>
            </div>

            {/* FORM: PENGATURAN PREFERENSI METODE LOGIN (CHECKBOXES) */}
            {activeForm === "login_prefs" && (
              <form onSubmit={handleSaveLoginPreferences} className="p-4 rounded-xl bg-slate-800/95 border border-indigo-500/40 space-y-4 pt-3">
                <div className="flex justify-between items-center pb-1 border-b border-white/10">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Konfigurasi Metode Login Aktif
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    className="text-white/50 hover:text-white text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                {prefsSuccessMsg && (
                  <div className="flex items-center gap-2 text-emerald-300 text-xs bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-500/30">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{prefsSuccessMsg}</span>
                  </div>
                )}

                {prefsErrorMsg && (
                  <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-2.5 rounded-lg border border-rose-900/50">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{prefsErrorMsg}</span>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  {/* Password Checkbox (Hanya muncul jika password terdaftar/ada) */}
                  {hasPassword && (
                    <label className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={loginPrefPassword}
                        onChange={(e) => setLoginPrefPassword(e.target.checked)}
                        className="mt-0.5 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-white block">Apakah login membutuhkan verifikasi password?</span>
                        <span className="text-white/60 text-[11px]">Akun akan meminta input password saat proses login.</span>
                      </div>
                    </label>
                  )}

                  {/* Face Checkbox (Hanya muncul jika wajah terdaftar/ada) */}
                  {hasFace && (
                    <label className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={loginPrefFace}
                        onChange={(e) => setLoginPrefFace(e.target.checked)}
                        className="mt-0.5 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-white block">Apakah login membutuhkan verifikasi wajah?</span>
                        <span className="text-white/60 text-[11px]">Akun akan membuka kamera untuk pemindaian liveness AI saat proses login.</span>
                      </div>
                    </label>
                  )}

                  {/* Email Checkbox (Selalu tersedia jika email terdaftar) */}
                  {registeredEmail && (
                    <label className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={loginPrefEmail}
                        onChange={(e) => setLoginPrefEmail(e.target.checked)}
                        className="mt-0.5 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-white block">Apakah login membutuhkan verifikasi email?</span>
                        <span className="text-white/60 text-[11px]">Mengirimkan kode OTP / tautan verifikasi ke email saat login.</span>
                      </div>
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSavingPrefs}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPrefs ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Simpan Pengaturan Metode Login</span>
                  )}
                </button>
              </form>
            )}

            {/* Action Buttons inside Metode Login */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!hasPassword && activeForm !== "add_password" && (
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("add_password");
                      setErrorMsg("");
                    }}
                    className="py-2.5 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Password</span>
                  </button>
                )}

                {hasPassword && activeForm !== "reset_password" && (
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("reset_password");
                      setErrorMsg("");
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-white/90 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                    <span>Reset Password</span>
                  </button>
                )}

                {!hasFace && (
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      onClose();
                      onAddFaceTrigger();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tambah Wajah</span>
                  </button>
                )}

                {activeForm !== "none" && registeredEmail && activeForm !== "change_email" && (
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("change_email");
                      setErrorMsg("");
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-white/90 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Ganti Email</span>
                  </button>
                )}

                {activeForm !== "none" && !registeredEmail && activeForm !== "add_email" && (
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("add_email");
                      setErrorMsg("");
                    }}
                    className="py-2.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Email</span>
                  </button>
                )}
              </div>

              {activeForm === "none" && registeredEmail && activeForm !== "change_email" && (
                <div className="flex justify-center w-full">
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("change_email");
                      setErrorMsg("");
                    }}
                    className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-white/90 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Ganti Email</span>
                  </button>
                </div>
              )}

              {activeForm === "none" && !registeredEmail && activeForm !== "add_email" && (
                <div className="flex justify-center w-full">
                  <button
                    type="button"
                    disabled={isLoadingStatus}
                    onClick={() => {
                      setActiveForm("add_email");
                      setErrorMsg("");
                    }}
                    className="py-2.5 px-6 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Email</span>
                  </button>
                </div>
              )}
            </div>

            {/* FORM: TAMBAH EMAIL */}
            {activeForm === "add_email" && (
              <form onSubmit={handleAddEmail} className="p-4 rounded-xl bg-slate-800/90 border border-purple-500/40 space-y-3 pt-3">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Tambah Email Baru
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    className="text-white/50 hover:text-white text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white/70 mb-1">
                    Alamat Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="contoh@domain.com"
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-purple-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Simpan Email</span>
                  )}
                </button>
              </form>
            )}

            {/* FORM: GANTI EMAIL */}
            {activeForm === "change_email" && (
              <form onSubmit={handleChangeEmail} className="p-4 rounded-xl bg-slate-800/90 border border-purple-500/40 space-y-3 pt-3">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" /> Ganti Alamat Email
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    className="text-white/50 hover:text-white text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                {hasPassword && (
                  <div>
                    <label className="block text-[11px] font-medium text-white/70 mb-1">
                      Verifikasi Password Saat Ini
                    </label>
                    <div className="relative">
                      <input
                        type={showEmailPass ? "text" : "password"}
                        required
                        value={currentPassForEmail}
                        onChange={(e) => setCurrentPassForEmail(e.target.value)}
                        placeholder="Masukkan password akun Anda"
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 pr-10 text-xs text-white placeholder-white/30 focus:border-purple-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPass(!showEmailPass)}
                        className="absolute right-3 top-2.5 text-white/50 hover:text-white cursor-pointer"
                      >
                        {showEmailPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-white/70 mb-1">
                    Alamat Email Baru
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="emailbaru@domain.com"
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-purple-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Perbarui Email</span>
                  )}
                </button>
              </form>
            )}

            {/* FORM: TAMBAH PASSWORD */}
            {activeForm === "add_password" && (
              <form onSubmit={handleAddPassword} className="p-4 rounded-xl bg-slate-800/90 border border-blue-500/40 space-y-3 pt-3">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Tambah Password Baru
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    className="text-white/50 hover:text-white text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white/70 mb-1">
                    Password Baru (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 pr-10 text-xs text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-white/50 hover:text-white cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Simpan Password</span>
                  )}
                </button>
              </form>
            )}

            {/* FORM: RESET PASSWORD */}
            {activeForm === "reset_password" && (
              <form onSubmit={handleResetPassword} className="p-4 rounded-xl bg-slate-800/90 border border-blue-500/40 space-y-3 pt-3">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Reset / Ganti Password
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    className="text-white/50 hover:text-white text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white/70 mb-1">
                    Password Lama
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPass ? "text" : "password"}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Masukkan password lama saat ini"
                      className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 pr-10 text-xs text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-3 top-2.5 text-white/50 hover:text-white cursor-pointer"
                    >
                      {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white/70 mb-1">
                    Password Baru (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 pr-10 text-xs text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-white/50 hover:text-white cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                    className="w-full rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Perbarui Password</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* SECTION 2: AKSI AKUN (Ganti Akun & Keluar) */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <span className="text-xs font-bold tracking-wider text-white/80 uppercase block mb-1">
              Aksi Sesi Akun
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isLoadingStatus}
                onClick={() => {
                  onClose();
                  onSwitchAccount();
                }}
                className="py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Ganti Akun</span>
              </button>

              <button
                type="button"
                disabled={isLoadingStatus}
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="py-3 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL KONFIRMASI TAUTAN EMAIL (ConfirmationURL) */}
      <AnimatePresence>
        {isConfirmationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          >
            <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-purple-500/30 p-6 text-white shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Verifikasi Tautan Email</h4>
                  <p className="text-xs text-white/60">Tautan konfirmasi dikirim untuk keamanan ganti password.</p>
                </div>
              </div>

              {confSuccessMsg && (
                <div className="flex items-center gap-2 text-purple-300 text-xs bg-purple-950/60 p-3 rounded-xl border border-purple-500/30">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{confSuccessMsg}</span>
                </div>
              )}

              {confErrorMsg && (
                <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3 rounded-xl border border-rose-900/50">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{confErrorMsg}</span>
                </div>
              )}

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 text-xs text-white/80 space-y-2">
                <p>Silakan buka email Anda dan klik tautan konfirmasi yang dikirimkan oleh sistem untuk mengesahkan reset password.</p>
                <p className="text-[11px] text-white/50 italic">Halaman ini akan otomatis mendeteksi verifikasi Anda setelah tautan diklik.</p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={isCheckingSession}
                  onClick={handleCheckManualConfirmation}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isCheckingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>Saya Sudah Klik Tautan, Lanjutkan</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    disabled={resendCountdown > 0 || isSendingConfirmation}
                    onClick={() => sendConfirmationLinkToEmail(registeredEmail)}
                    className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {resendCountdown > 0 ? `Kirim Ulang Tautan (${resendCountdown}s)` : "Kirim Ulang Tautan"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmationModalOpen(false);
                      setActiveForm("none");
                    }}
                    className="text-xs text-white/60 hover:text-white cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
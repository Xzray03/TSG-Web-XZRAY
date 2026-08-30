"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Check, X, AlertCircle, Loader2, Send, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LoginConfirmationModalProps {
  isOpen: boolean;
  email: string;
  userName: string;
  onClose: () => void;
  onVerified: () => void;
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

export function LoginVerifURLModal({
  isOpen,
  email,
  userName,
  onClose,
  onVerified,
}: LoginConfirmationModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const sendConfirmationLink = async () => {
    if (!email || !email.includes("@")) return;
    setIsSending(true);
    setErrorMsg("");
    setSuccessMsg("");

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
          targetEmail: email,
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengirimkan tautan konfirmasi (ConfirmationURL) ke email.");
      }

      setSuccessMsg(`Tautan konfirmasi (ConfirmationURL) berhasil dikirimkan ke email ${maskEmail(email)}.`);
      setResendCountdown(60);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengirim email konfirmasi.");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setSuccessMsg("");
      sendConfirmationLink();
    }
  }, [isOpen]);

  // Listen for ConfirmationURL magic link authentication or session confirmation automatically
  useEffect(() => {
    if (!isOpen) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        onVerified();
      }
    });

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          onVerified();
        }
      } catch (e) {}
    }, 2500);

    return () => {
      authListener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  const checkManualSession = async () => {
    setIsChecking(true);
    setErrorMsg("");
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        onVerified();
      } else {
        setErrorMsg("Tautan konfirmasi belum diklik atau sesi belum terkonfirmasi di peramban ini.");
      }
    } catch (e) {
      setErrorMsg("Gagal memeriksa status konfirmasi.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-blue-500/40 p-6 sm:p-7 shadow-[0_0_100px_rgba(59,130,246,0.3)] text-white"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              <Mail className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-800/40">
                KONFIRMASI LOGIN EMAIL
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Cek Email Anda
              </h3>
            </div>
          </div>

          <p className="text-xs text-white/70 leading-relaxed mb-4">
            Tautan konfirmasi (<span className="text-blue-300 font-semibold">ConfirmationURL</span>) telah dikirimkan ke email{" "}
            <span className="font-mono font-bold text-emerald-400">
              {maskEmail(email)}
            </span>
            . Buka email Anda lalu **klik tautan konfirmasi** untuk menyelesaikan login.
          </p>

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

          {/* OPSI: Klik Link ConfirmationURL Detection */}
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 mb-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-300 flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4" /> Tautan Konfirmasi Email
              </span>
              <span className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Menunggu Klik...
              </span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Cukup buka kotak masuk/spam email Anda lalu klik tautan konfirmasi. Halaman ini akan otomatis mendeteksi dan masuk.
            </p>
            <button
              type="button"
              onClick={checkManualSession}
              disabled={isChecking}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Saya Sudah Klik Tautan di Email</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
            <span>Tidak menerima email?</span>
            <button
              type="button"
              disabled={resendCountdown > 0 || isSending}
              onClick={sendConfirmationLink}
              className="text-blue-400 hover:text-blue-300 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>
                {resendCountdown > 0
                  ? `Kirim Ulang (${resendCountdown}s)`
                  : "Kirim Ulang Tautan"}
              </span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

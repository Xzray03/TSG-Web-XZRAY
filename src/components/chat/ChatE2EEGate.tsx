"use client";

import { useState } from "react";
import { Lock, Loader2, ShieldCheck, AlertTriangle, Camera } from "lucide-react";
import { publishChatKeyAction } from "@/actions/chatKeyActions";
import { getMyAccountAction } from "@/actions/authActions";
import { createIdentity, unlockIdentity, type ChatKeyRecord } from "@/lib/e2ee";
import TotpPromptModal from "@/components/auth/TotpPromptModal";
import ChatE2EEFaceVerifyModal from "@/components/chat/ChatE2EEFaceVerifyModal";

type Props = {
  userId: string;
  mode: "setup" | "unlock";
  record: ChatKeyRecord | null;
  onReady: () => void;
};

const MIN_PASSPHRASE = 12;

export function ChatE2EEGate({ userId, mode, record, onReady }: Props) {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);

  // Re-auth state for reset/change key
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthMode, setReauthMode] = useState<"none" | "password" | "face">("none");
  const [faceVerifiedToken, setFaceVerifiedToken] = useState("");

  // TOTP gate state
  const [totpPromptOpen, setTotpPromptOpen] = useState(false);
  const [totpError, setTotpError] = useState("");
  const [totpSubmitting, setTotpSubmitting] = useState(false);

  // Face verify modal state
  const [isFaceVerifyOpen, setIsFaceVerifyOpen] = useState(false);

  const isSetup = mode === "setup" || resetting;

  const validateNew = (): string => {
    if (pass.length < MIN_PASSPHRASE) return `Kata sandi minimal ${MIN_PASSPHRASE} karakter.`;
    if (new Set(pass).size < 5) return "Kata sandi terlalu mudah ditebak.";
    if (pass !== confirm) return "Konfirmasi kata sandi tidak sama.";
    if (!ack) return "Centang pernyataan bahwa Anda memahami risiko kehilangan kata sandi.";
    return "";
  };

  /** Fetch akun utk cek password/face & TOTP saat mode reset */
  const fetchReauthMode = async () => {
    try {
      const data: any = await getMyAccountAction();
      if (data && !data.error) {
        if (data.hasPassword) setReauthMode("password");
        else if (data.hasFace) setReauthMode("face");
        else setReauthMode("none");
      }
    } catch {
      setReauthMode("none");
    }
  };

  const handleResetClick = () => {
    setResetting(true);
    setPass("");
    setConfirm("");
    setAck(false);
    setError("");
    setReauthPassword("");
    setFaceVerifiedToken("");
    void fetchReauthMode();
  };

  /** Publish kunci dengan step-up password/wajah + (opsional) TOTP */
  const doPublish = async (totpCode?: string) => {
    setBusy(true);
    try {
      const nextVersion = resetting ? (record?.keyVersion || 0) + 1 : 1;
      const { record: newRecord, commit } = await createIdentity(userId, pass, nextVersion);
      const res: any = await publishChatKeyAction({
        userId,
        record: newRecord,
        replace: resetting,
        password: reauthPassword || undefined,
        faceVerifiedToken: faceVerifiedToken || undefined,
        totpCode,
      });
      if (res?.error) {
        if (res.code === "TOTP_REQUIRED") {
          setTotpPromptOpen(true);
          return;
        }
        if (res.code === "TOTP_INVALID") {
          setTotpError(res.error || "Kode 2FA tidak valid.");
          setTotpPromptOpen(true);
          return;
        }
        if (res.code === "FACE_REQUIRED" || res.code === "FACE_INVALID") {
          setFaceVerifiedToken("");
          setIsFaceVerifyOpen(true);
          return;
        }
        setError(
          res.error === "exists"
            ? "Kunci sudah terdaftar di server. Muat ulang halaman lalu masukkan kata sandi Anda."
            : res.error
        );
        return;
      }
      await commit();
      setTotpPromptOpen(false);
      setIsFaceVerifyOpen(false);
      onReady();
    } catch {
      setError("Gagal membuat kunci enkripsi di perangkat ini.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (!isSetup) {
      if (!record) return;
      setBusy(true);
      const ok = await unlockIdentity(userId, pass, record);
      setBusy(false);
      if (!ok) {
        setError("Kata sandi salah.");
        return;
      }
      onReady();
      return;
    }

    const v = validateNew();
    if (v) {
      setError(v);
      return;
    }

    // Saat reset/ubah kunci: wajib password/wajah dulu sebelum publish
    if (resetting) {
      if (reauthMode === "password" && !reauthPassword) {
        setError("Masukkan password akun untuk mereset kunci enkripsi.");
        return;
      }
      if (reauthMode === "face" && !faceVerifiedToken) {
        // Buka modal verifikasi wajah khusus re-auth
        setIsFaceVerifyOpen(true);
        return;
      }
    }

    await doPublish();
  };

  /** Setelah TOTP terverifikasi, ulangi publish */
  const handleTotpSubmit = async (code: string) => {
    setTotpSubmitting(true);
    setTotpError("");
    try {
      await doPublish(code);
    } finally {
      setTotpSubmitting(false);
    }
  };

  /** Setelah verifikasi wajah selesai, ulangi publish */
  const handleFaceVerified = (faceVerifiedToken: string) => {
    setFaceVerifiedToken(faceVerifiedToken);
    setIsFaceVerifyOpen(false);
    // Langsung lanjutkan publish (tanpa password karena sudah face verified)
    void doPublish();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
        autoComplete="off"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {isSetup ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {resetting ? "Reset Kunci Enkripsi" : isSetup ? "Aktifkan Enkripsi Chat" : "Buka Kunci Chat"}
            </h2>
            <p className="text-[11px] text-slate-400">End-to-end: hanya Anda dan lawan bicara yang bisa membaca pesan.</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          {resetting
            ? "Kunci baru akan dibuat. Riwayat pesan lama TIDAK bisa dibaca lagi, dan lawan bicara akan melihat peringatan bahwa kunci Anda berubah."
            : isSetup
              ? "Buat kata sandi enkripsi chat. Kata sandi ini melindungi kunci Anda dan dipakai untuk membuka chat di perangkat lain."
              : "Masukkan kata sandi enkripsi chat untuk membuka kunci di perangkat ini."}
        </p>

        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Kata sandi enkripsi chat"
          autoComplete="new-password"
          className="w-full mb-2 rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
        />
        {isSetup && (
          <>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi kata sandi"
              autoComplete="new-password"
              className="w-full mb-2 rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
            />
            <label className="flex items-start gap-2 text-[11px] text-amber-300 mb-2">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              <span>
                Saya paham: kata sandi ini tidak bisa dipulihkan. Jika lupa, riwayat pesan tidak dapat dibuka lagi.
              </span>
            </label>
          </>
        )}

        {/* Re-auth section saat reset kunci */}
        {resetting && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verifikasi Identitas Anda (Wajib)
            </p>
            {reauthMode === "password" ? (
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="Password akun saat ini"
                autoComplete="current-password"
                className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
              />
            ) : reauthMode === "face" ? (
              faceVerifiedToken ? (
                <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Wajah terverifikasi ✓</span>
                  <button type="button" onClick={() => setFaceVerifiedToken("")} className="text-[11px] text-amber-300 underline">
                    Ganti
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsFaceVerifyOpen(true)}
                  className="w-full py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Verifikasi Wajah AI</span>
                </button>
              )
            ) : (
              <p className="text-[11px] text-white/40">Memuat verifikasi...</p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !pass}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {resetting ? "Buat Kunci Baru" : isSetup ? "Aktifkan" : "Buka Kunci"}
        </button>

        {mode === "unlock" && !resetting && (
          <button
            type="button"
            onClick={handleResetClick}
            className="w-full mt-2 text-[11px] text-slate-400 hover:text-red-300 underline underline-offset-2"
          >
            Lupa kata sandi? Reset kunci
          </button>
        )}
      </form>

      {/* TOTP Prompt Modal */}
      <TotpPromptModal
        isOpen={totpPromptOpen}
        title="Reset Kunci Enkripsi Chat"
        subtitle="Masukkan kode 6 digit dari aplikasi authenticator atau recovery code"
        isLoading={totpSubmitting}
        error={totpError}
        onSubmit={handleTotpSubmit}
        onClose={() => {
          setTotpPromptOpen(false);
          setTotpError("");
        }}
      />

      {/* Face Verification Modal (re-auth for chat key reset) */}
      <ChatE2EEFaceVerifyModal
        isOpen={isFaceVerifyOpen}
        userId={userId}
        onVerified={handleFaceVerified}
        onClose={() => {
          setIsFaceVerifyOpen(false);
          setFaceVerifiedToken("");
        }}
      />
    </div>
  );
}
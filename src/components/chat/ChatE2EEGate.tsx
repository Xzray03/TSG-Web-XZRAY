"use client";

import { useState } from "react";
import { Lock, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { publishChatKeyAction } from "@/actions/chatKeyActions";
import { createIdentity, unlockIdentity, type ChatKeyRecord } from "@/lib/e2ee";

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

  const isSetup = mode === "setup" || resetting;

  const validateNew = (): string => {
    if (pass.length < MIN_PASSPHRASE) return `Kata sandi minimal ${MIN_PASSPHRASE} karakter.`;
    if (new Set(pass).size < 5) return "Kata sandi terlalu mudah ditebak.";
    if (pass !== confirm) return "Konfirmasi kata sandi tidak sama.";
    if (!ack) return "Centang pernyataan bahwa Anda memahami risiko kehilangan kata sandi.";
    return "";
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

    setBusy(true);
    try {
      const nextVersion = resetting ? (record?.keyVersion || 0) + 1 : 1;
      const { record: newRecord, commit } = await createIdentity(userId, pass, nextVersion);
      const res: any = await publishChatKeyAction({ userId, record: newRecord, replace: resetting });
      if (res?.error) {
        setError(
          res.error === "exists"
            ? "Kunci sudah terdaftar di server. Muat ulang halaman lalu masukkan kata sandi Anda."
            : res.error
        );
        return;
      }
      await commit();
      onReady();
    } catch {
      setError("Gagal membuat kunci enkripsi di perangkat ini.");
    } finally {
      setBusy(false);
    }
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
            onClick={() => {
              setResetting(true);
              setPass("");
              setConfirm("");
              setAck(false);
              setError("");
            }}
            className="w-full mt-2 text-[11px] text-slate-400 hover:text-red-300 underline underline-offset-2"
          >
            Lupa kata sandi? Reset kunci
          </button>
        )}
      </form>
    </div>
  );
}

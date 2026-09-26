import React, { useState, useEffect } from "react";
import {
  X,
  Globe,
  Check,
  AlertCircle,
  Loader2,
  Share2,
  User,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { FaUser } from "react-icons/fa";
import { LogoModal } from "@/components/layout/LogoModal";
import { FaLinkedin, FaGithub, FaYoutube, FaTiktok, FaInstagram, FaFacebook, FaWhatsapp, FaLine } from "react-icons/fa";
import { useScrollLock } from "@/hooks/useScrollLock";

interface ManagePublicAccountModalProps {
  isOpen: boolean;
  realAccountId: string;
  realAccountName: string;
  isTsgMember: boolean;
  onClose: () => void;
}

export default function ManagePublicAccountModal({
  isOpen,
  realAccountId,
  realAccountName,
  isTsgMember,
  onClose,
}: ManagePublicAccountModalProps) {
  useScrollLock(isOpen);
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState(realAccountName || "");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showTsgMember, setShowTsgMember] = useState(false);
  const [website, setWebsite] = useState("");

  // Social Media State
  const [socials, setSocials] = useState({
    linkedin: "",
    github: "",
    youtube: "",
    tiktok: "",
    instagram: "",
    facebook: "",
    whatsapp: "",
    line: "",
  });

  const [isSocialsModalOpen, setIsSocialsModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  useScrollLock(isSocialsModalOpen || isLogoModalOpen);

  // Nickname status
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [nicknameError, setNicknameError] = useState("");
  const [resolvedId, setResolvedId] = useState<string>(realAccountId || "");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch existing public account data on open
  useEffect(() => {
    async function initModal() {
      if (isOpen && realAccountName) {
        setName(realAccountName || "");
        let currentId = realAccountId;
        if (!currentId) {
          try {
            const checkRes = await fetch(`/api/auth?action=check&name=${encodeURIComponent(realAccountName.trim())}`, {
              headers: { "x-tsg-client-verify": "true" },
            });
            const checkData = await checkRes.json();
            if (checkRes.ok && checkData.id) {
              currentId = checkData.id;
              setResolvedId(checkData.id);
            }
          } catch (e) {}
        } else {
          setResolvedId(realAccountId);
        }

        if (currentId) {
          await fetchPublicAccountData(currentId);
        }
      } else {
        resetForm();
      }
    }
    initModal();
  }, [isOpen, realAccountId, realAccountName]);

  const resetForm = () => {
    setNickname("");
    setAge("");
    setBio("");
    setAvatarUrl("");
    setShowTsgMember(false);
    setWebsite("");
    setResolvedId(realAccountId || "");
    setSocials({
      linkedin: "",
      github: "",
      youtube: "",
      tiktok: "",
      instagram: "",
      facebook: "",
      whatsapp: "",
      line: "",
    });
    setNicknameStatus("idle");
    setNicknameError("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const fetchPublicAccountData = async (targetId: string) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/public-accounts?realAccountId=${targetId}`, {
        headers: { "x-tsg-client-verify": "true" },
      });
      const data = await res.json();
      if (res.ok && data.publicAccount) {
        const acc = data.publicAccount;
        setNickname(acc.nickname || "");
        setName(acc.name || realAccountName || "");
        setAge(acc.age ? acc.age.toString() : "");
        setBio(acc.bio || "");
        setAvatarUrl(acc.avatar_url || "");
        setShowTsgMember(!!acc.show_tsg_member);
        setWebsite(acc.website || "");
        if (acc.social_media && typeof acc.social_media === "object") {
          setSocials({
            linkedin: acc.social_media.linkedin || "",
            github: acc.social_media.github || "",
            youtube: acc.social_media.youtube || "",
            tiktok: acc.social_media.tiktok || "",
            instagram: acc.social_media.instagram || "",
            facebook: acc.social_media.facebook || "",
            whatsapp: acc.social_media.whatsapp || "",
            line: acc.social_media.line || "",
          });
        }
        if (acc.nickname) {
          setNicknameStatus("available");
        }
      }
    } catch (err) {
      console.error("Error fetching public account:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check nickname availability when nickname changes
  useEffect(() => {
    if (!nickname.trim()) {
      setNicknameStatus("idle");
      setNicknameError("");
      return;
    }

    const cleanNick = nickname.trim();
    if (cleanNick.length < 3 || /\s/.test(cleanNick)) {
      setNicknameStatus("invalid");
      setNicknameError("Minimal 3 karakter dan tanpa spasi.");
      return;
    }

    setNicknameStatus("checking");
    setNicknameError("");

    const timeoutId = setTimeout(async () => {
      try {
        const currentId = resolvedId || realAccountId;
        const queryUrl = currentId
          ? `/api/public-accounts?checkNickname=${encodeURIComponent(cleanNick)}&excludeAccountId=${encodeURIComponent(currentId)}`
          : `/api/public-accounts?checkNickname=${encodeURIComponent(cleanNick)}`;

        const res = await fetch(queryUrl, {
          headers: { "x-tsg-client-verify": "true" },
        });
        const data = await res.json();
        if (res.ok) {
          if (data.available) {
            setNicknameStatus("available");
          } else {
            setNicknameStatus("taken");
            setNicknameError("Nickname sudah digunakan.");
          }
        }
      } catch (e) {
        setNicknameStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nickname, resolvedId, realAccountId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const currentId = resolvedId || realAccountId;
    if (!currentId) {
      setErrorMsg("ID akun asli tidak ditemukan. Coba refresh halaman dan login ulang.");
      return;
    }

    if (!nickname.trim() || !name.trim()) {
      setErrorMsg("Nickname dan Nama wajib diisi.");
      return;
    }

    if (nicknameStatus === "taken" || nicknameStatus === "invalid") {
      setErrorMsg("Mohon gunakan nickname yang valid dan belum digunakan.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/public-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tsg-client-verify": "true",
        },
        body: JSON.stringify({
          realAccountId: currentId,
          nickname: nickname.trim(),
          name: name.trim(),
          age: age ? parseInt(age, 10) : null,
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
          showTsgMember: showTsgMember && isTsgMember,
          socialMedia: socials,
          website: website.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan akun publik.");
      }

      setSuccessMsg("Akun publik berhasil disimpan!");
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
        <div className="relative my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-emerald-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              onClick={() => setIsLogoModalOpen(true)}
              title="Klik untuk melihat / mengubah foto profil"
              className="relative h-14 w-14 overflow-hidden rounded-full border border-emerald-500/30 bg-slate-800 flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-emerald-500/30 shadow-lg"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || "Avatar"}
                  className="h-full w-full object-cover object-top aspect-square"
                  crossOrigin="anonymous"
                />
              ) : (
                <FaUser className="h-5 w-5 text-emerald-400/70" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Kelola Akun Publik</h3>
              <p className="text-xs text-white/60">
                Profil virtual terpisah yang tampil secara publik di website (data asli Anda tetap aman).
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-emerald-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Memuat data akun publik...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/60 p-3.5 rounded-xl border border-rose-900/50">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 text-emerald-300 text-xs bg-emerald-950/60 p-3.5 rounded-xl border border-emerald-500/30">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Nickname */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nickname Publik <span className="text-emerald-400">*</span> (Harus Unik, Tanpa Spasi)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="contoh: tsg_coder"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-xs">
                    {nicknameStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                    {nicknameStatus === "available" && <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Tersedia</span>}
                    {nicknameStatus === "taken" && <span className="text-rose-400">Digunakan</span>}
                    {nicknameStatus === "invalid" && <span className="text-amber-400">Tidak valid</span>}
                  </div>
                </div>
                {nicknameError && <p className="mt-1 text-[11px] text-rose-400">{nicknameError}</p>}
              </div>

              {/* Nama */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Publik <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama yang akan ditampilkan"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Grid: Umur & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Umur (Opsional)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Contoh: 21"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Website (Opsional)
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://namadomain.com"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Bio / Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ceritakan sedikit tentang Anda secara publik..."
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Checkbox: Tampilkan Status Anggota TSG */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="showTsgMemberCheckbox"
                  disabled={!isTsgMember}
                  checked={showTsgMember && isTsgMember}
                  onChange={(e) => setShowTsgMember(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <div className="text-xs">
                  <label
                    htmlFor="showTsgMemberCheckbox"
                    className="font-semibold text-white cursor-pointer select-none block mb-0.5"
                  >
                    Tampilkan Status Anggota TSG
                  </label>
                  <p className="text-white/60 text-[11px] leading-relaxed">
                    {isTsgMember
                      ? "Akun asli Anda terverifikasi sebagai Anggota TSG. Centang untuk menampilkan lencana Anggota TSG pada akun publik."
                      : "Fitur ini hanya tersedia jika akun asli (real account) yang ter-login memiliki status Anggota TSG."}
                  </p>
                </div>
              </div>

              {/* Sosial Media Config Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsSocialsModalOpen(true)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Kelola Tautan Sosial Media (Opsional)</span>
                  </span>
                  <span className="text-emerald-400 text-[11px]">
                    {Object.values(socials).filter(Boolean).length} terisi
                  </span>
                </button>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || nicknameStatus === "taken" || nicknameStatus === "invalid"}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Simpan Akun Publik</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Social Media Sub-Modal */}
      {isSocialsModalOpen && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative my-auto w-full max-w-md rounded-3xl bg-slate-900 border border-emerald-500/30 p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Pengaturan Sosial Media</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsSocialsModalOpen(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* LinkedIn */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaLinkedin className="text-blue-400 w-3.5 h-3.5" /> LinkedIn URL
                </label>
                <input
                  type="url"
                  value={socials.linkedin}
                  onChange={(e) => setSocials({ ...socials, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* GitHub */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaGithub className="text-white w-3.5 h-3.5" /> GitHub URL
                </label>
                <input
                  type="url"
                  value={socials.github}
                  onChange={(e) => setSocials({ ...socials, github: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* YouTube */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaYoutube className="text-red-400 w-3.5 h-3.5" /> YouTube URL
                </label>
                <input
                  type="url"
                  value={socials.youtube}
                  onChange={(e) => setSocials({ ...socials, youtube: e.target.value })}
                  placeholder="https://youtube.com/@channel"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* TikTok */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaTiktok className="text-white w-3.5 h-3.5" /> TikTok URL
                </label>
                <input
                  type="url"
                  value={socials.tiktok}
                  onChange={(e) => setSocials({ ...socials, tiktok: e.target.value })}
                  placeholder="https://tiktok.com/@username"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaInstagram className="text-pink-400 w-3.5 h-3.5" /> Instagram URL
                </label>
                <input
                  type="url"
                  value={socials.instagram}
                  onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                  placeholder="https://instagram.com/username"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Facebook */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaFacebook className="text-blue-500 w-3.5 h-3.5" /> Facebook URL
                </label>
                <input
                  type="url"
                  value={socials.facebook}
                  onChange={(e) => setSocials({ ...socials, facebook: e.target.value })}
                  placeholder="https://facebook.com/username"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaWhatsapp className="text-emerald-400 w-3.5 h-3.5" /> WhatsApp URL / Link
                </label>
                <input
                  type="url"
                  value={socials.whatsapp}
                  onChange={(e) => setSocials({ ...socials, whatsapp: e.target.value })}
                  placeholder="https://wa.me/628xxxxxxxxxx"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* LINE */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaLine className="text-emerald-500 w-3.5 h-3.5" /> LINE URL
                </label>
                <input
                  type="url"
                  value={socials.line}
                  onChange={(e) => setSocials({ ...socials, line: e.target.value })}
                  placeholder="https://line.me/ti/p/~username"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSocialsModalOpen(false)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* LogoModal for Profile Photo Preview */}
      {isLogoModalOpen && (
        <LogoModal
          isOpen={isLogoModalOpen}
          logoUrl={avatarUrl}
          alt={name || nickname || "Foto Profil Publik"}
          isTsgMember={false}
          onClose={() => setIsLogoModalOpen(false)}
          onUpdatePhoto={(newPhotoUrl) => {
            setAvatarUrl(newPhotoUrl);
            setIsLogoModalOpen(false);
          }}
        />
      )}
    </>
  );
}

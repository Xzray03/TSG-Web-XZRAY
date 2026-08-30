"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser } from "react-icons/fa";
import {
  X,
  Edit3,
  Check,
  AlertCircle,
  LogOut,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/types";
import FaceVerificationModal from "@/components/auth/FaceVerificationModal";
import PasswordAuthModal from "@/components/auth/PasswordAuthModal";
import AuthMethodChoiceModal from "@/components/auth/AuthMethodChoiceModal";
import LogoutChoiceModal from "@/components/auth/LogoutChoiceModal";
import DeleteAccountModal from "@/components/auth/DeleteAccountModal";
import DeviceApprovalModal from "@/components/auth/DeviceApprovalModal";
import ManageAccountModal from "@/components/auth/ManageAccountModal";
import { LoginVerifURLModal } from "@/components/auth/LoginVerifURLModal";
import { LogoModal } from "@/components/layout/LogoModal";
import { supabase } from "@/lib/supabase";
import { getOrCreateDeviceKey } from "@/lib/deviceKeyManager";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";

interface UserProfile {
  name: string;
  generation: string;
  iconDataUrl: string;
  email?: string;
  isTsgMember?: boolean;
  authMethod?: "face" | "password";
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respon server tidak valid (${res.status}). Mohon coba beberapa saat lagi.`);
  }
}

export function UserProfileBadge() {
  const [generations, setGenerations] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    generation: "",
    iconDataUrl: "",
    email: "",
    isTsgMember: false,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const [errorMsg, setErrorMsg] = useState("");

  const [tempName, setTempName] = useState("");
  const [tempGen, setTempGen] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [submittedGen, setSubmittedGen] = useState("");
  const [isTsgMemberCheckbox, setIsTsgMemberCheckbox] = useState(false);
  const [isNotTsgMemberAlertOpen, setIsNotTsgMemberAlertOpen] =
    useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLogoutChoiceOpen, setIsLogoutChoiceOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isManageAccountOpen, setIsManageAccountOpen] = useState(false);
  const [isSequentialLogin, setIsSequentialLogin] = useState(false);
  const [isTsgMemberBlockModalOpen, setIsTsgMemberBlockModalOpen] =
    useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

  const [isLoginOtpModalOpen, setIsLoginOtpModalOpen] = useState(false);
  const [pendingLoginProfile, setPendingLoginProfile] =
    useState<UserProfile | null>(null);

  const [authMode, setAuthMode] = useState<"register" | "login">("login");
  const [storedFaceVectors, setStoredFaceVectors] = useState<Array<number[]>>(
    [],
  );
  const [isTsgMemberState, setIsTsgMemberState] = useState(false);
  const [tsgInfoState, setTsgInfoState] = useState<any>(null);

  // Session lock
  const [pendingLoginRequest, setPendingLoginRequest] = useState<any>(null);

  useSessionHeartbeat(profile.email || null, (req) => {
    setPendingLoginRequest(req);
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [genRes, memberRes] = await Promise.all([
          fetch("/api/generations", {
            headers: { "x-tsg-client-verify": "true" },
          }),
          fetch("/api/team-members", {
            headers: { "x-tsg-client-verify": "true" },
          }),
        ]);

        if (genRes.ok) {
          const genData = await genRes.json();
          if (Array.isArray(genData)) setGenerations(genData);
        }

        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (Array.isArray(memberData)) setTeamMembers(memberData);
        }
      } catch (e) {}
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function restoreAndVerifySession() {
      try {
        const saved = localStorage.getItem("tsg_user_profile");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name) {
            setProfile(parsed);
          }
        }
      } catch (e) {
        localStorage.removeItem("tsg_user_profile");
      }
    }

    restoreAndVerifySession();
  }, []);

  useEffect(() => {
    if (!isModalOpen && !isNotTsgMemberAlertOpen) {
      setTempName("");
      setTempGen("");
      setErrorMsg("");
      setIsEditing(false);
      setIsTsgMemberCheckbox(false);
    }
  }, [isModalOpen, isNotTsgMemberAlertOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollYRef.current && currentScrollY > 80) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollYRef.current) {
        setIsHidden(false);
      }
      lastScrollYRef.current = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleRefreshAccount = async () => {
    if (!profile.name) return;
    setIsRefreshing(true);
    setErrorMsg("");

    try {
      const res = await fetch(
        `/api/auth?action=check&name=${encodeURIComponent(profile.name.trim())}`,
        {
          headers: { "x-tsg-client-verify": "true" },
        },
      );

      const data = await parseJsonResponse(res);

      if (res.ok) {
        const freshPhoto = data.tsgInfo?.photo || profile.iconDataUrl;
        const updatedProfile: UserProfile = {
          ...profile,
          name: data.tsgInfo?.name || profile.name,
          generation: data.tsgInfo?.categoryName || profile.generation,
          iconDataUrl: freshPhoto,
          email: data.tsgInfo?.email || profile.email,
          isTsgMember: !!data.isTsgMember,
          authMethod: data.authMethod || profile.authMethod,
        };

        setProfile(updatedProfile);
        localStorage.setItem(
          "tsg_user_profile",
          JSON.stringify(updatedProfile),
        );
      }
    } catch (err: any) {
      setErrorMsg("Gagal memperbarui data akun.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartVerification = async () => {
    if (!tempName.trim()) {
      setErrorMsg("Mohon masukkan nama terlebih dahulu.");
      return;
    }

    if (isTsgMemberCheckbox && !tempGen) {
      setErrorMsg("Anggota TSG wajib memilih generasi.");
      return;
    }

    setErrorMsg("");
    setIsVerifying(true);

    try {
      const res = await fetch(
        `/api/auth?action=check&name=${encodeURIComponent(tempName.trim())}`,
        {
          headers: { "x-tsg-client-verify": "true" },
        },
      );

      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.error || "Gagal memeriksa akun di database.");
      }

      // BILA DICENTANG ANGGOTA TSG TAPI TIDAK TERDAFTAR DI SANITY CMS:
      if (isTsgMemberCheckbox && !data.isTsgMember) {
        setSubmittedName(tempName.trim());
        setSubmittedGen(tempGen);
        setIsVerifying(false);
        setIsModalOpen(false);
        setIsNotTsgMemberAlertOpen(true);
        return;
      }

      setIsTsgMemberState(isTsgMemberCheckbox ? !!data.isTsgMember : false);
      setTsgInfoState(isTsgMemberCheckbox ? (data.tsgInfo || null) : null);

      if (!data.exists) {
        // AKUN BELUM ADA: Tampilkan Pop-Up Pilihan Metode Autentikasi
        setAuthMode("register");
        setIsChoiceModalOpen(true);
      } else {
        // AKUN SUDAH ADA: Buka Modal Sesuai Metode Pendaftaran
        setAuthMode("login");
        setStoredFaceVectors(data.faceVectors || []);

        const hasPass = !!data.hasPassword;
        const hasF = !!data.hasFace;

        if (hasPass && hasF) {
          // BILA MEMILIKI DUA METODE (PASSWORD & WAJAH):
          // Urutan: Verifikasi Password dulu, baru Wajah!
          setIsSequentialLogin(true);
          setIsPasswordModalOpen(true);
        } else if (hasPass) {
          setIsSequentialLogin(false);
          setIsPasswordModalOpen(true);
        } else if (hasF) {
          setIsSequentialLogin(false);
          setIsFaceModalOpen(true);
        } else {
          setIsChoiceModalOpen(true);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memeriksa akun.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectChoiceMethod = (method: "face" | "password") => {
    setIsChoiceModalOpen(false);
    if (method === "face") {
      setIsFaceModalOpen(true);
    } else {
      setIsPasswordModalOpen(true);
    }
  };

  const handlePasswordVerified = (profileData: any) => {
    if (isSequentialLogin) {
      setIsPasswordModalOpen(false);
      setIsSequentialLogin(false);
      setIsFaceModalOpen(true);
    } else {
      handleAuthSuccess(profileData);
    }
  };

  const handleAuthSuccess = (newProfileData: any) => {
    const targetEmail =
      newProfileData.email || tsgInfoState?.email || profile.email || "";

    const updatedProfile: UserProfile = {
      name: tempName.trim() || newProfileData.name || "",
      generation: tempGen || tsgInfoState?.categoryName || "",
      iconDataUrl: newProfileData.iconDataUrl || tsgInfoState?.photo || "",
      email: targetEmail,
      isTsgMember: isTsgMemberState,
      authMethod: newProfileData.authMethod,
    };

    // JIKA DALAM MODE LOGIN DAN AKUN MEMILIKI EMAIL: Wajib Verifikasi Email (LoginVerifURLModal) SEBELUM Sesi Disimpan ke LocalStorage!
    if (authMode === "login" && targetEmail && targetEmail.includes("@")) {
      setPendingLoginProfile(updatedProfile);
      setIsPasswordModalOpen(false);
      setIsFaceModalOpen(false);
      setIsLoginOtpModalOpen(true);
      return;
    }

    finalizeLogin(updatedProfile);
  };

  const finalizeLogin = (finalProfile: UserProfile) => {
    setProfile(finalProfile);
    localStorage.setItem("tsg_user_profile", JSON.stringify(finalProfile));

    setPendingLoginProfile(null);
    setIsLoginOtpModalOpen(false);
    setTempName("");
    setTempGen("");
    setErrorMsg("");
    setIsEditing(false);
    setIsModalOpen(false);
  };

  const handleSignOut = async () => {
    try {
      const deviceKey = getOrCreateDeviceKey();
      if (profile.email) {
        await fetch("/api/session/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.email, deviceKey }),
        });
      }
    } catch (e) {}

    await supabase.auth.signOut();
    localStorage.removeItem("tsg_user_profile");
    setProfile({
      name: "",
      generation: "",
      iconDataUrl: "",
      email: "",
      isTsgMember: false,
    });
    setTempName("");
    setTempGen("");
    setIsModalOpen(false);
    setIsLogoutChoiceOpen(false);
    setIsDeleteAccountOpen(false);
  };

  const hasData = Boolean(profile.name);

  return (
    <>
      <motion.div
        initial={{ x: 0, opacity: 1 }}
        animate={{
          x: isHidden ? -100 : 0,
          opacity: isHidden ? 0 : 1,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed top-4 left-4 z-[9999]",
          isHidden ? "pointer-events-none" : "pointer-events-auto",
        )}
      >
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          aria-label="Profil Akun"
          className={cn(
            "group relative flex items-center gap-0 hover:gap-3 rounded-full border p-2 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden",
            hasData
              ? "border-emerald-500/30 bg-slate-900/90 text-white"
              : "border-white/20 bg-slate-900/90 text-white hover:border-white/40",
          )}
        >
          <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0">
            {profile.iconDataUrl ? (
              <img
                src={profile.iconDataUrl}
                alt={profile.name || "User"}
                className="h-full w-full object-cover object-top aspect-square"
                crossOrigin="anonymous"
              />
            ) : (
              <FaUser className="h-3.5 w-3.5 text-white/70" />
            )}
          </div>

          <div className="flex max-w-0 opacity-0 group-hover:max-w-[1000px] group-hover:opacity-100 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap items-center pr-2.5 text-xs font-semibold">
            {hasData ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-emerald-400 font-bold whitespace-nowrap">
                  {profile.name}
                </span>
                {profile.isTsgMember && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold shrink-0 whitespace-nowrap">
                    ANGGOTA TSG
                  </span>
                )}
              </div>
            ) : (
              <span className="text-white/80 whitespace-nowrap">Atur Akun</span>
            )}
          </div>
        </button>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-white scrollbar-thin"
            >
              <button
                type="button"
                disabled={isRefreshing || isVerifying}
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <X className="h-4 w-4" />
              </button>

              {(isRefreshing || isVerifying) && (
                <div className="mb-4 flex items-center justify-center gap-2 text-blue-300 text-xs bg-blue-950/50 p-3.5 rounded-xl border border-blue-500/30 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span>
                    {isRefreshing
                      ? "Mengambil data profil terbaru... Mohon tunggu."
                      : "Memeriksa data akun..."}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-6">
                <div
                  onClick={() => setIsLogoModalOpen(true)}
                  title={
                    profile.isTsgMember
                      ? "Klik untuk melihat foto profil"
                      : "Klik untuk lihat/ubah foto profil"
                  }
                  className="relative h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-emerald-500/30"
                >
                  {profile.iconDataUrl ? (
                    <img
                      src={profile.iconDataUrl}
                      alt={profile.name}
                      className="h-full w-full object-cover object-top aspect-square"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <FaUser className="h-5 w-5 text-white/70" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      {profile.name || "Tamu"}
                    </h2>
                    {profile.isTsgMember && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold">
                        ANGGOTA TSG
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 font-medium">
                    {profile.generation
                      ? `GENERASI: ${profile.generation.toUpperCase()}`
                      : "PENGGUNA PUBLIK"}
                  </p>
                </div>
              </div>

              {hasData && !isEditing ? (
                <div className="space-y-4">
                  {errorMsg && (
                    <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 p-3 rounded-xl border border-rose-900/50">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="rounded-2xl bg-white/5 p-4 border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Status Keamanan</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Terverifikasi
                      </span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Akun terverifikasi menggunakan{" "}
                      {profile.authMethod === "password"
                        ? "Password Hashed"
                        : "Vektor Wajah AI"}
                      .
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleRefreshAccount}
                      disabled={isRefreshing || isVerifying}
                      title="Refresh Data Akun"
                      aria-label="Refresh Data Akun"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 transition-colors hover:bg-blue-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none shrink-0"
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          isRefreshing && "animate-spin",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      disabled={isRefreshing || isVerifying}
                      onClick={() => {
                        setIsModalOpen(false);
                        setIsManageAccountOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 py-3 text-sm font-semibold text-emerald-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Kelola Akun</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleStartVerification();
                  }}
                  className="space-y-4"
                >
                  {errorMsg && (
                    <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 p-3 rounded-xl border border-rose-900/50">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isRefreshing || isVerifying}
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="Masukkan nama Anda"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 py-1">
                    <input
                      type="checkbox"
                      id="isTsgMemberCheckbox"
                      disabled={isRefreshing || isVerifying}
                      checked={isTsgMemberCheckbox}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsTsgMemberCheckbox(checked);
                        if (!checked) {
                          setTempGen("");
                        }
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor="isTsgMemberCheckbox"
                      className="text-xs font-semibold text-white/90 cursor-pointer select-none"
                    >
                      Apakah Anda Anggota TSG?
                    </label>
                  </div>

                  <div>
                    <label
                      className={cn(
                        "block text-xs font-medium mb-1.5 transition-colors",
                        isTsgMemberCheckbox ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      Pilih Generasi{" "}
                      {isTsgMemberCheckbox ? "(Wajib)" : "(Anggota TSG Saja)"}
                    </label>
                    <select
                      disabled={!isTsgMemberCheckbox || isRefreshing || isVerifying}
                      required={isTsgMemberCheckbox}
                      value={tempGen}
                      onChange={(e) => setTempGen(e.target.value)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-2.5 text-sm uppercase transition-colors",
                        isTsgMemberCheckbox && !isRefreshing && !isVerifying
                          ? "border-white/15 bg-slate-800 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          : "border-white/5 bg-slate-800/40 text-slate-500 cursor-not-allowed",
                      )}
                    >
                      <option value="">-- PILIH GENERASI --</option>
                      {generations.map((gen) => (
                        <option key={gen} value={gen} className="uppercase">
                          {gen.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {hasData && (
                      <button
                        type="button"
                        disabled={isRefreshing || isVerifying}
                        onClick={() => setIsEditing(false)}
                        className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isRefreshing || isVerifying}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      {isVerifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>Mulai Verifikasi</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-Up Modal Pilih Metode Autentikasi (Daftar Akun Baru) */}
      <AuthMethodChoiceModal
        isOpen={isChoiceModalOpen}
        userName={tempName}
        onClose={() => setIsChoiceModalOpen(false)}
        onSelectMethod={handleSelectChoiceMethod}
      />

      {/* Modal Verifikasi Wajah AI */}
      <FaceVerificationModal
        isOpen={isFaceModalOpen}
        mode={authMode}
        storedFaceVectors={storedFaceVectors}
        initialName={tempName}
        isTsgMember={isTsgMemberState}
        tsgInfo={tsgInfoState}
        onClose={() => setIsFaceModalOpen(false)}
        onVerified={handleAuthSuccess}
      />

      {/* Modal Autentikasi Password & Captcha */}
      <PasswordAuthModal
        isOpen={isPasswordModalOpen}
        mode={authMode}
        userName={tempName}
        isTsgMember={isTsgMemberState}
        tsgInfo={tsgInfoState}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handlePasswordVerified}
      />

      {/* Modal Kelola Akun */}
      <ManageAccountModal
        isOpen={isManageAccountOpen}
        userName={profile.name}
        onClose={() => setIsManageAccountOpen(false)}
        onSwitchAccount={() => {
          setIsManageAccountOpen(false);
          setIsModalOpen(true);
          setIsEditing(true);
          setTempName(profile.name);
          setTempGen(profile.generation);
        }}
        onLogout={() => {
          setIsManageAccountOpen(false);
          setIsLogoutChoiceOpen(true);
        }}
        onRefreshProfile={handleRefreshAccount}
        onAddFaceTrigger={() => {
          setIsManageAccountOpen(false);
          setAuthMode("register");
          setTempName(profile.name);
          setIsFaceModalOpen(true);
        }}
      />

      {/* Modal Opsi Keluar / Hapus Akun */}
      <LogoutChoiceModal
        isOpen={isLogoutChoiceOpen}
        userName={profile.name}
        onClose={() => setIsLogoutChoiceOpen(false)}
        onSelectLogoutOnly={handleSignOut}
        onSelectDeleteAccount={() => {
          setIsLogoutChoiceOpen(false);
          if (profile.isTsgMember) {
            setIsTsgMemberBlockModalOpen(true);
          } else {
            setIsDeleteAccountOpen(true);
          }
        }}
      />

      {/* Pop-Up Modal Proteksi Akun ANGGOTA TSG */}
      <AnimatePresence>
        {isTsgMemberBlockModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md sm:max-w-lg md:max-w-xl rounded-3xl bg-slate-900 border border-amber-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(245,158,11,0.25)] text-white"
            >
              <button
                type="button"
                onClick={() => {
                  setIsTsgMemberBlockModalOpen(false);
                  setIsModalOpen(true);
                }}
                aria-label="Tutup"
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                    PROTEKSI AKUN TSG
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Akun Tidak Dapat Dihapus
                  </h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2 text-xs leading-relaxed text-amber-200 mb-6">
                <p className="font-bold text-amber-300 text-sm">
                  Informasi Status Keanggotaan
                </p>
                <p>
                  Mohon maaf, akun dengan status{" "}
                  <span className="font-bold text-blue-300">ANGGOTA TSG</span>{" "}
                  atas nama{" "}
                  <span className="font-bold text-white">{profile.name}</span>{" "}
                  terdaftar secara resmi dalam database organisasi dan{" "}
                  <span className="underline font-bold text-amber-300">
                    tidak dapat dihapus secara mandiri
                  </span>
                  .
                </p>
                <p className="text-amber-300/80 pt-1">
                  Jika terdapat kekeliruan data atau kendala akun, silakan
                  hubungi pengurus The Smart Generation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsTsgMemberBlockModalOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-xs text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Mengerti, Kembali ke Profil</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-Up Modal Alert: Akun Tidak Terdaftar Dalam Anggota TSG */}
      <AnimatePresence>
        {isNotTsgMemberAlertOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 p-6 sm:p-7 shadow-[0_0_80px_rgba(225,29,72,0.25)] text-white"
            >
              <button
                type="button"
                onClick={() => {
                  setIsNotTsgMemberAlertOpen(false);
                  setTempName(submittedName);
                  setTempGen(submittedGen);
                  setIsTsgMemberCheckbox(true);
                  setIsEditing(true);
                  setIsModalOpen(true);
                }}
                aria-label="Tutup"
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-rose-400 uppercase bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/40">
                    VERIFIKASI KEANGGOTAAN
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Tidak Terdaftar Anggota TSG
                  </h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-2 text-xs leading-relaxed text-rose-200 mb-6">
                <p className="font-bold text-rose-300 text-sm">
                  Nama/Akun Tidak Ditemukan
                </p>
                <p>
                  Mohon maaf, nama{" "}
                  <span className="font-bold text-white">"{submittedName || tempName}"</span>{" "}
                  {submittedGen || tempGen ? (
                    <>
                      pada generasi{" "}
                      <span className="font-bold text-emerald-300 uppercase">
                        {submittedGen || tempGen}
                      </span>{" "}
                    </>
                  ) : null}
                  tidak terdaftar dalam database resmi anggota{" "}
                  <span className="font-bold text-blue-300">
                    The Smart Generation (TSG)
                  </span>
                  .
                </p>
                <p className="text-rose-300/80 pt-1">
                  Jika Anda adalah anggota resmi TSG, pastikan penulisan nama dan pilihan generasi sudah sesuai, atau hubungi pengurus TSG.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsNotTsgMemberAlertOpen(false);
                  setTempName(submittedName);
                  setTempGen(submittedGen);
                  setIsTsgMemberCheckbox(true);
                  setIsEditing(true);
                  setIsModalOpen(true);
                }}
                className="w-full py-3 bg-rose-500 hover:bg-rose-400 rounded-xl font-bold text-xs text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Modal Login</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Hapus Akun 3-Step */}
      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        userName={profile.name}
        onClose={() => setIsDeleteAccountOpen(false)}
        onAccountDeleted={handleSignOut}
      />

      {/* Modal Notifikasi Persetujuan Perangkat */}
      {pendingLoginRequest && (
        <DeviceApprovalModal
          requestData={pendingLoginRequest}
          onRespond={async (decision) => {
            try {
              await fetch("/api/session/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  requestId: pendingLoginRequest.id,
                  decision,
                  userId: profile.email,
                  requesterDeviceInfo:
                    pendingLoginRequest.requester_device_info,
                }),
              });
            } catch (e) {}
            setPendingLoginRequest(null);
          }}
        />
      )}

      {/* Modal Brand Logo Inspect / Foto Profil */}
      <LogoModal
        isOpen={isLogoModalOpen}
        logoUrl={profile.iconDataUrl}
        alt={profile.name}
        isTsgMember={profile.isTsgMember}
        onClose={() => setIsLogoModalOpen(false)}
        onUpdatePhoto={(newPhotoUrl) => {
          const updated = { ...profile, iconDataUrl: newPhotoUrl };
          setProfile(updated);
          localStorage.setItem("tsg_user_profile", JSON.stringify(updated));
        }}
      />

      {/* Modal Verifikasi OTP Login Email */}
      {pendingLoginProfile && (
        <LoginVerifURLModal
          isOpen={isLoginOtpModalOpen}
          email={pendingLoginProfile.email || ""}
          userName={pendingLoginProfile.name || ""}
          onClose={() => {
            setIsLoginOtpModalOpen(false);
            setPendingLoginProfile(null);
          }}
          onVerified={() => {
            if (pendingLoginProfile) {
              finalizeLogin(pendingLoginProfile);
            }
          }}
        />
      )}
    </>
  );
}

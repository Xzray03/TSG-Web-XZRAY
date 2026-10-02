"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser } from "react-icons/fa";
import {
  X,
  Check,
  AlertCircle,
  LogOut,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
  Globe,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/types";
import FaceVerificationModal from "@/components/auth/FaceVerificationModal";
import PasswordAuthModal from "@/components/auth/PasswordAuthModal";
import LogoutChoiceModal from "@/components/auth/LogoutChoiceModal";
import DeleteAccountModal from "@/components/auth/DeleteAccountModal";
import DeviceApprovalModal from "@/components/auth/DeviceApprovalModal";
import ManageAccountModal from "@/components/auth/ManageAccountModal";
import ManagePublicAccountModal from "@/components/auth/ManagePublicAccountModal";
import TotpPromptModal from "@/components/auth/TotpPromptModal";
import { PublicProfilePreviewModal } from "@/components/auth/PublicProfilePreviewModal";
import { LoginVerifURLModal } from "@/components/auth/LoginVerifURLModal";
import { LogoModal } from "@/components/layout/LogoModal";
import { TSGRegistrationVerifModal } from "@/components/auth/TSGRegistrationVerifModal";
import { buildLoginProof } from "@/lib/deviceAuth";
import { getStepUpProof } from "@/lib/stepUp";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  checkAccountAction,
  beginLoginAction,
  finishLoginAction,
  loginTotpAction,
  pollDeviceApprovalAction,
  getSessionAction,
  getMyAccountAction,
  logoutAction,
  updateProfileAction,
} from "@/actions/authActions";
import { getPublicAccountAction } from "@/actions/publicAccountActions";
import { respondDeviceRequestAction } from "@/actions/sessionActions";
import { getGenerationsAction, getTeamMembersAction } from "@/actions/teamActions";
import { formatAccountCreatedAt } from "@/lib/format-account-date";

interface UserProfile {
  id?: string;
  name: string;
  generation: string;
  iconDataUrl: string;
  email?: string;
  isTsgMember?: boolean;
  authMethod?: "face" | "password" | "both";
  createdAt?: string;
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
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLogoutChoiceOpen, setIsLogoutChoiceOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isManageAccountOpen, setIsManageAccountOpen] = useState(false);
  const [isManagePublicAccountOpen, setIsManagePublicAccountOpen] = useState(false);
  const [isSequentialLogin, setIsSequentialLogin] = useState(false);
  const [isTsgMemberBlockModalOpen, setIsTsgMemberBlockModalOpen] =
    useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isTsgVerifOpen, setIsTsgVerifOpen] = useState(false);

  const [isLoginOtpModalOpen, setIsLoginOtpModalOpen] = useState(false);
  const [isLoginTotpOpen, setIsLoginTotpOpen] = useState(false);
  const [totpPromptError, setTotpPromptError] = useState("");
  const [isTotpSubmitting, setIsTotpSubmitting] = useState(false);
  const [pendingLoginProfile, setPendingLoginProfile] =
    useState<UserProfile | null>(null);

  const [authMode, setAuthMode] = useState<"register" | "login">("login");
  const [accountDataState, setAccountDataState] = useState<any>(null);
  const [isAddFaceFlow, setIsAddFaceFlow] = useState(false);
  const [addFacePassword, setAddFacePassword] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isDeviceWaitingOpen, setIsDeviceWaitingOpen] = useState(false);
  const [emailHint, setEmailHint] = useState("");
  const loginFlow = useRef<{
    required: { password: boolean; face: boolean; email: boolean; totp: boolean };
    done: { password?: boolean; face?: boolean; email?: boolean; totp?: boolean };
    loginId: string;
    nonce: string;
  } | null>(null);
  const devicePollRef = useRef<any>(null);
  const [isTsgMemberState, setIsTsgMemberState] = useState(false);
  const [tsgInfoState, setTsgInfoState] = useState<any>(null);
  const [loginPreferencesState, setLoginPreferencesState] = useState<{
    password?: boolean;
    face?: boolean;
    email?: boolean;
  } | null>(null);

  // Public Account Info state
  const [publicAccountInfo, setPublicAccountInfo] = useState<any>(null);
  const [isLoadingPublicAccount, setIsLoadingPublicAccount] = useState(false);
  const [isPreviewPublicProfileOpen, setIsPreviewPublicProfileOpen] = useState(false);

  // Session lock
  const [pendingLoginRequest, setPendingLoginRequest] = useState<any>(null);

  const isAnyModalOpen =
    isModalOpen ||
    isFaceModalOpen ||
    isPasswordModalOpen ||
    isLogoutChoiceOpen ||
    isDeleteAccountOpen ||
    isManageAccountOpen ||
    isManagePublicAccountOpen ||
    isPreviewPublicProfileOpen ||
    isTsgMemberBlockModalOpen ||
    isLogoModalOpen ||
    isLoginOtpModalOpen ||
    isDeviceWaitingOpen ||
    isNotTsgMemberAlertOpen;

  useScrollLock(isAnyModalOpen);

  useSessionHeartbeat(isSessionActive, (req) => {
    setPendingLoginRequest((prev: any) => prev || req);
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [genData, memberData] = await Promise.all([
          getGenerationsAction(),
          getTeamMembersAction(),
        ]);

        if (Array.isArray(genData)) setGenerations(genData);
        if (Array.isArray(memberData)) setTeamMembers(memberData);
      } catch (e) {}
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function sha256Client(text: string): Promise<string> {
      if (!text) return "";
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        return "";
      }
    }

    async function restoreAndVerifySession() {
      let cached: UserProfile | null = null;
      try {
        const saved = localStorage.getItem("tsg_user_profile");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name) {
            cached = parsed;
            setProfile(parsed); // render instan dari cache (hanya tampilan, bukan kredensial)
          }
        }
      } catch (e) {
        localStorage.removeItem("tsg_user_profile");
      }

      try {
        // Kebenaran ada di server: tanpa sesi sah, cache dibuang.
        const sess: any = await getSessionAction();
        if (!sess || !sess.authenticated || !sess.profile) {
          localStorage.removeItem("tsg_user_profile");
          if (cached) {
            setProfile({ name: "", generation: "", iconDataUrl: "", email: "", isTsgMember: false });
          }
          setIsSessionActive(false);
          return;
        }
        setIsSessionActive(true);
        const sp = sess.profile;
        if (cached) {
          const localPhotoHash = cached.iconDataUrl ? await sha256Client(cached.iconDataUrl) : "";
          const isSame =
            cached.id === sp.id &&
            (cached.name || "") === sp.name &&
            (cached.generation || "").trim().toLowerCase() === (sp.generation || "").trim().toLowerCase() &&
            (cached.email || "").trim().toLowerCase() === (sp.email || "").trim().toLowerCase() &&
            Boolean(cached.isTsgMember) === Boolean(sp.isTsgMember) &&
            localPhotoHash === (sp.photoHash || "");
          if (isSame) {
            fetchPublicAccountInfo();
            return;
          }
        }
        const full: any = await getMyAccountAction();
        if (full && !full.error) {
          const updated: UserProfile = {
            id: full.id,
            name: full.name,
            generation: full.generation || "",
            iconDataUrl: full.photo || "",
            email: full.email || "",
            isTsgMember: !!full.isTsgMember,
            authMethod: full.authMethod,
            createdAt: full.createdAt,
          };
          localStorage.setItem("tsg_user_profile", JSON.stringify(updated));
          setProfile(updated);
          fetchPublicAccountInfo();
        }
      } catch {}
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
      const data: any = await getMyAccountAction();

      if (data && !data.error) {
        const updatedProfile: UserProfile = {
          id: data.id,
          name: data.name,
          generation: data.generation || profile.generation,
          iconDataUrl: data.photo || profile.iconDataUrl,
          email: data.email || "",
          isTsgMember: !!data.isTsgMember,
          authMethod: data.authMethod || profile.authMethod,
          createdAt: data.createdAt || profile.createdAt,
        };

        setProfile(updatedProfile);
        localStorage.setItem("tsg_user_profile", JSON.stringify(updatedProfile));
        fetchPublicAccountInfo();
      }
    } catch (err: any) {
      setErrorMsg("Gagal memperbarui data akun.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchPublicAccountInfo = async (_ignored?: string) => {
    setIsLoadingPublicAccount(true);
    try {
      const data: any = await getPublicAccountAction();
      if (data && data.publicAccount) {
        setPublicAccountInfo(data.publicAccount);
      }
    } catch (e) {
    } finally {
      setIsLoadingPublicAccount(false);
    }
  };

  useEffect(() => {
    if (profile.id && isSessionActive) {
      fetchPublicAccountInfo();
    }
    const handleProfileUpdated = () => {
      fetchPublicAccountInfo();
    };
    window.addEventListener("tsg_profile_updated", handleProfileUpdated);
    return () => window.removeEventListener("tsg_profile_updated", handleProfileUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, isSessionActive]);

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
      const data: any = await checkAccountAction(tempName.trim());

      if (data && data.error) {
        throw new Error(data.error || "Gagal memeriksa akun di database.");
      }

      setAccountDataState(data);

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
      setLoginPreferencesState(data.loginPreferences || null);

      if (!data.exists) {
        // AKUN BELUM ADA: pendaftaran SELALU dengan password (wajah ditambahkan kemudian dari Kelola Akun).
        setAuthMode("register");
        if (isTsgMemberCheckbox && data.isTsgMember) {
          setIsTsgVerifOpen(true);
        } else {
          setIsPasswordModalOpen(true);
        }
      } else {
        // AKUN SUDAH ADA: server memulai proses login dan menentukan langkah yang wajib.
        setAuthMode("login");
        const begin: any = await beginLoginAction(tempName.trim());
        if (!begin?.success) {
          throw new Error(begin?.error || "Gagal memulai proses login.");
        }
        loginFlow.current = { required: begin.required, done: {}, loginId: begin.loginId, nonce: begin.nonce };
        setEmailHint(begin.emailMasked || "");
        proceedLogin();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memeriksa akun.");
    } finally {
      setIsVerifying(false);
    }
  };

  /** Buka langkah login berikutnya sesuai yang diwajibkan server; bila semua selesai, selesaikan dengan bukti perangkat. */
  const proceedLogin = () => {
    const flow = loginFlow.current;
    if (!flow) return;
    setIsPasswordModalOpen(false);
    setIsFaceModalOpen(false);
    setIsLoginOtpModalOpen(false);
    setIsLoginTotpOpen(false);

    if (flow.required.password && !flow.done.password) {
      setIsAddFaceFlow(false);
      setIsPasswordModalOpen(true);
    } else if (flow.required.face && !flow.done.face) {
      setIsAddFaceFlow(false);
      setIsFaceModalOpen(true);
    } else if (flow.required.email && !flow.done.email) {
      setIsLoginOtpModalOpen(true);
    } else if (flow.required.totp && !flow.done.totp) {
      // Gate TOTP terakhir sebelum finishLogin
      setTotpPromptError("");
      setIsLoginTotpOpen(true);
    } else {
      void finishLogin();
    }
  };

  const markStepDone = (step: "password" | "face" | "email" | "totp") => {
    if (loginFlow.current) {
      loginFlow.current.done = { ...loginFlow.current.done, [step]: true };
    }
    proceedLogin();
  };

  const handleLoginTotpSubmit = async (code: string) => {
    setIsTotpSubmitting(true);
    setTotpPromptError("");
    try {
      const res: any = await loginTotpAction({ code });
      if (res?.error) {
        setTotpPromptError(res.error || "Kode tidak valid.");
        return;
      }
      setIsLoginTotpOpen(false);
      markStepDone("totp");
    } catch (err: any) {
      setTotpPromptError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsTotpSubmitting(false);
    }
  };

  const completeLogin = async (serverProfile: any) => {
    // Sesi server sudah aktif: ambil data lengkap (termasuk foto) dari server.
    let full: any = null;
    try {
      full = await getMyAccountAction();
    } catch {}
    const base = full && !full.error ? full : serverProfile || {};
    const finalProfile: UserProfile = {
      id: base.id,
      name: base.name || tempName.trim(),
      generation: base.generation || "",
      iconDataUrl: base.photo || tsgInfoState?.photo || "",
      email: base.email || "",
      isTsgMember: !!base.isTsgMember,
      authMethod: base.authMethod,
      createdAt: base.createdAt,
    };
    setProfile(finalProfile);
    setIsSessionActive(true);
    localStorage.setItem("tsg_user_profile", JSON.stringify(finalProfile));
    loginFlow.current = null;
    setIsDeviceWaitingOpen(false);
    setTempName("");
    setTempGen("");
    setErrorMsg("");
    setIsEditing(false);
    setIsModalOpen(false);
    window.location.reload();
  };

  const failLogin = (message: string) => {
    loginFlow.current = null;
    setIsPasswordModalOpen(false);
    setIsFaceModalOpen(false);
    setIsLoginOtpModalOpen(false);
    setIsDeviceWaitingOpen(false);
    if (devicePollRef.current) clearInterval(devicePollRef.current);
    setErrorMsg(message);
    setIsModalOpen(true);
  };

  const finishLogin = async () => {
    const flow = loginFlow.current;
    if (!flow) return;
    try {
      const proof = await buildLoginProof(flow.nonce, flow.loginId);
      const res: any = await finishLoginAction(proof);
      if (res?.error) {
        failLogin(res.error);
        return;
      }
      if (res?.status === "ok") {
        await completeLogin(res.profile);
        return;
      }
      if (res?.status === "waiting") {
        setIsDeviceWaitingOpen(true);
        if (devicePollRef.current) clearInterval(devicePollRef.current);
        devicePollRef.current = setInterval(async () => {
          try {
            const r: any = await pollDeviceApprovalAction();
            if (r?.status === "ok") {
              clearInterval(devicePollRef.current);
              await completeLogin(r.profile);
            } else if (r?.status === "rejected") {
              clearInterval(devicePollRef.current);
              failLogin("Permintaan login ditolak oleh perangkat utama.");
            } else if (r?.error) {
              clearInterval(devicePollRef.current);
              failLogin(r.error);
            }
          } catch {}
        }, 3000);
        return;
      }
      failLogin("Gagal menyelesaikan login.");
    } catch (e: any) {
      failLogin(e?.message || "Gagal menyelesaikan login (verifikasi perangkat).");
    }
  };

  /** Hasil dari PasswordAuthModal (login atau pendaftaran). */
  const handlePasswordVerified = (data: any) => {
    if (data?.step === "registered") {
      loginFlow.current = {
        required: data.required || { password: true, face: false, email: false },
        done: { password: true },
        loginId: data.loginId,
        nonce: data.nonce,
      };
      proceedLogin();
      return;
    }
    markStepDone("password");
  };

  const handleFaceVerified = () => {
    if (isAddFaceFlow) {
      // Menambah wajah ke akun yang sedang login (bukan langkah login).
      setIsAddFaceFlow(false);
      setAddFacePassword("");
      handleRefreshAccount();
      return;
    }
    markStepDone("face");
  };

  const handleSignOut = async () => {
    try {
      await logoutAction();
    } catch (e) {}
    if (devicePollRef.current) clearInterval(devicePollRef.current);
    localStorage.removeItem("tsg_user_profile");
    setIsSessionActive(false);
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
    window.location.reload();
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
              <Image
                src={profile.iconDataUrl}
                alt={profile.name || "User"}
                width={32}
                height={32}
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
              className="relative my-auto w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-white/20 p-6 shadow-2xl text-white scrollbar-thin"
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
                  title="Klik untuk lihat/ubah foto profil"
                  className="relative h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-emerald-500/30"
                >
                  {profile.iconDataUrl ? (
                    <Image
                      src={profile.iconDataUrl}
                      alt={profile.name}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover object-top aspect-square"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <FaUser className="h-5 w-5 text-white/70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white truncate">
                      {profile.name || "Tamu"}
                    </h2>
                    {profile.isTsgMember && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold shrink-0">
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

                  {isLoadingPublicAccount && (
                    <div className="rounded-2xl bg-blue-500/5 p-4 border border-blue-500/20 space-y-2 animate-pulse">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Informasi Akun Publik</span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        Memuat data akun publik...
                      </p>
                    </div>
                  )}

                  {!isLoadingPublicAccount && publicAccountInfo && (
                    <div className="rounded-2xl bg-blue-500/5 p-4 border border-blue-500/20 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/60 font-medium">Informasi Akun Publik</span>
                        <button
                          type="button"
                          onClick={() => setIsPreviewPublicProfileOpen(true)}
                          className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-400/30"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>@{publicAccountInfo.nickname}</span>
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/20 text-[10px] ml-0.5">👁</span>
                        </button>
                      </div>

                      {/* Nama & Umur */}
                      {publicAccountInfo.name && (
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-white/50">Nama Publik</span>
                          <span className="text-white/90 font-semibold">
                            {publicAccountInfo.name}
                            {publicAccountInfo.age ? ` (${publicAccountInfo.age} thn)` : ""}
                          </span>
                        </div>
                      )}

                      {/* Bio */}
                      {publicAccountInfo.bio && (
                        <p className="text-xs text-white/70 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10 break-words whitespace-pre-wrap">
                          {publicAccountInfo.bio}
                        </p>
                      )}

                      {/* Badge Anggota TSG */}
                      {publicAccountInfo.show_tsg_member && (
                        <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 font-bold w-fit">
                          <UserCheck className="h-3 w-3" />
                          <span>ANGGOTA TSG</span>
                        </div>
                      )}

                      {/* Website */}
                      {publicAccountInfo.website && (
                        <div className="flex justify-between items-center text-xs gap-2">
                          <span className="text-white/50 shrink-0 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Website
                          </span>
                          <a
                            href={publicAccountInfo.website.startsWith("http") ? publicAccountInfo.website : `https://${publicAccountInfo.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 hover:text-blue-200 font-medium truncate max-w-[60%] text-right hover:underline"
                          >
                            {publicAccountInfo.website.replace(/^https?:\/\//, "")}
                          </a>
                        </div>
                      )}

                      {/* Social Media (Link saja) */}
                      {publicAccountInfo.social_media && Object.entries(publicAccountInfo.social_media as Record<string, string>).some(([_, v]) => v && String(v).trim()) && (
                        <div className="space-y-2 pt-1 border-t border-white/10">
                          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold pt-2">Tautan Media Sosial</p>
                          {Object.entries(publicAccountInfo.social_media as Record<string, string>)
                            .filter(([_, v]) => v && String(v).trim())
                            .map(([key, val]) => (
                              <div key={key} className="flex justify-between items-center text-xs gap-2">
                                <span className="text-white/50 capitalize shrink-0">{key}</span>
                                <a
                                  href={String(val).startsWith("http") ? String(val) : `https://${String(val)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-300 hover:text-blue-200 font-medium truncate max-w-[60%] text-right hover:underline"
                                >
                                  {String(val).replace(/^https?:\/\//, "").replace(/^www\./, "")}
                                </a>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleRefreshAccount}
                      disabled={isRefreshing || isVerifying}
                      title="Refresh Data Akun"
                      aria-label="Refresh Data Akun"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 transition-colors hover:bg-blue-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
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
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-sm font-semibold text-emerald-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Kelola Akun</span>
                    </button>
                    <button
                      type="button"
                      disabled={isRefreshing || isVerifying}
                      onClick={() => {
                        setIsModalOpen(false);
                        setIsManagePublicAccountOpen(true);
                      }}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-sm font-semibold text-blue-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Kelola Akun Publik</span>
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

              {(() => {
                const createdText = formatAccountCreatedAt(
                  profile.createdAt || publicAccountInfo?.real_account_created_at || publicAccountInfo?.created_at
                );
                return createdText ? (
                  <p className="mt-4 text-left text-[10px] text-white/40 italic font-mono">
                    {createdText}
                  </p>
                ) : null;
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Verifikasi Wajah AI */}
      <FaceVerificationModal
        isOpen={isFaceModalOpen}
        mode={isAddFaceFlow ? "register" : "login"}
        addFacePassword={addFacePassword}
        initialName={isAddFaceFlow ? profile.name : tempName}
        isTsgMember={isTsgMemberState}
        tsgInfo={tsgInfoState}
        accountData={accountDataState}
        onClose={() => {
          setIsFaceModalOpen(false);
          if (isAddFaceFlow) {
            setIsAddFaceFlow(false);
            setAddFacePassword("");
          }
        }}
        onVerified={handleFaceVerified}
      />

      {/* Modal Verifikasi Pendaftaran Anggota TSG */}
      <TSGRegistrationVerifModal
        isOpen={isTsgVerifOpen}
        name={tempName.trim()}
        generation={tempGen || tsgInfoState?.categoryName || "Member"}
        onClose={() => setIsTsgVerifOpen(false)}
        onApproved={() => {
          setIsTsgVerifOpen(false);
          setIsPasswordModalOpen(true);
        }}
      />

      {/* Modal Autentikasi Password & Captcha */}
      <PasswordAuthModal
        isOpen={isPasswordModalOpen}
        mode={authMode}
        userName={tempName}
        isTsgMember={isTsgMemberState}
        tsgInfo={tsgInfoState}
        accountData={accountDataState}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handlePasswordVerified}
      />

      {/* Modal Prompt TOTP untuk Login */}
      <TotpPromptModal
        isOpen={isLoginTotpOpen}
        title="Verifikasi 2FA Diperlukan"
        subtitle="Akun Anda dilindungi 2FA. Masukkan kode 6 digit atau recovery code."
        isLoading={isTotpSubmitting}
        error={totpPromptError}
        onSubmit={handleLoginTotpSubmit}
        onClose={() => {
          setIsLoginTotpOpen(false);
          failLogin("Proses login dibatalkan pada verifikasi 2FA.");
        }}
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
        onAddFaceTrigger={(pw: string) => {
          setIsManageAccountOpen(false);
          setAddFacePassword(pw);
          setIsAddFaceFlow(true);
          setIsFaceModalOpen(true);
        }}
      />

      {/* Modal Kelola Akun Publik */}
      <ManagePublicAccountModal
        isOpen={isManagePublicAccountOpen}
        realAccountId={profile.id || ""}
        realAccountName={profile.name}
        isTsgMember={!!profile.isTsgMember}
        defaultAvatarUrl={profile.iconDataUrl}
        onClose={() => {
          setIsManagePublicAccountOpen(false);
          if (profile.id) {
            fetchPublicAccountInfo(profile.id);
          }
        }}
      />

      {/* Modal Preview Profil Publik */}
      <PublicProfilePreviewModal
        isOpen={isPreviewPublicProfileOpen}
        publicAccount={publicAccountInfo}
        defaultAvatarUrl={profile.iconDataUrl}
        onClose={() => setIsPreviewPublicProfileOpen(false)}
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
              className="relative my-auto w-full max-w-md sm:max-w-lg md:max-w-xl rounded-3xl bg-slate-900 border border-amber-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(245,158,11,0.25)] text-white"
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
              className="relative my-auto w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 p-6 sm:p-7 shadow-[0_0_80px_rgba(225,29,72,0.25)] text-white"
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
              const proof = await getStepUpProof("approve_device");
              await respondDeviceRequestAction({
                deviceId: pendingLoginRequest.deviceId || pendingLoginRequest.id,
                decision,
                proof,
              });
            } catch (e) {}
            setPendingLoginRequest(null);
          }}
        />
      )}

      {/* Menunggu persetujuan perangkat utama */}
      {isDeviceWaitingOpen && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-400" />
            <h3 className="text-lg font-bold">Menunggu Persetujuan</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              Perangkat ini belum terdaftar. Buka akun Anda di perangkat utama lalu setujui permintaan login.
            </p>
            <button
              type="button"
              onClick={() => failLogin("Login dibatalkan.")}
              className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/20"
            >
              Batalkan
            </button>
          </div>
        </div>
      )}

      {/* Modal Brand Logo Inspect / Foto Profil */}
      <LogoModal
        isOpen={isLogoModalOpen}
        logoUrl={profile.iconDataUrl}
        alt={profile.name}
        isTsgMember={profile.isTsgMember}
        sanityPhotoUrl={tsgInfoState?.photo}
        onClose={() => setIsLogoModalOpen(false)}
        onUpdatePhoto={(newPhotoUrl) => {
          const updated = { ...profile, iconDataUrl: newPhotoUrl };
          setProfile(updated);
          localStorage.setItem("tsg_user_profile", JSON.stringify(updated));
          if (profile.name) {
            updateProfileAction({ photo: newPhotoUrl })
              .then(() => {
                fetchPublicAccountInfo();
              })
              .catch(() => {});
          }
        }}
      />

      {/* Langkah email pada login: tautan SEGAR diperiksa server */}
      <LoginVerifURLModal
        isOpen={isLoginOtpModalOpen}
        email={emailHint}
        userName={tempName}
        purpose="login"
        onClose={() => {
          setIsLoginOtpModalOpen(false);
          loginFlow.current = null;
        }}
        onVerified={() => markStepDone("email")}
      />
    </>
  );
}

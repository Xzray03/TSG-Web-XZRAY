"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function StudioAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const verifyAccess = () => {
      try {
        const savedProfile = localStorage.getItem("tsg_user_profile");

        if (!savedProfile) {
          setErrorMsg("Sesi login tidak ditemukan. Mengalihkan ke Beranda...");
          timeoutId = setTimeout(() => {
            router.replace("/");
          }, 2000);
          return;
        }

        const profile = JSON.parse(savedProfile);

        if (!profile || !profile.name) {
          setErrorMsg("Sesi login tidak valid. Mengalihkan ke Beranda...");
          timeoutId = setTimeout(() => {
            router.replace("/");
          }, 2000);
          return;
        }

        if (profile.isTsgMember !== true) {
          setErrorMsg("Akses ditolak: Hanya Anggota TSG terverifikasi yang dapat mengakses Studio. Mengalihkan ke Beranda...");
          timeoutId = setTimeout(() => {
            router.replace("/");
          }, 3000);
          return;
        }

        // Semua pengecekan lulus
        setIsAuthorized(true);
        // Jeda sedikit untuk animasi transisi UI yang mulus
        timeoutId = setTimeout(() => {
          setIsVerifying(false);
        }, 1200);

      } catch (error) {
        console.error("Studio Auth Guard Error:", error);
        setErrorMsg("Terjadi kesalahan sistem. Mengalihkan ke Beranda...");
        timeoutId = setTimeout(() => {
          router.replace("/");
        }, 2000);
      }
    };

    // Jeda sebentar agar UI loading muncul dengan baik sebelum verifikasi selesai
    timeoutId = setTimeout(verifyAccess, 800);

    return () => clearTimeout(timeoutId);
  }, [router]);

  if (!isVerifying && isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-4 text-center">
      <AnimatePresence mode="wait">
        {errorMsg ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex max-w-sm flex-col items-center"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/30">
              <ShieldAlert className="h-10 w-10 text-rose-500 animate-pulse" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">Akses Ditolak</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {errorMsg}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(4px)" }}
            transition={{ duration: 0.4 }}
            className="flex max-w-sm flex-col items-center"
          >
            <div className="mb-8 relative flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-full scale-75 blur-md animate-pulse" />
              <ShieldCheck className="relative h-10 w-10 text-blue-500" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-white tracking-tight">
              Otentikasi Studio
            </h2>
            <p className="text-slate-400 text-sm max-w-[280px]">
              Memverifikasi sesi Anggota TSG Anda. Mohon tunggu sebentar...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

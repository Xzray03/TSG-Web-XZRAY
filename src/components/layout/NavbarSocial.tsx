"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, MessageSquare, MessageCircle } from "lucide-react";
import { getPublicAccountAction } from "@/actions/publicAccountActions";

export function NavbarSocial() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndPublicAccount() {
      try {
        const saved = localStorage.getItem("tsg_user_profile");
        if (!saved) {
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        const profile = JSON.parse(saved);
        if (!profile || !profile.name) {
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        let realAccountId = profile.id;
        if (!realAccountId) {
          // If ID is not in localStorage, try checking via name action or similar if needed,
          // but if profile has id, check public account:
          setIsLoading(false);
          return;
        }

        const res = await getPublicAccountAction(realAccountId);
        if (res && res.publicAccount && res.publicAccount.nickname) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (e) {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthAndPublicAccount();

    // Listen for storage changes or profile updates
    const handleStorageChange = () => {
      checkAuthAndPublicAccount();
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tsg_profile_updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tsg_profile_updated", handleStorageChange);
    };
  }, []);

  if (isLoading || !isAuthorized) {
    return null;
  }

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[9998] flex items-center">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="navbar-social-open"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-r-2xl p-2 shadow-2xl"
          >
            <div className="flex flex-col gap-2 items-center pr-1">
              <Link
                href="/social"
                className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-blue-500/20 hover:from-emerald-500/30 hover:to-blue-500/30 border border-emerald-500/30 text-white font-semibold text-xs transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap shadow-lg shadow-emerald-500/10"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
                <span>Social</span>
              </Link>
              <Link
                href="/chat"
                className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 border border-blue-500/30 text-white font-semibold text-xs transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap shadow-lg shadow-blue-500/10"
              >
                <MessageCircle className="w-4 h-4 text-blue-400 group-hover:rotate-12 transition-transform" />
                <span>Chat</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup Navbar Social"
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer border border-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="navbar-social-closed"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Buka Navbar Social"
              className="flex h-12 w-8 items-center justify-center rounded-r-2xl bg-slate-900/90 backdrop-blur-xl border-y border-r border-white/20 text-white/80 hover:text-white hover:bg-slate-800/90 transition-all duration-300 cursor-pointer shadow-lg hover:w-10 group"
            >
              <ChevronRight className="w-4 h-4 group-hover:scale-125 transition-transform text-emerald-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

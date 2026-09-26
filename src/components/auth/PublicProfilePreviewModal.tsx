"use client";

import React, { useState } from "react";
import {
  X,
  Globe,
  UserCheck,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { FaUser, FaLinkedin, FaGithub, FaYoutube, FaTiktok, FaInstagram, FaFacebook, FaWhatsapp, FaLine } from "react-icons/fa";
import { LogoModal } from "@/components/layout/LogoModal";
import { useScrollLock } from "@/hooks/useScrollLock";

interface PublicProfilePreviewModalProps {
  isOpen: boolean;
  publicAccount: any;
  onClose: () => void;
}

const SOCIAL_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  linkedin: { icon: FaLinkedin, color: "text-blue-400", label: "LinkedIn" },
  github: { icon: FaGithub, color: "text-white", label: "GitHub" },
  youtube: { icon: FaYoutube, color: "text-red-400", label: "YouTube" },
  tiktok: { icon: FaTiktok, color: "text-white", label: "TikTok" },
  instagram: { icon: FaInstagram, color: "text-pink-400", label: "Instagram" },
  facebook: { icon: FaFacebook, color: "text-blue-500", label: "Facebook" },
  whatsapp: { icon: FaWhatsapp, color: "text-emerald-400", label: "WhatsApp" },
  line: { icon: FaLine, color: "text-emerald-500", label: "LINE" },
};

export function PublicProfilePreviewModal({
  isOpen,
  publicAccount,
  onClose,
}: PublicProfilePreviewModalProps) {
  useScrollLock(isOpen);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  if (!isOpen || !publicAccount) return null;

  const validSocials = publicAccount.social_media
    ? Object.entries(publicAccount.social_media as Record<string, string>).filter(
        ([_, val]) => val && String(val).trim()
      )
    : [];

  return (
    <>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
        <div className="relative my-auto w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-blue-500/30 p-6 sm:p-7 shadow-[0_0_100px_rgba(0,0,0,0.9)] text-white scrollbar-thin animate-in fade-in zoom-in duration-200">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header Profile */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div
              onClick={() => {
                if (publicAccount.avatar_url) {
                  setIsPhotoModalOpen(true);
                }
              }}
              title={publicAccount.avatar_url ? "Klik untuk melihat foto profil penuh" : undefined}
              className={`relative h-24 w-24 overflow-hidden rounded-full border-2 border-blue-500/40 bg-slate-800 flex items-center justify-center mb-4 ring-4 ring-blue-500/10 shadow-xl ${
                publicAccount.avatar_url ? "cursor-pointer hover:scale-105 active:scale-95 transition-transform" : ""
              }`}
            >
              {publicAccount.avatar_url ? (
                <img
                  src={publicAccount.avatar_url}
                  alt={publicAccount.name || publicAccount.nickname}
                  className="h-full w-full object-cover object-top aspect-square"
                  crossOrigin="anonymous"
                />
              ) : (
                <FaUser className="h-10 w-10 text-white/50" />
              )}
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              {publicAccount.name || `@${publicAccount.nickname}`}
            </h3>

            <p className="text-sm font-semibold text-blue-400 mt-0.5">
              @{publicAccount.nickname}
            </p>

            {publicAccount.show_tsg_member && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-bold">
                <UserCheck className="h-3.5 w-3.5" />
                <span>ANGGOTA TSG</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Umur jika diisi */}
            {publicAccount.age && (
              <div className="flex items-center justify-between text-xs bg-white/5 p-3.5 rounded-2xl border border-white/10">
                <span className="text-white/50 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> Usia
                </span>
                <span className="text-white font-medium">{publicAccount.age} Tahun</span>
              </div>
            )}

            {/* Bio jika diisi */}
            {publicAccount.bio && (
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Bio</span>
                <p className="text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
                  {publicAccount.bio}
                </p>
              </div>
            )}

            {/* Website jika diisi */}
            {publicAccount.website && (
              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between text-xs gap-3">
                <span className="text-white/50 flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-blue-400" /> Website
                </span>
                <a
                  href={publicAccount.website.startsWith("http") ? publicAccount.website : `https://${publicAccount.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-blue-200 font-medium truncate hover:underline flex items-center gap-1 max-w-[65%]"
                >
                  <span className="truncate">{publicAccount.website.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}

            {/* Tautan Media Sosial jika ada */}
            {validSocials.length > 0 && (
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 block">Media Sosial</span>
                <div className="space-y-2">
                  {validSocials.map(([key, val]) => {
                    const iconConfig = SOCIAL_ICONS[key.toLowerCase()];
                    const IconComp = iconConfig?.icon || Globe;
                    const colorClass = iconConfig?.color || "text-blue-400";
                    const labelText = iconConfig?.label || key;

                    return (
                      <div key={key} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-white/60 flex items-center gap-2 capitalize">
                          <IconComp className={`w-3.5 h-3.5 ${colorClass}`} />
                          <span>{labelText}</span>
                        </span>
                        <a
                          href={String(val).startsWith("http") ? String(val) : `https://${String(val)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 hover:text-blue-200 font-medium truncate max-w-[60%] text-right hover:underline flex items-center gap-1 justify-end"
                        >
                          <span className="truncate">{String(val).replace(/^https?:\/\//, "").replace(/^www\./, "")}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPhotoModalOpen && publicAccount.avatar_url && (
        <LogoModal
          isOpen={isPhotoModalOpen}
          logoUrl={publicAccount.avatar_url}
          alt={publicAccount.name || publicAccount.nickname}
          isTsgMember={publicAccount.show_tsg_member}
          onClose={() => setIsPhotoModalOpen(false)}
        />
      )}
    </>
  );
}

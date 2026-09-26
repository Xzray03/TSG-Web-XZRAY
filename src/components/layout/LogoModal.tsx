"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Upload, Globe, Check, Loader2 } from "lucide-react";
import { ProfilePhotoCropModal } from "@/components/layout/ProfilePhotoCropModal";

interface LogoModalProps {
  isOpen?: boolean;
  logoUrl?: string;
  alt?: string;
  isTsgMember?: boolean;
  sanityPhotoUrl?: string;
  onClose: () => void;
  onUpdatePhoto?: (newPhotoUrl: string) => void;
}

export function LogoModal({
  isOpen = true,
  logoUrl,
  alt,
  isTsgMember = false,
  sanityPhotoUrl,
  onClose,
  onUpdatePhoto,
}: LogoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isSourceChoiceOpen, setIsSourceChoiceOpen] = useState(false);
  const [isLoadingSanity, setIsLoadingSanity] = useState(false);
  const [fetchedSanityPhoto, setFetchedSanityPhoto] = useState<string>(sanityPhotoUrl || "");

  if (!isOpen) {
    return null;
  }

  const altText = alt && alt.trim() ? alt.trim() : "Foto Profil";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropImageSrc(event.target.result as string);
          setIsCropModalOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleSelectSanityPhoto = async () => {
    setIsLoadingSanity(true);
    let photoUrl = fetchedSanityPhoto || sanityPhotoUrl;
    if (!photoUrl && alt) {
      try {
        const res = await fetch(`/api/auth?action=check&name=${encodeURIComponent(alt.trim())}`, {
          headers: { "x-tsg-client-verify": "true" },
        });
        const data = await res.json();
        if (res.ok && data.tsgInfo?.photo) {
          photoUrl = data.tsgInfo.photo;
          setFetchedSanityPhoto(data.tsgInfo.photo);
        }
      } catch (e) {}
    }
    setIsLoadingSanity(false);
    setIsSourceChoiceOpen(false);

    if (photoUrl) {
      setCropImageSrc(photoUrl);
      setIsCropModalOpen(true);
    }
  };

  const handleMainButtonClick = () => {
    if (isTsgMember) {
      setIsSourceChoiceOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[10000000] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md sm:p-8 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong relative my-auto flex max-h-[90vh] max-w-3xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.8)]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-white transition-colors hover:bg-background hover:text-accent cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative flex h-[55vh] w-[75vw] max-w-xl items-center justify-center overflow-hidden rounded-2xl bg-slate-900/40 border border-white/10 p-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={altText}
                className="max-h-full max-w-full object-contain rounded-xl"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-white/50 gap-2">
                <Camera className="w-12 h-12" />
                <span className="text-xs">Belum ada foto profil</span>
              </div>
            )}
          </div>

          <p className="mt-4 font-display text-lg font-semibold tracking-wide text-white text-center">
            {altText}
          </p>

          {onUpdatePhoto && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={handleMainButtonClick}
                disabled={isLoadingSanity}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition-all shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isLoadingSanity ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{logoUrl ? "Ubah Foto Profil" : "Unggah Foto Profil"}</span>
              </button>
              <p className="text-[11px] text-white/50">
                {isTsgMember
                  ? "Anda dapat menggunakan foto resmi Sanity atau mengunggah foto sendiri, lalu sesuaikan posisinya."
                  : "Anda dapat mengunggah & mengedit posisi foto profil akun Anda."}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Choice Modal for TSG Members (Sanity vs Upload) */}
      <AnimatePresence>
        {isSourceChoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000001] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative my-auto w-full max-w-md rounded-3xl bg-slate-900 border border-blue-500/30 p-6 text-white shadow-2xl space-y-4"
            >
              <button
                type="button"
                onClick={() => setIsSourceChoiceOpen(false)}
                aria-label="Tutup"
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Pilih Sumber Foto Profil</h4>
                  <p className="text-xs text-white/60">Pilih opsi foto resmi Sanity CMS atau unggah sendiri.</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleSelectSanityPhoto}
                  disabled={isLoadingSanity}
                  className="w-full p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-left transition flex items-center gap-3 cursor-pointer group disabled:opacity-50"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 shrink-0 group-hover:scale-105 transition">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-300 block">Gunakan Foto dari Sanity</span>
                    <span className="text-[11px] text-white/60">Ambil foto resmi Anggota TSG dari database Sanity</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSourceChoiceOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition flex items-center gap-3 cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">Unggah Foto Sendiri</span>
                    <span className="text-[11px] text-white/60">Pilih file gambar dari perangkat Anda</span>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive 1:1 Crop Modal */}
      {cropImageSrc && (
        <ProfilePhotoCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropImageSrc}
          onClose={() => {
            setIsCropModalOpen(false);
            setCropImageSrc(null);
          }}
          onCropComplete={(croppedDataUrl) => {
            if (onUpdatePhoto) {
              onUpdatePhoto(croppedDataUrl);
            }
            setIsCropModalOpen(false);
            setCropImageSrc(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

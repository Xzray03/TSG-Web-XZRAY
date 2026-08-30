"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, Camera, Upload } from "lucide-react";
import { ProfilePhotoCropModal } from "@/components/layout/ProfilePhotoCropModal";

interface LogoModalProps {
  isOpen?: boolean;
  logoUrl?: string;
  alt?: string;
  isTsgMember?: boolean;
  onClose: () => void;
  onUpdatePhoto?: (newPhotoUrl: string) => void;
}

export function LogoModal({
  isOpen = true,
  logoUrl,
  alt,
  isTsgMember = false,
  onClose,
  onUpdatePhoto,
}: LogoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

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

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[10000000] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md sm:p-8"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong relative flex max-h-[90vh] max-w-3xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.8)]"
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

          {!isTsgMember && onUpdatePhoto && (
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
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition-all shadow-lg cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{logoUrl ? "Ubah Foto Profil" : "Unggah Foto Profil"}</span>
              </button>
              <p className="text-[11px] text-white/50">
                Pengguna publik dapat mengunggah & mengedit posisi foto profil.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>

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
          }}
        />
      )}
    </>
  );
}

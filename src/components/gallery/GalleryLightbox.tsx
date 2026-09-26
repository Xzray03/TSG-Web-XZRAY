"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { GalleryItem } from "@/types";

interface GalleryLightboxProps {
  item: GalleryItem;
  onClose: () => void;
}

export function GalleryLightbox({ item, onClose }: GalleryLightboxProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm sm:p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-white transition-colors hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex max-h-[60vh] w-full items-center justify-center bg-black/30">
          <Image
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            className="max-h-[60vh] w-full object-contain"
          />
        </div>

        <div className="p-6 sm:p-8">
          <span className="glass inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-accent">
            {item.category}
          </span>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            {item.alt}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

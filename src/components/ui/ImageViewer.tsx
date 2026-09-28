"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

export function useImageViewer() {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const openViewer = (url: string) => setViewerUrl(url);
  const closeViewer = () => setViewerUrl(null);

  const viewer = (
    <ImageViewerModal url={viewerUrl} onClose={closeViewer} />
  );

  return { openViewer, viewer };
}

function ImageViewerModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useScrollLock(!!url);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!url) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [url, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw] rounded-2xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/90 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Foto penuh"
              className="max-h-[90vh] max-w-[90vw] object-contain"
              crossOrigin="anonymous"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

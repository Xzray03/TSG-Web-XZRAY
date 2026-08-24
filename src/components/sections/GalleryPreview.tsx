"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Camera, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import type { GalleryItem } from "@/types";

interface GalleryPreviewProps {
  images: GalleryItem[];
}

export function GalleryPreview({ images }: GalleryPreviewProps) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  // Home cuma nampilin ringkasan — maksimal 6 foto terbaru.
  const previewImages = images.slice(0, 6);

  // Kunci scroll halaman di belakang selagi lightbox terbuka.
  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  // Tutup lightbox dengan tombol Esc.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section className="relative px-6 py-24 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-blue/10 blur-[140px]" />

      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <Camera className="h-3.5 w-3.5" />
            Galeri
          </div>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Momen di Balik <span className="text-gradient">Setiap Karya</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Cuplikan dokumentasi kegiatan, eksperimen, dan kompetisi anggota
            TSG dari tiap divisi.
          </p>
        </motion.div>

        {/* Grid rata tengah — jumlah foto berapa pun tetap simetris */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-14 flex flex-wrap justify-center gap-4"
        >
          {previewImages.map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              whileHover={{ y: -4 }}
              className="group relative aspect-[4/5] w-[calc(50%-0.5rem)] overflow-hidden rounded-2xl border border-white/[0.08] sm:w-[calc(33.333%-0.75rem)] text-left focus:outline-none cursor-pointer"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                priority={index === 0}
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-background/90 via-background/10 to-transparent p-4 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                <div className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4 text-accent" />
                  <span className="text-xs font-medium text-white">
                    {item.category}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <Button
            href="/gallery"
            variant="secondary"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Lihat Semua Galeri
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {selected && (
          <GalleryLightbox item={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn } from "lucide-react";
import { GalleryLightbox } from "./GalleryLightbox";
import type { GalleryItem } from "@/types";

interface GalleryLightboxWrapperProps {
  items: GalleryItem[];
}

export function GalleryLightboxWrapper({ items }: GalleryLightboxWrapperProps) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        {items.map((item, index) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.03 }}
            className="group relative aspect-[4/5] w-[calc(50%-0.5rem)] overflow-hidden rounded-2xl border border-white/[0.08] sm:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-0.75rem)]"
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
            <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-background/90 via-background/10 to-transparent p-3 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
              <div className="flex items-center gap-1.5">
                <ZoomIn className="h-3.5 w-3.5 text-accent" />
                <span className="line-clamp-1 text-left text-[11px] font-medium text-white">
                  {item.alt}
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <GalleryLightbox item={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

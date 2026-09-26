"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { X, Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { Button } from "@/components/ui/Button";
import { formatEventDateTime } from "@/lib/format-date";
import type { EventItem } from "@/types";

interface EventModalProps {
  event: EventItem;
  onClose: () => void;
}

export function EventModal({ event, onClose }: EventModalProps) {
  const countdown = useCountdown(event.date);
  const isToday = countdown && !countdown.isPast && countdown.days === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
    >
      <motion.div
        layoutId={`event-card-${event.id}`}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
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

        {/* Poster -- ukuran kontainer mengikuti rasio asli poster, jadi
            seluruh gambar selalu terlihat penuh, tidak gepeng/terpotong */}
        <motion.div
          layoutId={`event-image-${event.id}`}
          className="relative w-full bg-black/30"
          style={{
            aspectRatio:
              event.imageWidth && event.imageHeight
                ? `${event.imageWidth} / ${event.imageHeight}`
                : "16 / 10",
            maxHeight: "55vh",
          }}
        >
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </motion.div>

        <div className="max-h-[38vh] overflow-y-auto p-6 sm:p-8">
          {countdown && !countdown.isPast && (
            <span className="glass mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-accent">
              <Clock className="h-3.5 w-3.5" />
              {isToday ? "Hari Ini" : `${countdown.days} hari lagi`}
            </span>
          )}

          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {event.title}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              {formatEventDateTime(event.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {event.location}
            </span>
          </div>

          <p className="mt-5 text-base leading-relaxed text-slate-300">
            {event.description}
          </p>

          {event.cta && (
            <Button
              href={event.cta.href}
              size="lg"
              className="mt-6 w-full justify-center sm:w-auto"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              {event.cta.label}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

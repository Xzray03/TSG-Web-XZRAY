"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CalendarClock } from "lucide-react";
import { EventPreviewTile } from "@/components/events/EventPreviewTile";
import { EventModal } from "@/components/events/EventModal";
import { Button } from "@/components/ui/Button";
import type { EventItem } from "@/types";
import { ServerCountdown } from "@/lib/server-countdown";

interface EventsPreviewProps {
  events: EventItem[];
  serverCountdowns: ServerCountdown[];
}

export function EventsPreview({ events, serverCountdowns }: EventsPreviewProps) {
  const [selected, setSelected] = useState<EventItem | null>(null);

  const upcoming = events
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  // Kunci scroll halaman di belakang selagi modal terbuka.
  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  // Tutup modal dengan tombol Esc.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section className="relative px-6 py-24 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute right-1/4 bottom-0 -z-10 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <CalendarClock className="h-3.5 w-3.5" />
            Agenda Mendatang
          </div>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Jangan Lewatkan <span className="text-gradient">Kegiatan Kami</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Dari open recruitment hingga persiapan kompetisi — ini yang akan
            berlangsung dalam waktu dekat.
          </p>
        </motion.div>

        <div className="mt-14 flex flex-wrap items-stretch justify-center gap-6">
          {upcoming.map((event, index) => {
            const serverCountdown = serverCountdowns[index];
            return (
              <div
                key={event.id}
                className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
              >
                <EventPreviewTile
                  event={event}
                  index={index}
                  onClick={() => setSelected(event)}
                  serverCountdown={serverCountdown}
                />
              </div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <Button
            href="/events"
            variant="secondary"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Lihat Semua Event
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {selected && (
          <EventModal event={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
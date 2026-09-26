"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { History } from "lucide-react";
import { EventPreviewTile } from "./EventPreviewTile";
import { EventModal } from "./EventModal";
import { PastEventTimeline } from "./PastEventTimeline";
import type { EventItem } from "@/types";

interface EventsPageClientProps {
  upcoming: EventItem[];
  past: EventItem[];
}

export function EventsPageClient({ upcoming, past }: EventsPageClientProps) {
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
    <>
      <div className="mt-16">
        <h2 className="text-center font-display text-xl font-semibold text-white">
          Agenda Mendatang
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            Belum ada agenda mendatang saat ini.
          </p>
        ) : (
          <div className="mt-8 flex flex-wrap items-stretch justify-center gap-6">
            {upcoming.map((event, index) => (
              <div
                key={event.id}
                className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
              >
                <EventPreviewTile
                  event={event}
                  index={index}
                  onClick={() => setSelected(event)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-24">
        <div className="mb-8 flex items-center justify-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h2 className="font-display text-xl font-semibold text-white">
            Event Sebelumnya
          </h2>
        </div>
        <PastEventTimeline events={past} />
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {selected && (
              <EventModal event={selected} onClose={() => setSelected(null)} />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

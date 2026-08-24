"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, MapPin } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { formatEventDateTime } from "@/lib/format-date";
import type { EventItem } from "@/types";
import { ServerCountdown } from "@/lib/server-countdown";

interface EventPreviewTileProps {
  event: EventItem;
  index: number;
  onClick: () => void;
  serverCountdown?: ServerCountdown;
}

export function EventPreviewTile({ event, index, onClick, serverCountdown }: EventPreviewTileProps) {
  const clientCountdown = useCountdown(event.date);
  
  // Use client-side countdown if available, otherwise fallback to pre-rendered server countdown
  const isToday = clientCountdown 
    ? (!clientCountdown.isPast && clientCountdown.days === 0)
    : (serverCountdown?.isToday ?? false);

  const daysLeft = clientCountdown 
    ? clientCountdown.days 
    : (serverCountdown?.days ?? 0);

  const isPast = clientCountdown 
    ? clientCountdown.isPast 
    : (serverCountdown?.isPast ?? false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group/event h-full w-full text-left"
    >
      <motion.div
        layoutId={`event-card-${event.id}`}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        className="glass relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] transition-colors duration-200 group-hover/event:border-accent/40"
      >
        <div className="relative h-44 w-full shrink-0 overflow-hidden">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover/event:scale-105"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

          {!isPast && (
            <div className="glass-strong absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold text-accent">
              {isToday ? "Hari Ini" : `${daysLeft} hari lagi`}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            {formatEventDateTime(event.date)}
          </div>
          <h3 className="mt-2 font-display text-base font-semibold leading-snug text-white">
            {event.title}
          </h3>
          <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {event.location}
          </div>
        </div>
      </motion.div>
    </motion.button>
  );
}

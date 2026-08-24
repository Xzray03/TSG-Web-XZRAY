"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import { useCountdown } from "@/hooks/useCountdown";
import { Button } from "@/components/ui/Button";
import type { EventItem } from "@/types";

interface EventCardProps {
  event: EventItem;
  index: number;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

function formatEventDateTime(dateString: string) {
  const date = new Date(dateString);
  return `${timeFormatter.format(date)} WIB - ${dateFormatter.format(date)}`;
}

export function EventCard({ event, index }: EventCardProps) {
  const countdown = useCountdown(event.date);
  const isToday = countdown && !countdown.isPast && countdown.days === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group/event h-full"
    >
      <motion.div
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
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

          {countdown && !countdown.isPast && (
            <div className="glass-strong absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold text-accent">
              {isToday ? "Hari Ini" : `${countdown.days} hari lagi`}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            {formatEventDateTime(event.date)}
          </div>

          <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-white">
            {event.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {event.description}
          </p>

          <div className="mt-auto pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {event.location}
            </div>

            {countdown && !countdown.isPast && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <Clock className="h-3.5 w-3.5" />
                {isToday
                  ? `${countdown.hours} jam ${countdown.minutes} menit lagi`
                  : `${countdown.days} hari ${countdown.hours} jam lagi`}
              </div>
            )}

            {event.cta && (
              <Button
                href={event.cta.href}
                size="md"
                className="mt-4 w-full justify-center"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                {event.cta.label}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
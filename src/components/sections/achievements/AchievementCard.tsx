"use client";

import { motion } from "framer-motion";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAchievementCardStyle } from "@/lib/achievement-styles";
import type { AchievementItem } from "@/types";

interface AchievementCardProps {
  item: AchievementItem;
  index: number;
}

export function AchievementCard({ item, index }: AchievementCardProps) {
  const st = getAchievementCardStyle(item.level);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      className="group h-full"
    >
      <motion.div
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-colors duration-200",
          st.cardClass
        )}
      >
        <span className={st.pulseBorderClass} />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-white/5 opacity-0 blur-2xl transition-opacity duration-200 ease-out group-hover:opacity-100" />

        <div className="flex items-start justify-between gap-3">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", st.iconBgClass)}>
            <Award className="h-5 w-5" />
          </span>
          <span className={cn("text-sm font-semibold", st.yearClass)}>{item.year}</span>
        </div>

        <h3 className={cn("mt-4 font-display text-base font-semibold leading-snug", st.titleClass)}>
          {item.title}
        </h3>
        <p className={cn("mt-1.5 text-sm", st.eventClass)}>{item.event}</p>

        <span
          className={cn(
            "mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 pt-4 text-[11px] font-medium",
            st.chipClass
          )}
        >
          <st.icon className="h-3 w-3" />
          {item.level}
        </span>
      </motion.div>
    </motion.div>
  );
}

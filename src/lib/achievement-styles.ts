import { Globe2, Flag, MapPin, type LucideIcon } from "lucide-react";
import type { AchievementItem } from "@/types";

interface AchievementCardStyle {
  cardClass: string;
  pulseBorderClass: string;
  iconBgClass: string;
  yearClass: string;
  titleClass: string;
  eventClass: string;
  chipClass: string;
  icon: LucideIcon;
}

export function getAchievementCardStyle(level: AchievementItem["level"]): AchievementCardStyle {
  switch (level) {
    case "International":
      return {
        cardClass: "international-card",
        pulseBorderClass: "absolute inset-0 pointer-events-none rounded-2xl border border-purple-300/100 animate-pulse",
        iconBgClass: "bg-purple-500/20 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)]",
        yearClass: "text-purple-300/80",
        titleClass: "text-purple-100",
        eventClass: "text-purple-300/70",
        chipClass: "border-purple-400/30 bg-purple-500/15 text-purple-300",
        icon: Globe2,
      };
    case "National":
      return {
        cardClass: "national-card",
        pulseBorderClass: "absolute inset-0 pointer-events-none rounded-2xl border border-sky-300/100 animate-pulse",
        iconBgClass: "bg-sky-500/20 text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.3)]",
        yearClass: "text-sky-300/80",
        titleClass: "text-sky-100",
        eventClass: "text-sky-300/70",
        chipClass: "border-sky-400/30 bg-sky-500/15 text-sky-300",
        icon: Flag,
      };
    case "Regional":
    default:
      return {
        cardClass: "regional-card",
        pulseBorderClass: "absolute inset-0 pointer-events-none rounded-2xl border border-slate-300/100 animate-pulse",
        iconBgClass: "bg-slate-500/20 text-slate-200 shadow-[0_0_15px_rgba(148,163,184,0.3)]",
        yearClass: "text-slate-300/80",
        titleClass: "text-slate-100",
        eventClass: "text-slate-300/70",
        chipClass: "border-slate-300/30 bg-slate-400/15 text-slate-200",
        icon: MapPin,
      };
  }
}
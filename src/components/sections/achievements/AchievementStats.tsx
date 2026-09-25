"use client";

import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

interface AchievementStatsProps {
  summary: Array<{ id: string; label: string; value: number; suffix: string }>;
}

export function AchievementStats({ summary }: AchievementStatsProps) {
  return (
    <div className="glass mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl border border-white/[0.08] p-8 sm:grid-cols-4">
      {summary.map((item) => (
        <div key={item.id} className="text-center">
          <div className="font-display text-3xl font-bold text-white">
            <AnimatedCounter value={item.value} suffix={item.suffix} />
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

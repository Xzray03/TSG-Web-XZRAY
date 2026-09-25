"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

interface AchievementHeaderProps {
  earliestYear: number | null;
}

export function AchievementHeader({ earliestYear }: AchievementHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mx-auto max-w-2xl text-center"
    >
      <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
        <Trophy className="h-3.5 w-3.5" />
        Prestasi Kami
      </div>
      <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
        Bukti Nyata <span className="text-gradient">Kerja Keras Anggota</span>
      </h2>
      <p className="mt-4 text-base text-slate-400">
        {earliestYear
          ? `Sejak ${earliestYear}, TSG konsisten membawa pulang penghargaan dari tingkat kota hingga nasional.`
          : "TSG konsisten membawa pulang penghargaan dari tingkat kota hingga nasional."}
      </p>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Trophy, Award, ArrowRight } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getAchievementCardStyle } from "@/lib/achievement-styles";
import type { AchievementItem } from "@/types";

interface AchievementsProps {
  achievements: AchievementItem[];
}

export function Achievements({ achievements }: AchievementsProps) {
  // Stats reflect the FULL history
  const total = achievements.length;
  const international = achievements.filter((a) => a.level === "International").length;
  const national = achievements.filter((a) => a.level === "National").length;
  const regional = achievements.filter((a) => a.level === "Regional").length;
  const earliestYear = achievements.length
    ? Math.min(...achievements.map((a) => a.year))
    : null;

  const summary = [
    { id: "total", label: "Total Prestasi", value: total, suffix: "" },
    { id: "international", label: "Internasional", value: international, suffix: "" },
    { id: "national", label: "Nasional", value: national, suffix: "" },
    { id: "regional", label: "Regional", value: regional, suffix: "" },
  ];

  // Filter featured items and order them specifically as requested:
  // National, International, National, Regional, Regional, Regional
  const featuredRaw = achievements
    .filter((a) => a.featured)
    .sort((a, b) => b.year - a.year);

  const nationals = featuredRaw.filter((a) => a.level === "National");
  const internationals = featuredRaw.filter((a) => a.level === "International");
  const regionals = featuredRaw.filter((a) => a.level === "Regional");

  const featured = [
    nationals[0],
    internationals[0],
    nationals[1] || nationals[0],
    regionals[0],
    regionals[1] || regionals[0],
    regionals[2] || regionals[0],
  ].filter(Boolean);

  // For mobile view, make sure the very first card is International (if available)
  const mobileFeatured = [...featured];
  if (internationals[0]) {
    const intlIndex = mobileFeatured.findIndex((a) => a.id === internationals[0].id);
    if (intlIndex !== -1) {
      mobileFeatured.splice(intlIndex, 1);
    }
    mobileFeatured.unshift(internationals[0]);
  }

  return (
    <section className="relative px-6 py-24 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[460px] w-[460px] rounded-full bg-accent/10 blur-[140px]" />

      <div className="mx-auto max-w-7xl">
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

        {/* Summary counters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl border border-white/[0.08] p-8 sm:grid-cols-4"
        >
          {summary.map((item) => (
            <div key={item.id} className="text-center">
              <div className="font-display text-3xl font-bold text-white">
                <AnimatedCounter value={item.value} suffix={item.suffix} />
              </div>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                {item.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Featured highlights ordered as requested */}
        <div className="mt-14">
          {/* Mobile view: first card is International */}
          <div className="flex flex-wrap items-stretch justify-center gap-5 sm:hidden">
            {mobileFeatured.map((item, index) => {
              const st = getAchievementCardStyle(item.level);
              return (
                <div
                  key={`mobile-${item.id}-${index}`}
                  className="w-full"
                >
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
                        <span className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          st.iconBgClass
                        )}>
                          <Award className="h-5 w-5" />
                        </span>
                        <span className={cn("text-sm font-semibold", st.yearClass)}>
                          {item.year}
                        </span>
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
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet view: original order */}
          <div className="hidden sm:flex flex-wrap items-stretch justify-center gap-5">
            {featured.map((item, index) => {
              const st = getAchievementCardStyle(item.level);
              return (
                <div
                  key={`desktop-${item.id}-${index}`}
                  className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
                >
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
                        <span className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          st.iconBgClass
                        )}>
                          <Award className="h-5 w-5" />
                        </span>
                        <span className={cn("text-sm font-semibold", st.yearClass)}>
                          {item.year}
                        </span>
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
                </div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <Button
            href="https://thesmartgeneration.vercel.app/about"
            variant="secondary"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Lihat Semua Prestasi
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default Achievements;

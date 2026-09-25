"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AchievementCard } from "./achievements/AchievementCard";
import { AchievementStats } from "./achievements/AchievementStats";
import { AchievementHeader } from "./achievements/AchievementHeader";
import type { AchievementItem } from "@/types";

interface AchievementsProps {
  achievements: AchievementItem[];
}

export function Achievements({ achievements }: AchievementsProps) {
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
        <AchievementHeader earliestYear={earliestYear} />
        <AchievementStats summary={summary} />

        <div className="mt-14">
          <div className="flex flex-wrap items-stretch justify-center gap-5 sm:hidden">
            {mobileFeatured.map((item, index) => (
              <div key={`mobile-${item.id}-${index}`} className="w-full">
                <AchievementCard item={item} index={index} />
              </div>
            ))}
          </div>

          <div className="hidden sm:flex flex-wrap items-stretch justify-center gap-5">
            {featured.map((item, index) => (
              <div
                key={`desktop-${item.id}-${index}`}
                className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
              >
                <AchievementCard item={item} index={index} />
              </div>
            ))}
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

import type { Metadata } from "next";
import { Info } from "lucide-react";
import { getSiteSettings, getAboutContent } from "@/sanity/queries";
import { getCachedAchievementsFiltered } from "@/sanity/serverCache";
import { VisionMission } from "@/components/about/VisionMission";
import { AboutAchievements } from "@/components/about/AboutAchievements";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Tentang Kami",
  description:
    "Visi, misi, dan rekam jejak prestasi The Smart Generation (TSG).",
};

interface AboutPageProps {
  searchParams: Promise<{ level?: string }>;
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const params = await searchParams;
  const activeLevel = params.level ?? "all";

  const [settings, aboutContent, { achievements, stats }] = await Promise.all([
    getSiteSettings(),
    getAboutContent(),
    getCachedAchievementsFiltered(activeLevel),
  ]);

  return (
    <div className="bg-grid relative overflow-hidden pb-10 pt-36">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          <Info className="h-3.5 w-3.5" />
          Tentang Kami
        </div>
        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Mengenal <span className="text-gradient">The Smart Generation</span>
        </h1>
        <p className="mt-4 text-base text-slate-400">{settings.description}</p>
        <p className="mt-3 text-sm text-slate-500">
          Berdiri sejak {settings.foundedYear}
        </p>
      </div>

      <VisionMission content={aboutContent} />
      <AboutAchievements
        achievements={achievements}
        stats={stats}
        activeLevel={activeLevel}
      />
    </div>
  );
}
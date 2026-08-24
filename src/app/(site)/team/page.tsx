import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { getCachedTeamFiltered } from "@/sanity/serverCache";
import { TeamMemberCard } from "@/components/team/TeamMemberCard";
import { cn } from "@/lib/utils";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Tim Kami",
  description:
    "Kenali seluruh generasi anggota, mentor, dan pengurus The Smart Generation (TSG).",
};

interface TeamPageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const catSlug = params.cat;

  // Memanfaatkan React server-side cache (`cache`) agar jika kategori generasi
  // yang sama pernah dibuka/difilter sebelumnya, hasil olahan data langsung
  // digunakan dari memori server tanpa melakukan filter ulang.
  const { categories, members: filtered, activeSlug } = await getCachedTeamFiltered(catSlug);

  return (
    <section className="bg-grid relative px-6 pb-24 pt-36 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <Users className="h-3.5 w-3.5" />
            Tim Kami
          </div>
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Setiap <span className="text-gradient">Generasi</span> TSG
          </h1>
          <p className="mt-4 text-base text-slate-400">
            Pilih kategori untuk melihat anggota, mentor, dan pengurus dari
            setiap generasi.
          </p>
        </div>

        {categories.length === 0 ? (
          <p className="mt-12 text-center text-sm text-slate-500">
            Belum ada kategori/generasi yang dibuat di Studio.
          </p>
        ) : (
          <div>
            {/* Server-side category tabs */}
            <div className="mt-12 flex flex-wrap justify-center gap-2">
              {categories.map((cat) => {
                const href = `/team?cat=${encodeURIComponent(cat.slug)}`;
                const isActive = activeSlug === cat.slug;
                return (
                  <Link
                    key={cat.id}
                    href={href}
                    className={cn(
                      "rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "border-accent/50 bg-accent/15 text-accent"
                        : "border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-white"
                    )}
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </div>

            {/* Member grid */}
            <div className="mt-12 flex flex-wrap items-stretch justify-center gap-6">
              {filtered.length === 0 ? (
                <p className="py-16 text-sm text-slate-500">
                  Belum ada anggota di kategori ini.
                </p>
              ) : (
                filtered.map((member, index) => (
                  <div
                    key={member.id}
                    className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
                  >
                    <TeamMemberCard member={member} index={index} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

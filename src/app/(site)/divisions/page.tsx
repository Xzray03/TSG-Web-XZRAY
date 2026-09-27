import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { getDivisions } from "@/sanity/queries";
import { DivisionDetailSection } from "@/components/divisions/DivisionDetailSection";

export const revalidate = false;

export const metadata: Metadata = {
  title: "Divisi",
  description:
    "Kenali lebih dekat divisi The Smart Generation (TSG): Robotik, Mekatronika, Sains, dan Multimedia.",
};

export default async function DivisionsPage() {
  const divisions = await getDivisions();

  return (
    <div className="bg-grid relative overflow-hidden pb-10 pt-36">
      <div className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          <Layers className="h-3.5 w-3.5" />
          Divisi Kami
        </div>
        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Empat Jalur, <span className="text-gradient">Satu Tujuan</span>
        </h1>
        <p className="mt-4 text-base text-slate-400">
          Tiap divisi punya cara sendiri mengubah rasa ingin tahu jadi karya
          nyata. Pilih yang paling sesuai minatmu.
        </p>
      </div>

      {divisions.length === 0 ? (
        <p className="mt-20 text-center text-sm text-slate-500">
          Belum ada divisi yang dipublikasikan.
        </p>
      ) : (
        <div className="mt-16 divide-y divide-white/[0.06]">
          {divisions.map((division, index) => (
            <DivisionDetailSection
              key={division.id}
              division={division}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}

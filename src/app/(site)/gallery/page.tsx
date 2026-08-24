import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { getGalleryImages, getUniformShowcase } from "@/sanity/queries";
import { GalleryLightboxWrapper } from "@/components/gallery/GalleryLightboxWrapper";
import { UniformShowcase3D } from "@/components/gallery/UniformShowcase3D";
import { cn } from "@/lib/utils";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Galeri",
  description:
    "Dokumentasi kegiatan dan preview seragam resmi The Smart Generation (TSG).",
};

interface GalleryPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const activeCategory = params.category ?? "Semua";

  const [images, uniform] = await Promise.all([
    getGalleryImages(),
    getUniformShowcase(),
  ]);

  const categories = ["Semua", ...Array.from(new Set(images.map((i) => i.category)))];
  const filtered =
    activeCategory === "Semua"
      ? images
      : images.filter((i) => i.category === activeCategory);

  return (
    <div className="bg-grid relative overflow-hidden pb-10 pt-36">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
          <Camera className="h-3.5 w-3.5" />
          Galeri
        </div>
        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Momen & <span className="text-gradient">Cerita TSG</span>
        </h1>
        <p className="mt-4 text-base text-slate-400">
          Klik salah satu foto untuk lihat ceritanya.
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        {/* Server-side category tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => {
            const href = cat === "Semua" ? "/gallery" : `/gallery?category=${encodeURIComponent(cat)}`;
            const isActive = activeCategory === cat;
            return (
              <Link
                key={cat}
                href={href}
                className={cn(
                  "rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-white"
                )}
              >
                {cat}
              </Link>
            );
          })}
        </div>

        {images.length === 0 ? (
          <p className="mt-16 text-center text-sm text-slate-500">
            Belum ada foto galeri yang dipublikasikan.
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-16 text-center text-sm text-slate-500">
            Belum ada foto di kategori ini.
          </p>
        ) : (
          <GalleryLightboxWrapper items={filtered} />
        )}
      </div>

      {uniform && <UniformShowcase3D data={uniform} />}
    </div>
  );
}
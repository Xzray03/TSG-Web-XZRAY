"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import type { Division } from "@/types";
import { cn } from "@/lib/utils";
import { iconMap } from "@/lib/icon-map";
import { LogoModal } from "@/components/layout/LogoModal";

interface DivisionCardProps {
  division: Division;
  index: number;
}

const colorVariants = {
  primary: {
    iconBg: "bg-primary/15 text-primary",
    border: "group-hover:border-primary/40",
    glowBg: "bg-primary/10",
    chip: "border-primary/20 text-primary",
  },
  accent: {
    iconBg: "bg-accent/15 text-accent",
    border: "group-hover:border-accent/40",
    glowBg: "bg-accent/10",
    chip: "border-accent/20 text-accent",
  },
  blue: {
    iconBg: "bg-blue/15 text-blue",
    border: "group-hover:border-blue/40",
    glowBg: "bg-blue/10",
    chip: "border-blue/20 text-blue",
  },
} as const;

export function DivisionCard({ division, index }: DivisionCardProps) {
  const pathname = usePathname();
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const colors = colorVariants[division.color];
  const Icon = iconMap[division.icon] ?? iconMap.Bot;

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: index * 0.08 }}
        whileHover={{ y: -6 }}
        whileTap={{ y: -2 }}
        style={{ transformStyle: "preserve-3d" }}
        className="group h-full gpu-accelerated"
      >
        <motion.div
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "glass relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] p-6 transition-colors duration-200 gpu-accelerated",
            colors.border
          )}
        >
          {/* Cheap opacity-only glow layer — GPU-compositable, no repaint lag */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition-opacity duration-200 ease-out group-hover:opacity-100 gpu-accelerated",
              colors.glowBg
            )}
          />

          <div className="relative mx-auto mb-5 h-[72px] w-[72px]">
            {/* Continuous pulsing glow behind the icon/logo box */}
            <motion.span
              className={cn("absolute inset-0 rounded-2xl blur-md gpu-accelerated", colors.glowBg)}
              animate={{ opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />

            {division.logoUrl ? (
              <button
                type="button"
                onClick={() => setIsLogoModalOpen(true)}
                className={cn(
                  "relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl transition-transform duration-200 ease-out hover:scale-110 focus:outline-none cursor-pointer p-3 gpu-accelerated",
                  colors.iconBg
                )}
                title={`Perbesar logo ${division.name}`}
              >
                <Image
                  src={division.logoUrl}
                  alt={`Logo ${division.name}`}
                  width={64}
                  height={64}
                  className="h-full w-full object-contain"
                />
              </button>
            ) : (
              <span
                className={cn(
                  "relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl transition-transform duration-200 ease-out group-hover:scale-110 gpu-accelerated",
                  colors.iconBg
                )}
              >
                <Icon className="h-8 w-8" />
              </span>
            )}
          </div>

          <h3 className="font-display text-xl font-semibold text-white">
            {division.name}
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-400">
            {division.tagline}
          </p>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-500">
            {division.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {division.skills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  colors.chip
                )}
              >
                {skill}
              </span>
            ))}
            {division.skills.length > 4 && (
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                +{division.skills.length - 4} lainnya
              </span>
            )}
          </div>

          <Link
            href={`/divisions#${division.slug}`}
            onClick={(e) => handleLinkClick(e, `/divisions#${division.slug}`)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors duration-200 group-hover:text-accent"
          >
            Selengkapnya
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </motion.div>
      </motion.div>

      {isLogoModalOpen && division.logoUrl && (
        <LogoModal
          logoUrl={division.logoUrl}
          alt={`Logo ${division.name}`}
          onClose={() => setIsLogoModalOpen(false)}
        />
      )}
    </>
  );
}
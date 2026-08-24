import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { iconMap } from "@/lib/icon-map";
import { divisionTheme } from "@/lib/division-theme";
import { EXTERNAL_URLS } from "@/data/url";
import { cn } from "@/lib/utils";
import type { Division } from "@/types";

interface DivisionDetailSectionLayoutProps {
  division: Division;
  index: number;
  isLogoModalOpen: boolean;
  setIsLogoModalOpen: (open: boolean) => void;
  SPARKLES: { top: string; left: string; delay: number }[];
}

export function DivisionDetailSectionLayout({
  division,
  index,
  isLogoModalOpen,
  setIsLogoModalOpen,
  SPARKLES,
}: DivisionDetailSectionLayoutProps) {
  const theme = divisionTheme[division.color];
  const Icon = iconMap[division.icon] ?? iconMap.Bot;
  const isReversed = index % 2 === 1;
  const numberLabel = String(index + 1).padStart(2, "0");

  return (
    <section
      id={division.slug}
      className="relative scroll-mt-28 px-6 py-20 sm:px-10 lg:px-16"
    >
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 -z-10 h-[520px] w-[520px] -translate-y-1/2 rounded-full blur-[150px]",
          theme.glow,
          isReversed ? "right-0" : "left-0"
        )}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        {/* Big logo showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={cn("relative mx-auto", isReversed ? "lg:order-2" : "lg:order-1")}
        >
          <div className="relative flex h-72 w-72 items-center justify-center sm:h-[22rem] sm:w-[22rem]">
            {/* Pulsing rings */}
            <motion.span
              className={cn("absolute inset-0 rounded-full border gpu-accelerated", theme.ring)}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              className={cn("absolute inset-10 rounded-full border gpu-accelerated", theme.ring)}
              animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            />

            {/* Soft glow */}
            <div className={cn("absolute inset-14 rounded-full blur-3xl", theme.glow)} />

            {/* Sparkles */}
            {SPARKLES.map((s, i) => (
              <motion.span
                key={i}
                className={cn("absolute h-1.5 w-1.5 rounded-full gpu-accelerated", theme.accentText, "bg-current")}
                style={{ top: s.top, left: s.left }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: s.delay }}
              />
            ))}

            {/* Floating logo/icon disc */}
            {division.logoUrl ? (
              <motion.button
                type="button"
                onClick={() => setIsLogoModalOpen(true)}
                animate={{ y: [0, -16, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className={cn(
                  "glass-strong relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border-2 p-9 sm:h-64 sm:w-64 transition-transform duration-300 hover:scale-105 focus:outline-none cursor-pointer gpu-accelerated",
                  theme.ring
                )}
                title={`Perbesar logo ${division.name}`}
              >
                <Image
                  src={division.logoUrl}
                  alt={division.name}
                  width={200}
                  height={200}
                  className="h-full w-full object-contain"
                  priority={index === 0}
                />
              </motion.button>
            ) : (
              <motion.div
                animate={{ y: [0, -16, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className={cn(
                  "glass-strong relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border-2 p-9 sm:h-64 sm:w-64 gpu-accelerated",
                  theme.ring
                )}
              >
                <Icon className={cn("h-28 w-28", theme.accentText)} />
              </motion.div>
            )}

            {/* Number badge */}
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 18 }}
              className={cn(
                "glass-strong absolute -bottom-2 -right-2 flex h-16 w-16 items-center justify-center rounded-2xl border font-display text-xl font-bold text-white gpu-accelerated",
                theme.ring
              )}
            >
              {numberLabel}
            </motion.span>
          </div>
        </motion.div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, x: isReversed ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className={isReversed ? "lg:order-1" : "lg:order-2"}
        >
          <span className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium", theme.badge)}>
            Divisi {numberLabel}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
            {division.name}
          </h2>
          <p className={cn("mt-2 text-lg font-medium", theme.accentText)}>
            {division.tagline}
          </p>
          <p className="mt-5 text-base leading-relaxed text-slate-400">
            {division.description}
          </p>

          {division.skills.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {division.skills.map((skill, i) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                  className={cn("rounded-full border px-3.5 py-1.5 text-xs font-medium", theme.chip)}
                >
                  {skill}
                </motion.span>
              ))}
            </div>
          )}

          <Link
            href={EXTERNAL_URLS.registration}
            className={cn(
              "mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-6 py-3 text-sm font-semibold text-background shadow-lg transition-transform duration-300 hover:scale-105 gpu-accelerated",
              theme.gradient
            )}
          >
            Gabung Divisi Ini
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
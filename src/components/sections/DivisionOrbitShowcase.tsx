"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { iconMap } from "@/lib/icon-map";
import { divisionTheme } from "@/lib/division-theme";
import { cn } from "@/lib/utils";
import type { Division } from "@/types";

interface DivisionOrbitShowcaseProps {
  divisions: Division[];
  mouseX: number; // 0-100
  mouseY: number; // 0-100
}

// Posisi, ukuran, dan pola melayang tiap slot -- sengaja beda-beda
// (durasi, delay, amplitudo) biar 4 logo tidak pernah bergerak
// bersamaan/sinkron, kesannya lebih "hidup" dan organik.
const SLOTS = [
  { top: "4%", left: "6%", size: 104, floatX: [0, 16, -8, 0], floatY: [0, -20, 12, 0], rotate: 6, duration: 9, delay: 0, depth: 1.2 },
  { top: "2%", left: "56%", size: 132, floatX: [0, -14, 10, 0], floatY: [0, 18, -14, 0], rotate: -5, duration: 11.5, delay: 1, depth: 0.8 },
  { top: "54%", left: "2%", size: 122, floatX: [0, 12, -16, 0], floatY: [0, -16, 20, 0], rotate: 5, duration: 10, delay: 0.5, depth: 1 },
  { top: "58%", left: "54%", size: 114, floatX: [0, -18, 12, 0], floatY: [0, 14, -18, 0], rotate: -6, duration: 12.5, delay: 1.6, depth: 0.9 },
];

// Ukuran target saat hover -- semua kotak dibesarkan sampai 156px,
// jadi box kecil (104px) dapat scale lebih besar daripada box besar.
// (156 = 132 * 1.18, box terbesar tetap ~1.18x seperti sebelumnya.)
const HOVER_TARGET_SIZE = 156;

// Titik-titik sambungan antar slot (dipakai buat garis "constellation").
const LINE_PATH = "M 58 56 L 320 68 L 380 300 L 174 320 Z";

export function DivisionOrbitShowcase({
  divisions,
  mouseX,
  mouseY,
}: DivisionOrbitShowcaseProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const items = divisions.slice(0, 4);
  const parallaxX = (mouseX - 50) / 50; // -1..1
  const parallaxY = (mouseY - 50) / 50;

  return (
    <div className="relative mx-auto h-[420px] w-[340px] sm:h-[460px] sm:w-[420px] -translate-y-[90px]">
      {/* Ambient center glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[110px]" />

      {/* Constellation lines connecting the 4 logos */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 420 420"
        fill="none"
      >
        <defs>
          <linearGradient id="orbitLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={LINE_PATH}
          stroke="url(#orbitLine)"
          strokeWidth="1"
          strokeDasharray="5 7"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 2, ease: "easeInOut", delay: 0.4 }}
        />
      </svg>

      {/* Floating particles for extra depth */}
      {Array.from({ length: 10 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-accent/60"
          style={{
            top: `${(i * 37) % 100}%`,
            left: `${(i * 53) % 100}%`,
          }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: i * 0.3,
          }}
        />
      ))}

      {items.map((division, i) => {
        const slot = SLOTS[i];
        const theme = divisionTheme[division.color];
        const Icon = iconMap[division.icon] ?? iconMap.Bot;

        const isHovered = hoveredIndex === i;
        const isOtherHovered = hoveredIndex !== null && !isHovered;

        const hoverScale = HOVER_TARGET_SIZE / slot.size;
        const scaleValue = isHovered ? hoverScale : isOtherHovered ? 0.88 : 1;
        const opacityValue = isOtherHovered ? 0.65 : 1;

        return (
          <div
            key={division.id}
            className={cn("absolute transition-transform duration-300 ease-out", isHovered ? "z-30" : "z-10")}
            style={{
              top: slot.top,
              left: slot.left,
              transform: `translate(${parallaxX * 16 * slot.depth}px, ${
                parallaxY * 16 * slot.depth
              }px)`,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: opacityValue,
                scale: scaleValue,
                x: slot.floatX,
                y: slot.floatY,
                rotate: [0, slot.rotate, 0, -slot.rotate, 0],
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              transition={{
                opacity: { duration: 0.3 },
                scale: { duration: 0.3, ease: "easeOut" },
                x: { duration: slot.duration, repeat: Infinity, ease: "easeInOut", delay: slot.delay },
                y: { duration: slot.duration, repeat: Infinity, ease: "easeInOut", delay: slot.delay },
                rotate: { duration: slot.duration, repeat: Infinity, ease: "easeInOut", delay: slot.delay },
              }}
              className="relative cursor-pointer"
              style={{ width: slot.size, height: slot.size }}
            >
              {/* Pulsing colored glow behind the logo */}
              <motion.div
                className={cn("absolute -inset-4 rounded-full blur-2xl", theme.glow)}
                animate={{ opacity: isHovered ? 0.95 : [0.4, 0.85, 0.4], scale: isHovered ? 1.25 : [1, 1.15, 1] }}
                transition={{
                  duration: 3 + i * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <div
                className={cn(
                  "glass-strong relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border-2 p-4 transition-all duration-300",
                  theme.ring,
                  isHovered && "border-accent shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                )}
              >
                {division.logoUrl ? (
                  <Image
                    src={division.logoUrl}
                    alt={division.name}
                    width={slot.size}
                    height={slot.size}
                    className="h-full w-full object-contain"
                    priority={i === 0}
                  />
                ) : (
                  <Icon className={cn("h-1/2 w-1/2", theme.accentText)} />
                )}
              </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { useMousePosition } from "@/hooks/useMousePosition";
import { DivisionOrbitShowcase } from "@/components/sections/DivisionOrbitShowcase";
import type { HeroContent, Division } from "@/types";

interface HeroProps {
  content: HeroContent;
  divisions: Division[];
  foundedYear: number;
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 9) * 1.4}s`,
  duration: `${10 + (i % 6) * 2}s`,
}));

export function Hero({ content, divisions, foundedYear }: HeroProps) {
  const { containerRef, position, rawPosition } = useMousePosition<HTMLDivElement>();

  return (
    <section
      ref={containerRef}
      className="bg-grid relative flex min-h-screen items-center overflow-hidden px-6 pb-20 pt-36 sm:px-10 lg:px-16"
    >
      {/* Mouse-following spotlight watermark text "THE SMART GENERATION" */}
      <div
        className="pointer-events-none absolute inset-0 -z-15 overflow-hidden"
        style={{
          maskImage: `radial-gradient(280px circle at ${rawPosition.x}px ${rawPosition.y}px, black 0%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(280px circle at ${rawPosition.x}px ${rawPosition.y}px, black 0%, transparent 100%)`,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none">
          <span className="font-display font-extrabold tracking-tight text-[clamp(2rem,7vw,7rem)] leading-none uppercase whitespace-nowrap bg-gradient-to-r from-sky-400 via-white via-sky-200 to-sky-400 bg-[length:300%_auto] animate-[gradient_6s_linear_infinite] bg-clip-text text-transparent">
            THE SMART GENERATION
          </span>
          <span className="mt-3 font-display font-medium tracking-wide text-[clamp(0.85rem,2vw,1.6rem)] leading-none uppercase whitespace-nowrap bg-gradient-to-r from-sky-400 via-white via-sky-200 to-sky-400 bg-[length:300%_auto] animate-[gradient_6s_linear_infinite] bg-clip-text text-transparent">
            Together We Make A Better Future
          </span>
        </div>
      </div>

      {/* Mouse-following glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${position.x}% ${position.y}%, rgba(34,211,238,0.10), transparent 70%)`,
        }}
      />

      {/* Ambient corner glows */}
      <div className="animate-pulse-glow pointer-events-none absolute -left-32 top-24 -z-10 h-[380px] w-[380px] rounded-full bg-blue/25 blur-[100px]" />
      <div className="animate-pulse-glow pointer-events-none absolute -right-24 bottom-0 -z-10 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[120px] [animation-delay:1.5s]" />

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="animate-particle absolute bottom-0 h-1 w-1 rounded-full bg-accent/70"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left column: copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex flex-wrap items-center gap-3"
          >
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              {content.eyebrow}
            </div>
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-slate-400">
              Berdiri sejak {foundedYear}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]"
          >
            <span className="block">{content.heading}</span>
            <span className="text-gradient block">{content.highlightWord}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            {content.description}
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-10 grid grid-cols-2 gap-6 border-t border-white/[0.08] pt-8 sm:grid-cols-4"
          >
            {content.stats.map((stat) => (
              <div key={stat.id}>
                <div className="font-display text-2xl font-bold text-white sm:text-3xl">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right column: floating division logo showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative hidden lg:block"
        >
          <DivisionOrbitShowcase
            divisions={divisions}
            mouseX={position.x}
            mouseY={position.y}
          />
        </motion.div>
      </div>
    </section>
  );
}

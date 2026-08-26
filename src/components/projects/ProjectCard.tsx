"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Project;
  index: number;
}

const statusStyles: Record<Project["status"], string> = {
  Selesai: "border-accent/30 bg-accent/10 text-accent",
  "Sedang Dikerjakan": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Akan Datang": "border-blue/30 bg-blue/10 text-blue",
};

export function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      className="group h-full"
    >
      <Link
        href={`/project/${project.slug}`}
        className="glass relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] transition-colors duration-200 group-hover:border-accent/40"
      >
        <div className="relative h-44 w-full shrink-0 overflow-hidden">
          <Image
            src={project.coverImage}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
          <span
            className={cn(
              "glass-strong absolute left-3 top-3 rounded-full border px-3 py-1 text-[11px] font-medium",
// @ts-ignore
              statusStyles[project.status]
            )}
          >
            {project.status}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          {project.divisionName && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Layers className="h-3.5 w-3.5" />
              {project.divisionName} &middot; {project.year}
            </div>
          )}
          <h3 className="mt-2 font-display text-base font-semibold leading-snug text-white">
            {project.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
            {project.description}
          </p>

          {project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-accent">
            Lihat detail
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
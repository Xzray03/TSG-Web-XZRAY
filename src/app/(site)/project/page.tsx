import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { getCachedProjectsFiltered } from "@/sanity/serverCache";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Project",
  description:
    "Kumpulan project yang sudah, sedang, dan akan dikerjakan anggota The Smart Generation (TSG).",
};

interface ProjectPageProps {
  searchParams: Promise<{ status?: string }>;
}

const FILTERS: { label: string; value: ProjectStatus | "Semua" }[] = [
  { label: "Semua", value: "Semua" },
  { label: "Sudah Selesai", value: "Selesai" },
  { label: "Sedang Dikerjakan", value: "Sedang Dikerjakan" },
  { label: "Akan Datang", value: "Akan Datang" },
];

export default async function ProjectListPage({ searchParams }: ProjectPageProps) {
  const params = await searchParams;
  const activeStatus = params.status ?? "Semua";

  const { projects: filtered, allProjects } = await getCachedProjectsFiltered(activeStatus);

  if (allProjects.length === 0) {
    return (
      <div className="bg-grid relative overflow-hidden px-6 pb-24 pt-36 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              <FolderKanban className="h-3.5 w-3.5" />
              Project
            </div>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Karya Nyata <span className="text-gradient">Anggota TSG</span>
            </h1>
            <p className="mt-4 text-base text-slate-400">
              Dari yang sudah rampung, sedang digarap, sampai yang baru
              direncanakan.
            </p>
          </div>
          <p className="mt-16 text-center text-sm text-slate-500">
            Belum ada project yang dipublikasikan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-grid relative overflow-hidden px-6 pb-24 pt-36 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <FolderKanban className="h-3.5 w-3.5" />
            Project
          </div>
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Karya Nyata <span className="text-gradient">Anggota TSG</span>
          </h1>
          <p className="mt-4 text-base text-slate-400">
            Dari yang sudah rampung, sedang digarap, sampai yang baru
            direncanakan.
          </p>
        </div>

        {/* Server-side filter tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {FILTERS.map((f) => {
            const href = f.value === "Semua" ? "/project" : `/project?status=${encodeURIComponent(f.value)}`;
            const isActive = activeStatus === f.value;
            return (
              <Link
                key={f.value}
                href={href}
                className={cn(
                  "rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-white"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-16 text-center text-sm text-slate-500">
            Belum ada project di kategori ini.
          </p>
        ) : (
          <div className="mt-10 flex flex-wrap items-stretch justify-center gap-6">
            {filtered.map((project, index) => (
              <div
                key={project.id}
                className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
              >
                <ProjectCard project={project} index={index} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Layers, Calendar } from "lucide-react";
import { getProjectBySlug } from "@/sanity/queries";
import { ProjectContent } from "@/components/projects/ProjectContent";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

export const revalidate = false;

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

const statusStyles: Record<Project["status"], string> = {
  Selesai: "border-accent/30 bg-accent/10 text-accent",
  "Sedang Dikerjakan": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Akan Datang": "border-blue/30 bg-blue/10 text-blue",
};

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) return { title: "Project Tidak Ditemukan" };

  return {
    title: project.title,
    description: project.description,
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) notFound();

  return (
    <article className="bg-grid relative overflow-hidden px-6 pb-24 pt-36 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="mx-auto max-w-2xl">
        <Link
          href="/project"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Project
        </Link>

        <div className="mt-6">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
              statusStyles[project.status]
            )}
          >
            {project.status}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
            {project.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            {project.divisionName && (
              <span className="flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                {project.divisionName}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {project.year}
            </span>
          </div>

          {project.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08]">
          <Image
            src={project.coverImage}
            alt={project.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        </div>

        <div className="glass mt-8 rounded-2xl border border-white/[0.08] p-6 sm:p-7">
          <p className="text-base leading-relaxed text-slate-300">
            {project.description}
          </p>
        </div>

        {project.content && project.content.length > 0 && (
          <div className="glass mt-6 rounded-2xl border border-white/[0.08] p-6 sm:p-8">
            <ProjectContent content={project.content} />
          </div>
        )}
      </div>
    </article>
  );
}
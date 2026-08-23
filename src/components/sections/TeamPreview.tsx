"use client";

import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import { TeamMemberCard } from "@/components/team/TeamMemberCard";
import { Button } from "@/components/ui/Button";
import type { TeamMember } from "@/types";

interface TeamPreviewProps {
  members: TeamMember[];
}

export function TeamPreview({ members }: TeamPreviewProps) {
  const featured = members.filter((m) => m.featured);

  return (
    <section className="relative px-6 py-24 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute left-0 bottom-0 -z-10 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[140px]" />

      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
            <Users className="h-3.5 w-3.5" />
            Tim Kami
          </div>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Orang-Orang Di <span className="text-gradient">Balik TSG</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Digerakkan oleh pengurus dan koordinator divisi yang berdedikasi
            membina anggota di setiap bidang.
          </p>
        </motion.div>

        <div className="mt-14 flex flex-wrap items-stretch justify-center gap-6">
          {featured.map((member, index) => (
            <div
              key={member.id}
              className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
            >
              <TeamMemberCard member={member} index={index} />
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <Button
            href="/team"
            variant="secondary"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Lihat Semua Tim
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

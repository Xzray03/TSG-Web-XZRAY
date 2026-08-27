import { motion } from "framer-motion";
import { badgeConfig } from "@/lib/badge-config";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/types";
import { TeamMemberCardBadge } from "./TeamMemberCardBadge";

interface TeamMemberCardLayoutProps {
  member: TeamMember;
  index: number;
  badge?: keyof typeof badgeConfig | null;
  children: React.ReactNode;
}

export function TeamMemberCardLayout({
  member,
  index,
  badge,
  children,
}: TeamMemberCardLayoutProps) {
  const badgeData = member.badge ? badgeConfig[badgeKeyCleaner(member.badge)] : null;
  const badgeKey = member.badge;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="relative h-full rounded-2xl"
    >
      {badgeData && (
        <div className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl blur-xl opacity-35" />
      )}

      {badgeData && (
        <div className="pointer-events-none absolute -inset-[2px] -z-10 overflow-hidden rounded-2xl opacity-100">
          <div
            className="absolute inset-[-100%] blur-[2px] animate-[spin_6s_linear_infinite]"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, rgba(${badgeData.glowRgb},0.8) 50deg, transparent 130deg, transparent 360deg)`,
            }}
          />
        </div>
      )}

      <TeamMemberCardBadge badgeKey={badgeKey} />

      <div
        className={cn(
          "glass relative z-10 flex h-full flex-col overflow-hidden rounded-2xl border transition-colors duration-200",
          badgeData ? "border-white/10" : "border-white/[0.08]"
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}

function badgeKeyCleaner(key?: string) {
  if (!key) return "founder";
  return key as keyof typeof badgeConfig;
}

import Image from "next/image";
import { Tooltip } from "@/components/ui/Tooltip";
import { motion } from "framer-motion";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/types";

interface TeamMemberCardProfileProps {
  member: TeamMember;
  isExpanded: boolean;
}

const socialIcons = {
  instagram: Instagram,
  linkedin: Linkedin,
  email: Mail,
} as const;

export function TeamMemberCardProfile({ member, isExpanded }: TeamMemberCardProfileProps) {
  const achievements = member.achievements;
  const hasAchievements = achievements.length > 0;
  const socialEntries = Object.entries(member.socials).filter(
    ([_, href]) => Boolean(href)
  ) as [keyof typeof socialIcons, string][];

  return (
    <div className="group/profile relative aspect-[4/5] w-full overflow-hidden [transform:translateZ(0)]">
      <div className="absolute inset-0 overflow-hidden [transform:translateZ(0)]">
        <Image
          src={member.photo}
          alt={member.name}
          fill
          loading="eager"
          className="object-cover transition-transform duration-300 ease-out group-hover/profile:scale-105"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent pointer-events-none" />

        {/* Social links overlay on hover */}
        {socialEntries.length > 0 && (
          <div className="absolute bottom-2 left-0 right-0 flex translate-y-2 items-center justify-center gap-2 p-4 opacity-0 transition-all duration-200 ease-out group-hover/profile:translate-y-0 group-hover/profile:opacity-100 z-20">
            {socialEntries.map(([platform, href]) => {
              const Icon = socialIcons[platform];
              return (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} on ${platform}`}
                  className="glass-strong flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:text-accent"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              );
            })}
          </div>
        )}
      </div>

      {hasAchievements && !isExpanded && (
        <div className={cn(
          "absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 pointer-events-none transition-transform duration-300 ease-out",
          socialEntries.length > 0 && "group-hover/profile:-translate-y-9"
        )}>
          {achievements.map((ach, i) => {
            const count = achievements.length;
            let hoverX = 0;
            let hoverY = 0;

            if (count === 1) {
              hoverY = -28;
            } else if (count === 2) {
              hoverX = i === 0 ? -22 : 22;
              hoverY = -12;
            } else if (count === 3) {
              if (i === 0) {
                hoverX = -26;
                hoverY = -12;
              } else if (i === 1) {
                hoverX = 0;
                hoverY = -28;
              } else {
                hoverX = 26;
                hoverY = -12;
              }
            } else {
              const mid = (count - 1) / 2;
              const offsetIndex = i - mid;
              hoverX = offsetIndex * 22;
              hoverY = -12;
            }

            return (
              <Tooltip key={i} label={ach.title}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3, delay: 0.05 + i * 0.05 }}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-auto"
                >
                  <motion.div
                    animate={{
                      x: hoverX,
                      y: hoverY,
                    }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="glass-strong flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10"
                  >
                    <Image
                      src={ach.icon}
                      alt={ach.title}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                  </motion.div>
                </motion.div>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

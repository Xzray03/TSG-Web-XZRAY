import Image from "next/image";
import { Tooltip } from "@/components/ui/Tooltip";
import { motion } from "framer-motion";
import { Instagram, Linkedin, Mail } from "lucide-react";
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
  const hasAchievements = member.achievements.length > 0;
  const socialEntries = Object.entries(member.socials).filter(
    ([_, href]) => Boolean(href)
  ) as [keyof typeof socialIcons, string][];

  return (
    <div className="group/profile relative aspect-[4/5] w-full overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={member.photo}
          alt={member.name}
          fill
          className="object-cover transition-transform duration-300 ease-out group-hover/profile:scale-105"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />

        {/* Social links overlay on hover */}
        {socialEntries.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex translate-y-2 items-center justify-center gap-2 p-4 opacity-0 transition-all duration-200 ease-out group-hover/profile:translate-y-0 group-hover/profile:opacity-100 z-20">
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
        <div className="absolute -bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 transition-opacity duration-200 group-hover/profile:opacity-0">
          {member.achievements.map((ach, i) => (
            <Tooltip key={i} label={ach.title}>
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                className="glass-strong flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10"
              >
                <Image
                  src={ach.icon}
                  alt={ach.title}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
              </motion.span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
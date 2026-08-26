import { badgeConfig } from "@/lib/badge-config";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/types";

interface TeamMemberCardBadgeProps {
  badgeKey?: TeamMember["badge"];
}

export function TeamMemberCardBadge({ badgeKey }: TeamMemberCardBadgeProps) {
  const badge = badgeKey ? badgeConfig[badgeKey] : null;
  if (!badge) return null;

  return (
    <span className="absolute right-3 top-3 z-30">
      <Tooltip label={badge.label} position="bottom">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shadow-lg",
            badge.iconBg
          )}
        >
          {badge.icon ? <badge.icon className="h-4 w-4" strokeWidth={2.5} /> : null}
        </span>
      </Tooltip>
    </span>
  );
}

"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { PublicProfilePreviewModal } from "@/components/auth/PublicProfilePreviewModal";
import type { TeamMember } from "@/types";

interface TeamMemberCardPublicButtonProps {
  member: TeamMember;
}

export function TeamMemberCardPublicButton({ member }: TeamMemberCardPublicButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!member.isSupabaseConnected) return null;

  const pubAcc = member.publicAccount;
  const avatarUrl = pubAcc?.avatar_url || member.photo;
  const hasAvatar = Boolean(pubAcc?.avatar_url && pubAcc.avatar_url.trim());
  const nickname = pubAcc?.nickname || member.nickname || member.name;

  return (
    <>
      <span className="absolute left-3 top-3 z-30">
        <Tooltip label={`Lihat Akun Publik @${nickname}`} position="bottom">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Lihat Akun Publik"
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden border border-white/20 bg-slate-900/80 text-white backdrop-blur-md shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer"
          >
            {hasAvatar ? (
              <img
                src={avatarUrl}
                alt={nickname}
                className="h-full w-full object-cover object-top aspect-square"
                crossOrigin="anonymous"
              />
            ) : (
              <Globe className="h-4 w-4 text-blue-400" strokeWidth={2.5} />
            )}
          </button>
        </Tooltip>
      </span>

      <PublicProfilePreviewModal
        isOpen={isOpen}
        publicAccount={
          pubAcc || {
            nickname: member.nickname || member.name.toLowerCase().replace(/\s/g, ""),
            name: member.name,
            avatar_url: member.photo,
            show_tsg_member: true,
            bio: `${member.role}${member.division ? ` - ${member.division}` : ""}`,
          }
        }
        defaultAvatarUrl={member.photo}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

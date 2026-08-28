"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Zap, Mail } from "lucide-react";
import type { SiteSettings } from "@/types";

interface FooterAboutProps {
  settings: SiteSettings;
  setIsLogoModalOpen: (open: boolean) => void;
  handleLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  socialLinks: { platform: string; label: string; href: string; icon: typeof Mail }[];
}

export function FooterAbout({
  settings,
  setIsLogoModalOpen,
  handleLinkClick,
  socialLinks,
}: FooterAboutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2.5">
        {settings.logoUrl ? (
          <button
            type="button"
            onClick={() => setIsLogoModalOpen(true)}
            className="group relative flex h-14 w-14 items-center justify-center transition-transform duration-300 hover:scale-110 focus:outline-none cursor-pointer gpu-accelerated"
          >
            <span className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Image
              src={settings.logoUrl}
              alt={settings.shortName}
              width={56}
              height={56}
              className="h-full w-full object-contain"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsLogoModalOpen(true)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue text-background transition-transform duration-300 hover:scale-110 focus:outline-none cursor-pointer shadow-md gpu-accelerated"
          >
            <Zap className="h-5 w-5" strokeWidth={2.5} />
            <span className="absolute inset-0 -z-10 rounded-xl bg-primary/40 blur-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </button>
        )}

        <Link
          href="/"
          onClick={(e) => handleLinkClick(e, "/")}
          className="font-display text-lg font-semibold text-white transition-colors hover:text-accent"
        >
          {settings.shortName}
        </Link>
      </div>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
        {settings.description}
      </p>
      <p className="mt-4 text-xs text-slate-600">
        Berdiri sejak {settings.foundedYear}
      </p>

      <div 
        className="mt-5 flex items-center gap-2.5"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {socialLinks.map((social, index) => {
          const isHovered = hoveredIndex === index;
          const isAnyHovered = hoveredIndex !== null;

          let scale = 1;
          let translateY = 0;
          let translateX = 0;

          if (isHovered) {
            scale = 1.25;
            translateY = -6;
            translateX = 0;
          } else if (isAnyHovered) {
            scale = 0.94;
            translateY = 0;
            const distance = index - hoveredIndex;
            translateX = distance > 0 ? distance * 4 + 3 : distance * 4 - 3;
          }

          return (
            <a
              key={social.platform}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              onMouseEnter={() => setHoveredIndex(index)}
              className="glass flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-accent"
              style={{
                transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
                transitionProperty: "transform, color, background-color",
                transitionDuration: "250ms",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                willChange: "transform",
                zIndex: isHovered ? 20 : 10,
              }}
            >
              {social.icon ? <social.icon className="h-4 w-4" /> : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

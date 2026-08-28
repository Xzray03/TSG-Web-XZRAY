"use client";

import { useState, useEffect, MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Mail } from "lucide-react";
import { FaInstagram, FaYoutube } from "react-icons/fa";
import { LogoModal } from "./LogoModal";
import type { Division, SiteSettings } from "@/types";
import { FooterLayout } from "./Footer/FooterLayout";
import { FooterAbout } from "./Footer/FooterAbout";
import { FooterQuickLink } from "./Footer/FooterQuickLink";
import { FooterDivision } from "./Footer/FooterDivision";
import { FooterContact } from "./Footer/FooterContact";
import { FooterCopyright } from "./Footer/FooterCopyright";

interface FooterProps {
  divisions: Division[];
  settings: SiteSettings;
}

export function Footer({ divisions, settings }: FooterProps) {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isLogoModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isLogoModalOpen]);

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const socialLinks = [
    settings.instagramUrl && {
      platform: "instagram",
      label: "Instagram",
      href: settings.instagramUrl,
      icon: FaInstagram,
    },
    settings.youtubeUrl && {
      platform: "youtube",
      label: "YouTube",
      href: settings.youtubeUrl,
      icon: FaYoutube,
    },
    {
      platform: "email",
      label: "Email",
      href: `mailto:${settings.contactEmail}`,
      icon: Mail,
    },
  ].filter(Boolean) as { platform: string; label: string; href: string; icon: any }[];

  return (
    <FooterLayout>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
        <FooterAbout
          settings={settings}
          setIsLogoModalOpen={setIsLogoModalOpen}
          handleLinkClick={handleLinkClick}
          socialLinks={socialLinks}
        />
        <FooterQuickLink handleLinkClick={handleLinkClick} />
        <FooterDivision divisions={divisions} handleLinkClick={handleLinkClick} />
        <FooterContact settings={settings} />
      </div>

      <FooterCopyright settings={settings} currentYear={currentYear} />

      <AnimatePresence>
        {isLogoModalOpen && settings.logoUrl && (
          <LogoModal
            logoUrl={settings.logoUrl}
            alt={settings.shortName}
            onClose={() => setIsLogoModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </FooterLayout>
  );
}
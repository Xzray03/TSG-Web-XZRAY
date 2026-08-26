"use client";

import { useState } from "react";
import Link from "next/link";
import { navLinks } from "@/data/nav";

interface FooterQuickLinkProps {
  handleLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export function FooterQuickLink({ handleLinkClick }: FooterQuickLinkProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-white">
        Quick Links
      </h4>
      <ul 
        className="mt-4 space-y-1"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {navLinks.map((link, index) => {
          const isHovered = hoveredIndex === index;

          let scale = 1;
          let translateX = 0;

          if (isHovered) {
            scale = 1.06;
            translateX = 6;
          }

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                onMouseEnter={() => setHoveredIndex(index)}
                className="inline-block py-1 text-sm text-slate-500 transition-colors duration-200 hover:text-accent"
                style={{
                  transform: `translate3d(${translateX}px, 0, 0) scale(${scale})`,
                  transformOrigin: "left center",
                  transitionProperty: "transform, color",
                  transitionDuration: "200ms",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  willChange: "transform",
                }}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

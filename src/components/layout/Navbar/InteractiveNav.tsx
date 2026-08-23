import React, { useState } from "react";
import Link from "next/link";
import { navLinks } from "@/data/nav";

interface InteractiveNavProps {
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export function InteractiveNav({ handleNavClick }: InteractiveNavProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <nav 
      className="hidden items-center gap-1 lg:flex"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {navLinks.map((link, index) => {
        const isHovered = hoveredIndex === index;
        const isAnyHovered = hoveredIndex !== null;

        let scale = 1;
        let translateY = 0;
        let translateX = 0;

        if (isHovered) {
          scale = 1.06;
          translateY = -2;
          translateX = 0;
        } else if (isAnyHovered) {
          scale = 0.98;
          translateY = 0;
          const distance = index - hoveredIndex;
          translateX = distance * 1.5;
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={(e) => handleNavClick(e, link.href)}
            onMouseEnter={() => setHoveredIndex(index)}
            className="relative rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            style={{
              transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
              transitionProperty: "transform, background-color, color",
              transitionDuration: "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              willChange: "transform",
              zIndex: isHovered ? 20 : 10,
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

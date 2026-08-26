import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/data/nav";
import { cn } from "@/lib/utils";

interface InteractiveNavProps {
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export function InteractiveNav({ handleNavClick }: InteractiveNavProps) {
  const pathname = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <nav 
      className="hidden items-center gap-2.5 lg:flex"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {navLinks.map((link, index) => {
        const isHovered = hoveredIndex === index;
        const isAnyHovered = hoveredIndex !== null;

        // Cek apakah link ini adalah halaman yang sedang aktif
        const isActive = link.href === "/" 
          ? pathname === "/" 
          : pathname === link.href || pathname?.startsWith(`${link.href}/`);

        let scale = 1;
        let translateY = 0;
        let translateX = 0;

        if (isHovered) {
          scale = 1.16;
          translateY = -4;
          translateX = 0;
        } else if (isAnyHovered) {
          scale = 0.98;
          translateY = 0;
          const distance = index - hoveredIndex;
          // Perbesar jarak dorong antar tombol tetangga saat di-hover (dari 1.5px menjadi 5px)
          translateX = distance > 0 ? distance * 5 + 4 : distance * 5 - 4;
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={(e) => handleNavClick(e, link.href)}
            onMouseEnter={() => setHoveredIndex(index)}
            className={cn(
              "relative rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-white/10 hover:text-white",
              isActive 
                ? "bg-white/15 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md" 
                : "text-slate-300"
            )}
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

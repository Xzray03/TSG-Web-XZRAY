"use client";

import { useState } from "react";
import Link from "next/link";
import type { Division } from "@/types";

interface FooterDivisionProps {
  divisions: Division[];
  handleLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export function FooterDivision({ divisions, handleLinkClick }: FooterDivisionProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-white">
        Divisi
      </h4>
      <ul 
        className="mt-4 space-y-1"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {divisions.map((division, index) => {
          const isHovered = hoveredIndex === index;

          let scale = 1;
          let translateX = 0;

          if (isHovered) {
            scale = 1.06;
            translateX = 6;
          }

          return (
            <li key={division.id}>
              <Link
                href={`/divisions#${division.slug}`}
                onClick={(e) => handleLinkClick(e, `/divisions#${division.slug}`)}
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
                {division.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

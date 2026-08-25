"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface InteractiveSkillTagsProps {
  skills: string[];
  chipThemeClass: string;
}

export function InteractiveSkillTags({ skills, chipThemeClass }: InteractiveSkillTagsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div 
      className="flex flex-wrap gap-2.5"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {skills.map((skill, index) => {
        const isHovered = hoveredIndex === index;
        const isAnyHovered = hoveredIndex !== null;

        let scale = 1;
        let translateY = 0;
        let translateX = 0;

        if (isHovered) {
          scale = 1.12;
          translateY = -3;
          translateX = 0;
        } else if (isAnyHovered) {
          scale = 0.98;
          translateY = 0;
          const distance = index - hoveredIndex;
          translateX = distance * 1.5;
        }

        return (
          <button
            type="button"
            key={skill}
            onMouseEnter={() => setHoveredIndex(index)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 cursor-pointer",
              isHovered ? "bg-white/15 text-white border-white/30 shadow-md" : chipThemeClass
            )}
            style={{
              transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
              transitionProperty: "transform, background-color, color, border-color, box-shadow",
              transitionDuration: "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              willChange: "transform",
              zIndex: isHovered ? 20 : 10,
            }}
          >
            {skill}
          </button>
        );
      })}
    </div>
  );
}
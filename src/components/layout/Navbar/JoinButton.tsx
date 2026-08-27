"use client";

import Link from "next/link";
import { EXTERNAL_URLS } from "@/data/url";
import { useRobot } from "../RobotContext";

export function JoinButton() {
  const { setIsExcited } = useRobot();

  return (
    <div
      onMouseEnter={() => setIsExcited(true)}
      onMouseLeave={() => setIsExcited(false)}
      className="inline-block"
    >
      <Link
        href={EXTERNAL_URLS.registration}
        className="glow-cyan inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-blue px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500 hover:to-indigo-600 hover:text-white hover:shadow-[0_0_40px_-8px_rgba(168,85,247,0.45)] hover:scale-105 gpu-accelerated"
      >
        Join TSG
      </Link>
    </div>
  );
}
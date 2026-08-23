import { smartFetchWithCache } from "../cacheClient";
import type { AchievementItem } from "@/types";

interface SanityAchievement {
  _id: string;
  _rev?: string;
  title: string;
  event: string;
  year: number;
  level: "Regional" | "National" | "International";
  featured: boolean;
}

export async function getAchievements(): Promise<AchievementItem[]> {
  const query = `*[_type == "achievement"] | order(year desc) {
    _id, _rev, title, event, year, level, featured
  }`;

  return smartFetchWithCache<AchievementItem[]>(
    "achievements_list",
    query,
    (data: SanityAchievement[]) =>
      (data ?? []).map((item) => ({
        id: item._id,
        title: item.title,
        event: item.event,
        year: item.year,
        level: item.level,
        featured: item.featured,
      })),
    []
  );
}
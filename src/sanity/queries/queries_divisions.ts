import { smartFetchWithCache } from "../cacheClient";
import { urlForImage } from "../image";
import type { Division, Project } from "@/types";
import type { Image } from "sanity";

interface SanityDivision {
  _id: string;
  _rev?: string;
  name: string;
  slug: { current: string };
  tagline: string;
  description: string;
  icon: string;
  logo?: Image;
  skills: string[];
  color: "primary" | "accent" | "blue";
}

export async function getDivisions(): Promise<Division[]> {
  const query = `*[_type == "division"] | order(order asc) {
    _id, _rev, name, slug, tagline, description, icon, logo, skills, color
  }`;

  return smartFetchWithCache<Division[]>(
    "divisions_list",
    query,
    (data: SanityDivision[]) =>
      (data ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        slug: item.slug?.current ?? "",
        tagline: item.tagline,
        description: item.description,
        icon: item.icon,
        logoUrl: item.logo
          ? urlForImage(item.logo).width(160).height(160).fit("max").auto("format").url()
          : undefined,
        skills: item.skills ?? [],
        color: item.color,
      })),
    []
  );
}
import { cache } from "react";
import type { GalleryItem, UniformShowcase, TeamCategory, TeamMember } from "@/types";
import { getGalleryImages, getUniformShowcase, getTeamCategories, getTeamMembers } from "@/sanity/queries";
import { client } from "@/sanity/client";

/**
 * Server-side smart cache checking revision (_rev) from Sanity before rendering/filtering.
 * This guarantees that if content in Sanity hasn't changed, cached server results
 * are reused instantly, while updates automatically invalidate and refetch.
 */
let cachedGalleryRevSignature = "";
let cachedGalleryData: { images: GalleryItem[]; uniform: UniformShowcase | null } | null = null;

async function fetchGalleryWithRevCheck() {
  try {
    const meta: { _id: string; _rev: string }[] = await client.fetch(`*[_type in ["galleryImage", "uniformShowcase"]] { _id, _rev }`);
    const currentSignature = meta.map(m => `${m._id}:${m._rev}`).sort().join("|");

    if (cachedGalleryData && cachedGalleryRevSignature === currentSignature) {
      return cachedGalleryData;
    }

    const [images, uniform] = await Promise.all([
      getGalleryImages(),
      getUniformShowcase(),
    ]);

    cachedGalleryRevSignature = currentSignature;
    cachedGalleryData = { images, uniform };
    return cachedGalleryData;
  } catch {
    const [images, uniform] = await Promise.all([
      getGalleryImages(),
      getUniformShowcase(),
    ]);
    return { images, uniform };
  }
}

let cachedTeamRevSignature = "";
let cachedTeamData: { categories: TeamCategory[]; members: TeamMember[] } | null = null;

async function fetchTeamWithRevCheck() {
  try {
    const meta: { _id: string; _rev: string }[] = await client.fetch(`*[_type in ["teamMember", "teamCategory"]] { _id, _rev }`);
    const currentSignature = meta.map(m => `${m._id}:${m._rev}`).sort().join("|");

    if (cachedTeamData && cachedTeamRevSignature === currentSignature) {
      return cachedTeamData;
    }

    const [categories, members] = await Promise.all([
      getTeamCategories(),
      getTeamMembers(),
    ]);

    cachedTeamRevSignature = currentSignature;
    cachedTeamData = { categories, members };
    return cachedTeamData;
  } catch {
    const [categories, members] = await Promise.all([
      getTeamCategories(),
      getTeamMembers(),
    ]);
    return { categories, members };
  }
}

export const getCachedGalleryFiltered = cache(async (category: string) => {
  const { images, uniform } = await fetchGalleryWithRevCheck();
  const filtered =
    category === "Semua"
      ? images
      : images.filter((i) => i.category === category);

  return { images: filtered, uniform, allImages: images };
});

export const getCachedTeamFiltered = cache(async (catSlug?: string) => {
  const { categories, members } = await fetchTeamWithRevCheck();
  const activeSlug = catSlug ?? categories[0]?.slug ?? "";
  const filtered = members.filter((m) => m.categories.includes(activeSlug));

  return { categories, members: filtered, activeSlug };
});
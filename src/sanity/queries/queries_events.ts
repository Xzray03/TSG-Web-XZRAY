import { smartFetchWithCache } from "./cacheClient";
import { urlForImage } from "./image";
import type { EventItem } from "@/types";
import type { Image } from "sanity";

interface SanityEvent {
  _id: string;
  _rev?: string;
  title: string;
  description: string;
  date: string;
  location: string;
  image?: Image;
  imageWidth?: number | null;
  imageHeight?: number | null;
  ctaLabel?: string;
  ctaHref?: string;
}

export async function getEvents(): Promise<EventItem[]> {
  const query = `*[_type == "event"] | order(date asc) {
    _id, _rev, title, description, date, location, image, ctaLabel, ctaHref,
    "imageWidth": image.asset->metadata.dimensions.width,
    "imageHeight": image.asset->metadata.dimensions.height
  }`;

  return smartFetchWithCache<EventItem[]>(
    "events_list",
    query,
    (data: SanityEvent[]) => {
      const now = Date.now();
      return (data ?? []).map((item) => ({
        id: item._id,
        title: item.title,
        description: item.description,
        date: item.date,
        location: item.location,
        status: new Date(item.date).getTime() >= now ? "upcoming" : "past",
        image: item.image
          ? urlForImage(item.image).width(1200).auto("format").url()
          : "",
        imageWidth: item.imageWidth ?? undefined,
        imageHeight: item.imageHeight ?? undefined,
        cta:
          item.ctaLabel && item.ctaHref
            ? { label: item.ctaLabel, href: item.ctaHref }
            : undefined,
      }));
    },
    []
  );
}
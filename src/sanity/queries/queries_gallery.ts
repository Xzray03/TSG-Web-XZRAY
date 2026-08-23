import { smartFetchWithCache } from "./cacheClient";
import { urlForImage } from "./image";
import type { GalleryItem, UniformShowcase } from "@/types";
import type { Image } from "sanity";

interface SanityGalleryImage {
  _id: string;
  _rev?: string;
  image: Image;
  alt: string;
  category: string;
  width: number | null;
  height: number | null;
}

export async function getGalleryImages(): Promise<GalleryItem[]> {
  const query = `*[_type == "galleryImage"] | order(order asc) {
    _id, _rev, image, alt, category,
    "width": image.asset->metadata.dimensions.width,
    "height": image.asset->metadata.dimensions.height
  }`;

  return smartFetchWithCache<GalleryItem[]>(
    "gallery_images_list",
    query,
    (data: SanityGalleryImage[]) =>
      (data ?? []).map((item) => ({
        id: item._id,
        src: urlForImage(item.image).width(800).auto("format").url(),
        alt: item.alt,
        category: item.category,
        width: item.width ?? 800,
        height: item.height ?? 800,
      })),
    []
  );
}

interface SanityUniformShowcase {
  _id?: string;
  _rev?: string;
  title: string;
  frontImage: Image;
  backImage: Image;
  rightImage: Image;
  leftImage: Image;
}

export async function getUniformShowcase(): Promise<UniformShowcase | null> {
  const query = `*[_type == "uniformShowcase"][0] {
    _id, _rev, title, frontImage, backImage, rightImage, leftImage
  }`;

  return smartFetchWithCache<UniformShowcase | null>(
    "uniform_showcase",
    query,
    (data: SanityUniformShowcase | null) => {
      if (!data) return null;
      return {
        title: data.title,
        front: urlForImage(data.frontImage).width(900).auto("format").url(),
        back: urlForImage(data.backImage).width(900).auto("format").url(),
        right: urlForImage(data.rightImage).width(900).auto("format").url(),
        left: urlForImage(data.leftImage).width(900).auto("format").url(),
      };
    },
    null
  );
}
import imageUrlBuilder from "@sanity/image-url";
import { dataset, projectId } from "./env";

const imageBuilder = imageUrlBuilder({ projectId, dataset });

export function urlForImage(source: any) {
  return imageBuilder.image(source);
}
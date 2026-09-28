"use client";

interface Attachment {
  url: string;
  name?: string;
  size?: number;
  mime?: string;
  ext?: string;
  type?: string;
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "ico"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "avi", "mkv", "m4v"];
const AUDIO_EXTS = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus", "wma"];

// Detect extension from URL string (works with catbox filenames)
function getUrlExtension(url: string, fallbackExt?: string): string {
  const fromFallback = (fallbackExt || "").toLowerCase();
  if (fromFallback) return fromFallback;
  try {
    const clean = url.split("?")[0].split("#")[0];
    const lastSegment = clean.split("/").pop() || "";
    const parts = lastSegment.split(".");
    if (parts.length > 1) {
      return (parts.pop() || "").toLowerCase();
    }
  } catch (e) {}
  return "";
}

function detectCategory(att: Attachment): "image" | "video" | "audio" | "other" {
  if (att.type === "image" || att.mime?.startsWith("image/")) return "image";
  if (att.type === "video" || att.mime?.startsWith("video/")) return "video";
  if (att.type === "audio" || att.mime?.startsWith("audio/")) return "audio";

  const ext = getUrlExtension(att.url, att.ext).toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (AUDIO_EXTS.includes(ext)) return "audio";

  // Last resort: check the URL string
  const lower = att.url.toLowerCase();
  if (IMAGE_EXTS.some((e) => lower.includes(`.${e}`))) return "image";
  if (VIDEO_EXTS.some((e) => lower.includes(`.${e}`))) return "video";
  if (AUDIO_EXTS.some((e) => lower.includes(`.${e}`))) return "audio";

  return "other";
}

export function SocialMediaRenderer({
  attachments,
  mediaUrl,
  mediaType,
}: {
  attachments?: Attachment[];
  mediaUrl?: string;
  mediaType?: string;
}) {
  let list: Attachment[] =
    Array.isArray(attachments) && attachments.length > 0
      ? attachments
      : mediaUrl
        ? [{ url: mediaUrl, type: mediaType }]
        : [];

  // Filter out invalid entries
  list = list.filter((a) => a && typeof a.url === "string" && a.url.startsWith("http"));

  if (list.length === 0) return null;

  const images: Attachment[] = [];
  const videos: Attachment[] = [];
  const audios: Attachment[] = [];
  const others: Attachment[] = [];

  for (const att of list) {
    const cat = detectCategory(att);
    if (cat === "image") images.push(att);
    else if (cat === "video") videos.push(att);
    else if (cat === "audio") audios.push(att);
    else others.push(att);
  }

  return (
    <div className="mb-3 space-y-3">
      {/* Images: show directly (stream-friendly via next/image unoptimized or plain img) */}
      {images.length > 0 && (
        <div
          className={
            images.length === 1
              ? "overflow-hidden rounded-2xl border border-white/10 bg-slate-950"
              : "grid grid-cols-2 gap-2"
          }
        >
          {images.map((att, i) => (
            <a
              key={`img-${i}`}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-2xl border border-white/10 bg-slate-950 hover:opacity-95 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.url}
                alt={att.name || `Gambar ${i + 1}`}
                loading="lazy"
                className={`w-full object-cover ${images.length === 1 ? "max-h-[480px]" : "aspect-square"}`}
                crossOrigin="anonymous"
              />
            </a>
          ))}
        </div>
      )}

      {/* Videos: native stream from catbox URL */}
      {videos.map((att, i) => (
        <div
          key={`vid-${i}`}
          className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950"
        >
          <video
            src={att.url}
            controls
            preload="metadata"
            playsInline
            className="w-full max-h-[480px] bg-black"
          />
        </div>
      ))}

      {/* Audios: native audio stream player */}
      {audios.map((att, i) => (
        <div
          key={`aud-${i}`}
          className="rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
            <span className="truncate font-semibold text-emerald-400">
              🎵 {att.name || att.url.split("/").pop()}
            </span>
            {typeof att.size === "number" && att.size > 0 && (
              <span className="text-[10px] text-white/40 shrink-0">
                {(att.size / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
          </div>
          <audio
            src={att.url}
            controls
            preload="metadata"
            className="w-full rounded-xl"
          />
        </div>
      ))}

      {/* Other files: download link card */}
      {others.map((att, i) => (
        <a
          key={`file-${i}`}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 text-xs text-slate-200 hover:text-white bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 break-all hover:bg-white/10 transition-colors"
        >
          <span className="shrink-0 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">
            {getUrlExtension(att.url, att.ext) || "FILE"}
          </span>
          <span className="truncate flex-1">{att.name || att.url.split("/").pop()}</span>
          {typeof att.size === "number" && att.size > 0 && (
            <span className="shrink-0 text-[10px] text-white/40">
              {(att.size / 1024 / 1024).toFixed(1)} MB
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

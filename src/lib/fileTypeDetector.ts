export interface DetectedFileType {
  category: "image" | "video" | "audio" | "document" | "archive" | "other";
  mimeType: string;
  extension: string;
  isMedia: boolean;
}

/**
 * Detect file type using magic numbers (header bytes) with extension fallback
 */
export async function detectFileType(
  file: File | Blob,
  originalFileName?: string
): Promise<DetectedFileType> {
  const name = originalFileName || (file as File).name || "file";
  const ext = (name.split(".").pop() || "").toLowerCase();

  let bytes = new Uint8Array(0);
  try {
    const headerBuffer = await readFileHeader(file, 32);
    bytes = new Uint8Array(headerBuffer);
  } catch (e) {
    // If reading header fails, fallback to extension
  }

  // 1. Check Magic Numbers (signatures)
  if (bytes.length >= 4) {
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { category: "image", mimeType: "image/png", extension: ext || "png", isMedia: true };
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { category: "image", mimeType: "image/jpeg", extension: ext || "jpg", isMedia: true };
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { category: "image", mimeType: "image/gif", extension: ext || "gif", isMedia: true };
    }

    // WEBP: RIFF....WEBP (52 49 46 46 at 0..3 and 57 45 42 50 at 8..11)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { category: "image", mimeType: "image/webp", extension: ext || "webp", isMedia: true };
    }

    // BMP: 42 4D
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return { category: "image", mimeType: "image/bmp", extension: ext || "bmp", isMedia: true };
    }

    // EBML (WEBM / MKV): 1A 45 DF A3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      const isWebm = ext === "webm" || file.type.includes("webm");
      return {
        category: "video",
        mimeType: isWebm ? "video/webm" : "video/x-matroska",
        extension: ext || (isWebm ? "webm" : "mkv"),
        isMedia: true,
      };
    }

    // MP4 / MOV / 3GP / M4V (ftyp at offset 4..7)
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      if (bytes.length >= 12) {
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (brand.includes("M4A")) {
          return { category: "audio", mimeType: "audio/mp4", extension: ext || "m4a", isMedia: true };
        }
      }
      return { category: "video", mimeType: file.type || "video/mp4", extension: ext || "mp4", isMedia: true };
    }

    // AVI: RIFF....AVI (52 49 46 46 at 0..3 and 41 56 49 20 at 8..11)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x41 &&
      bytes[9] === 0x56 &&
      bytes[10] === 0x49 &&
      bytes[11] === 0x20
    ) {
      return { category: "video", mimeType: "video/x-msvideo", extension: ext || "avi", isMedia: true };
    }

    // MP3: ID3 (49 44 33) or sync word (FF FB / FF F3 / FF F2)
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2))
    ) {
      return { category: "audio", mimeType: "audio/mpeg", extension: ext || "mp3", isMedia: true };
    }

    // WAV: RIFF....WAVE (52 49 46 46 at 0..3 and 57 41 56 45 at 8..11)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x41 &&
      bytes[10] === 0x56 &&
      bytes[11] === 0x45
    ) {
      return { category: "audio", mimeType: "audio/wav", extension: ext || "wav", isMedia: true };
    }

    // OGG: OggS (4F 67 67 53)
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      const isAudio = ext === "ogg" || ext === "opus" || file.type.includes("audio");
      return {
        category: isAudio ? "audio" : "video",
        mimeType: file.type || "audio/ogg",
        extension: ext || "ogg",
        isMedia: true,
      };
    }

    // FLAC: fLaC (66 4C 61 43)
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return { category: "audio", mimeType: "audio/flac", extension: ext || "flac", isMedia: true };
    }

    // PDF: %PDF (25 50 44 46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { category: "document", mimeType: "application/pdf", extension: ext || "pdf", isMedia: false };
    }

    // PK Zip / OOXML (DOCX, XLSX, PPTX, ZIP): 50 4B 03 04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      if (["docx", "doc"].includes(ext)) {
        return { category: "document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: ext, isMedia: false };
      }
      if (["xlsx", "xls"].includes(ext)) {
        return { category: "document", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: ext, isMedia: false };
      }
      if (["pptx", "ppt"].includes(ext)) {
        return { category: "document", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: ext, isMedia: false };
      }
      return { category: "archive", mimeType: "application/zip", extension: ext || "zip", isMedia: false };
    }

    // RAR: Rar! (52 61 72 21)
    if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
      return { category: "archive", mimeType: "application/x-rar-compressed", extension: ext || "rar", isMedia: false };
    }

    // 7Z: 7z.. (37 7A BC AF)
    if (bytes[0] === 0x37 && bytes[1] === 0x7a && bytes[2] === 0xbc && bytes[3] === 0xaf) {
      return { category: "archive", mimeType: "application/x-7z-compressed", extension: ext || "7z", isMedia: false };
    }
  }

  // 2. Fallback to Extension / File.type
  if (
    file.type.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "heic"].includes(ext)
  ) {
    return { category: "image", mimeType: file.type || `image/${ext}`, extension: ext || "jpg", isMedia: true };
  }

  if (
    file.type.startsWith("video/") ||
    ["mp4", "webm", "mkv", "mov", "avi", "wmv", "flv", "m4v", "3gp"].includes(ext)
  ) {
    return { category: "video", mimeType: file.type || `video/${ext}`, extension: ext || "mp4", isMedia: true };
  }

  if (
    file.type.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus", "wma"].includes(ext)
  ) {
    return { category: "audio", mimeType: file.type || `audio/${ext}`, extension: ext || "mp3", isMedia: true };
  }

  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "md"].includes(ext)) {
    return { category: "document", mimeType: file.type || "application/octet-stream", extension: ext || "pdf", isMedia: false };
  }

  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) {
    return { category: "archive", mimeType: file.type || "application/octet-stream", extension: ext || "zip", isMedia: false };
  }

  return { category: "other", mimeType: file.type || "application/octet-stream", extension: ext || "bin", isMedia: false };
}

function readFileHeader(file: File | Blob, length: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, length);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

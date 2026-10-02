import crypto from "crypto";
import { AuthError, requireSecret } from "./secrets";

export const FACE_THRESHOLD = 0.52; // sama seperti sebelumnya
const REPLAY_FLOOR = 0.02; // jarak ~0 = vektor identik (replay), bukan tangkapan kamera

function key(): Buffer {
  return crypto.createHash("sha256").update(requireSecret("FACE_DATA_KEY")).digest();
}

export function validateVectors(v: any): number[][] | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const out: number[][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== 128) return null;
    const nums: number[] = [];
    for (const n of row) {
      if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 10) return null;
      nums.push(n);
    }
    out.push(nums);
  }
  return out;
}

export function encryptTemplate(vectors: number[][], userId: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(`face|${userId}`));
  const ct = Buffer.concat([c.update(JSON.stringify(vectors), "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
}

export function decryptTemplate(stored: string, userId: string): number[][] {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new AuthError("Template wajah rusak.", "SERVER_ERROR");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(parts[1], "base64"));
  d.setAAD(Buffer.from(`face|${userId}`));
  d.setAuthTag(Buffer.from(parts[2], "base64"));
  const pt = Buffer.concat([d.update(Buffer.from(parts[3], "base64")), d.final()]).toString("utf8");
  return JSON.parse(pt);
}

function dist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Aturan sama seperti sebelumnya: jarak terkecil dari 4 pose vs patokan pendaftaran. */
export function matchFace(enrolled: number[][], submitted: number[][]): boolean {
  const distances: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ref = enrolled[i] || enrolled[0];
    if (ref && submitted[i]) distances.push(dist(submitted[i], ref));
  }
  if (distances.length === 0) return false;
  const min = Math.min(...distances);
  // Tolak vektor yang identik dengan template (replay data bocor): tangkapan kamera tidak pernah persis sama.
  if (distances.every((d) => d < REPLAY_FLOOR)) return false;
  return min <= FACE_THRESHOLD;
}

/**
 * Kolom lama `face_vectors` berisi riwayat (terbaru di depan). Patokan pendaftaran pertama
 * adalah entri PALING LAMA yang masih ada = elemen terakhir.
 */
export function legacyAnchor(faceVectors: any): number[][] | null {
  if (!Array.isArray(faceVectors) || faceVectors.length === 0) return null;
  const oldest = faceVectors[faceVectors.length - 1];
  if (Array.isArray(oldest) && Array.isArray(oldest[0])) return oldest as number[][];
  if (Array.isArray(oldest) && typeof oldest[0] === "number") return [oldest as number[]];
  return null;
}

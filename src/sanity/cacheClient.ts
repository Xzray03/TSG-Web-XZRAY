import { client } from "./client";

export interface CachedEntityMetadata {
  _id: string;
  _type: string;
  _rev: string;
  _updatedAt: string;
}

const STORAGE_PREFIX = "tsg_cache_";
const METADATA_KEY = "tsg_cache_metadata_map";

/**
 * Mendapatkan peta metadata seluruh dokumen dari localStorage.
 */
export function getLocalMetadataMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Menyimpan peta metadata ke localStorage.
 */
export function setLocalMetadataMap(map: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save metadata map to localStorage", e);
  }
}

/**
 * Mengambil data dokumen tersimpan dari localStorage.
 */
export function getCachedEntity<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Menyimpan data dokumen ke localStorage.
 */
export function setCachedEntity<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save entity to localStorage", e);
  }
}

/**
 * Fungsi pintar untuk mengambil data dari Sanity dengan optimasi Cache & Metadata/Hash checking.
 * 1. Mengambil metadata ringan (_id dan _rev) dari Sanity.
 * 2. Membandingkan _rev dengan localStorage metadata map.
 * 3. Jika tidak ada perubahan (_rev sama), ambil data penuh dari localStorage.
 * 4. Jika ada dokumen baru/berubah, hanya ambil dokumen tersebut dari Sanity dan perbarui cache.
 */
export async function smartFetchWithCache<T>(
  cacheKey: string,
  query: string,
  transformFn: (raw: any) => T,
  fallbackValue: T
): Promise<T> {
  // Di SSR (Server-Side Rendering), langsung fetch dari Sanity karena localStorage tidak ada
  if (typeof window === "undefined") {
    try {
      const data = await client.fetch(query);
      if (!data) return fallbackValue;
      return transformFn(data);
    } catch {
      return fallbackValue;
    }
  }

  try {
    // 1. Ambil metadata ringan (_id dan _rev) untuk seluruh dokumen yang terlibat dalam query
    // Query metadata mengekstrak _id dan _rev saja agar sangat ringan.
    const metadataQuery = query.replace(/(\[\d+\])?\s*\{\s*[\s\S]*?\s*\}/, "$1 { _id, _rev }");
    const remoteMetadata: CachedEntityMetadata[] = await client.fetch(metadataQuery);

    const localMap = getLocalMetadataMap();
    const remoteMap: Record<string, string> = {};
    
    // Tangani jika hasil query berupa single object (misal [0]) atau array
    const isArray = Array.isArray(remoteMetadata);
    const items = isArray ? remoteMetadata : (remoteMetadata ? [remoteMetadata] : []);

    let needsFullFetch = false;
    for (const item of items) {
      if (item && item._id) {
        remoteMap[item._id] = item._rev || "";
        // 2. Cek apakah ada yang baru atau belum ada di localMap
        if (!localMap[item._id] || localMap[item._id] !== item._rev) {
          needsFullFetch = true;
        }
      }
    }

    // Cek juga apakah ada item di localMap yang sudah dihapus di remote
    if (Object.keys(localMap).length > 0 && isArray) {
      const remoteIds = new Set(items.map(i => i?._id).filter(Boolean));
      for (const localId of Object.keys(localMap)) {
        if (localId.startsWith(cacheKey) && !remoteIds.has(localId)) {
          needsFullFetch = true;
        }
      }
    }

    const cachedData = getCachedEntity<T>(cacheKey);

    // 3. Jika cache ada dan tidak ada perubahan metadata, gunakan cache penuh dari localStorage
    if (!needsFullFetch && cachedData !== null) {
      return cachedData;
    }

    // 4. Jika ada perubahan atau cache belum ada, ambil data penuh dari Sanity
    const fullData = await client.fetch(query);
    if (!fullData) {
      if (cachedData !== null) return cachedData;
      return fallbackValue;
    }

    const transformed = transformFn(fullData);

    // Perbarui cache data dan metadata map di localStorage
    setCachedEntity(cacheKey, transformed);
    
    const updatedMap = { ...localMap, ...remoteMap };
    setLocalMetadataMap(updatedMap);

    return transformed;
  } catch (err) {
    console.warn("Smart cache fetch failed, falling back to local cache or default", err);
    const cachedData = getCachedEntity<T>(cacheKey);
    if (cachedData !== null) return cachedData;
    return fallbackValue;
  }
}

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function initSupabaseStorageAndDb(serverSupabase: any) {
  try {
    const { data: buckets } = await serverSupabase.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.name === "face-snapshots");

    if (!bucketExists) {
      await serverSupabase.storage.createBucket("face-snapshots", {
        public: true,
      });
    }
  } catch (err) {
    console.error("Error initializing bucket:", err);
  }
}

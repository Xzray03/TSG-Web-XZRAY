import crypto from "crypto";
import { headers } from "next/headers";
import { db } from "./db";
import { requireSecret } from "./secrets";

export async function clientIpHash(): Promise<string> {
  let ip = "unknown";
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  } catch {}
  return crypto.createHmac("sha256", requireSecret("SESSION_SECRET")).update(`ip|${ip}`).digest("hex").slice(0, 32);
}

export async function userAgent(): Promise<string> {
  try {
    return ((await headers()).get("user-agent") || "").slice(0, 300);
  } catch {
    return "";
  }
}

type Policy = { max: number; windowSec: number; lockSec: number };

/** Cek apakah key sedang terkunci. Tidak menambah hitungan. */
export async function isLocked(key: string): Promise<{ locked: boolean; retryAfterSec: number }> {
  const { data } = await db().from("auth_attempts").select("*").eq("key", key).maybeSingle();
  if (data?.locked_until) {
    const ms = new Date(data.locked_until).getTime() - Date.now();
    if (ms > 0) return { locked: true, retryAfterSec: Math.ceil(ms / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

/** Catat satu kegagalan; kunci bila melewati batas. */
export async function recordFailure(key: string, p: Policy): Promise<void> {
  const supabase = db();
  const now = Date.now();
  const { data } = await supabase.from("auth_attempts").select("*").eq("key", key).maybeSingle();
  let count = 1;
  let windowStart = new Date(now).toISOString();
  if (data && new Date(data.window_start).getTime() + p.windowSec * 1000 > now) {
    count = (data.count || 0) + 1;
    windowStart = data.window_start;
  }
  const lockedUntil = count >= p.max ? new Date(now + p.lockSec * 1000).toISOString() : null;
  await supabase
    .from("auth_attempts")
    .upsert({ key, count, window_start: windowStart, locked_until: lockedUntil });
}

export async function clearFailures(key: string): Promise<void> {
  await db().from("auth_attempts").delete().eq("key", key);
}

/** Pembatas sederhana untuk aksi yang dihitung setiap panggilan (mis. kirim email). */
export async function hit(key: string, p: Policy): Promise<boolean> {
  const l = await isLocked(key);
  if (l.locked) return false;
  await recordFailure(key, p);
  const l2 = await isLocked(key);
  return !l2.locked;
}

export const LOGIN_POLICY: Policy = { max: 5, windowSec: 900, lockSec: 900 };
export const IP_POLICY: Policy = { max: 30, windowSec: 900, lockSec: 900 };
export const EMAIL_POLICY: Policy = { max: 5, windowSec: 3600, lockSec: 3600 };
// Polling tiap ~3 detik selama <= 15 menit; batas longgar agar pengguna sah tidak terkunci.
export const POLL_POLICY: Policy = { max: 400, windowSec: 600, lockSec: 60 };

export async function audit(userId: string | null, event: string, meta: Record<string, any> = {}): Promise<void> {
  try {
    await db().from("auth_audit").insert({
      user_id: userId,
      event,
      ip_hash: await clientIpHash(),
      ua: await userAgent(),
      meta,
    });
  } catch {}
}

import { cookies } from "next/headers";
import { db } from "./db";
import { AuthError, randomToken, tokenHash } from "./secrets";
import { clientIpHash, userAgent } from "./rateLimit";

const PROD = process.env.NODE_ENV === "production";
// Prefiks __Host- mewajibkan Secure + Path=/ + tanpa Domain (hanya di production/HTTPS).
export const SESSION_COOKIE = PROD ? "__Host-tsg_sid" : "tsg_sid";
export const LOGIN_COOKIE = PROD ? "__Host-tsg_lg" : "tsg_lg";

export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000; // 12 jam tanpa aktivitas
export const SESSION_ABS_MS = 7 * 24 * 60 * 60 * 1000; // maksimal 7 hari
export const MAX_SESSIONS_PER_USER = 5;

const cookieBase = {
  httpOnly: true,
  secure: PROD,
  sameSite: "strict" as const,
  path: "/",
};

export type SessionCtx = { sessionId: string; userId: string; deviceId: string };

export async function createSession(userId: string, deviceId: string): Promise<void> {
  const supabase = db();
  const token = randomToken(32);
  const now = Date.now();

  // Batasi jumlah sesi aktif per akun: cabut yang paling lama.
  const { data: active } = await supabase
    .from("auth_sessions")
    .select("id, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date(now).toISOString())
    .order("created_at", { ascending: true });
  if (active && active.length >= MAX_SESSIONS_PER_USER) {
    const toRevoke = active.slice(0, active.length - MAX_SESSIONS_PER_USER + 1).map((s) => s.id);
    await supabase.from("auth_sessions").update({ revoked_at: new Date(now).toISOString() }).in("id", toRevoke);
  }

  const { error } = await supabase.from("auth_sessions").insert({
    token_hash: tokenHash(token),
    user_id: userId,
    device_id: deviceId,
    expires_at: new Date(now + SESSION_ABS_MS).toISOString(),
    last_seen_at: new Date(now).toISOString(),
    ip_hash: await clientIpHash(),
    ua: await userAgent(),
  });
  if (error) throw new AuthError("Gagal membuat sesi.", "SESSION_ERROR");

  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, maxAge: Math.floor(SESSION_ABS_MS / 1000) });
}

export async function getSession(): Promise<SessionCtx | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token || token.length < 20 || token.length > 100) return null;

  const supabase = db();
  const { data: row } = await supabase
    .from("auth_sessions")
    .select("id, user_id, device_id, expires_at, last_seen_at, revoked_at")
    .eq("token_hash", tokenHash(token))
    .maybeSingle();
  if (!row || row.revoked_at) return null;

  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) return null;
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (now - lastSeen > SESSION_IDLE_MS) return null;

  // Pastikan akun & perangkat masih sah.
  const { data: dev } = await supabase
    .from("auth_devices")
    .select("status")
    .eq("user_id", row.user_id)
    .eq("id", row.device_id)
    .maybeSingle();
  if (!dev || dev.status !== "active") return null;

  if (now - lastSeen > 60 * 1000) {
    await supabase.from("auth_sessions").update({ last_seen_at: new Date(now).toISOString() }).eq("id", row.id);
  }
  return { sessionId: row.id, userId: row.user_id, deviceId: row.device_id };
}

export async function requireSession(): Promise<SessionCtx> {
  const s = await getSession();
  if (!s) throw new AuthError("Sesi tidak valid atau telah berakhir. Silakan login kembali.");
  return s;
}

export async function revokeCurrentSession(): Promise<void> {
  try {
    const c = await cookies();
    const token = c.get(SESSION_COOKIE)?.value;
    if (token) {
      await db()
        .from("auth_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", tokenHash(token));
    }
    c.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
  } catch {}
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  let q = db().from("auth_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
  if (exceptSessionId) q = q.neq("id", exceptSessionId);
  await q;
}

/* ---------- Cookie percobaan login (terikat ke browser yang memulai) ---------- */

export async function setLoginCookie(token: string): Promise<void> {
  (await cookies()).set(LOGIN_COOKIE, token, { ...cookieBase, maxAge: 15 * 60 });
}
export async function getLoginCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(LOGIN_COOKIE)?.value;
  } catch {
    return undefined;
  }
}
export async function clearLoginCookie(): Promise<void> {
  try {
    (await cookies()).set(LOGIN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  } catch {}
}

/** Bungkus action: ubah AuthError menjadi respons yang bisa dibaca klien. */
export async function guarded<T>(fn: () => Promise<T>): Promise<T | { error: string; code: string }> {
  try {
    return await fn();
  } catch (e: any) {
    if (e instanceof AuthError) return { error: e.message, code: e.code };
    console.error("Action error:", e?.message || e);
    return { error: "Terjadi kesalahan pada server.", code: "SERVER_ERROR" };
  }
}

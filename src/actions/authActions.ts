"use server";

import crypto from "crypto";
import { db } from "@/lib/server/db";
import { AuthError, GENERIC_AUTH_ERROR, randomToken, tokenHash } from "@/lib/server/secrets";
import { hashPassword, verifyPassword, dummyVerify, passwordPolicyError } from "@/lib/server/password";
import {
  IP_POLICY,
  LOGIN_POLICY,
  EMAIL_POLICY,
  POLL_POLICY,
  TOTP_POLICY,
  audit,
  clearFailures,
  clientIpHash,
  hit,
  isLocked,
  recordFailure,
} from "@/lib/server/rateLimit";
import {
  clearLoginCookie,
  createSession,
  getLoginCookie,
  getSession,
  guarded,
  requireSession,
  revokeAllSessions,
  revokeCurrentSession,
  setLoginCookie,
} from "@/lib/server/session";
import {
  DeviceProof,
  deviceIdOf,
  issueNonce,
  proofMessage,
  requireDeviceProof,
  validPublicJwk,
  verifySignature,
} from "@/lib/server/deviceProof";
import {
  AccountRow,
  authMethodOf,
  authUserByEmail,
  cleanNameInput,
  findAccountById,
  findAccountByName,
  hasFaceOf,
  isValidEmail,
  lightProfile,
  lookupRoster,
  photoHashOf,
} from "@/lib/server/account";
import {
  decryptTemplate,
  encryptTemplate,
  legacyAnchor,
  matchFace,
  validateVectors,
} from "@/lib/server/faceTemplate";
import {
  base32Encode,
  consumeRecoveryCode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  markTotpWindowUsed,
  normalizeRecoveryCode,
  otpauthUrl,
  totpActiveOf,
  verifyTotpWindow,
  verifyUserTotpCode,
} from "@/lib/server/totp";

/* ============================ utilitas internal ============================ */

const PRIMARY_OFFLINE_MS = 10 * 60 * 1000;
const FRESH_SESSION_MS = 5 * 60 * 1000;
const DEVICE_ID_RE = /^[A-Za-z0-9_.-]{8,64}$/;

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `${user[0] || "*"}*@${domain}`;
  return `${user[0]}${"*".repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}

function minutes(sec: number) {
  return Math.max(1, Math.ceil(sec / 60));
}

async function lockedMessage(keys: string[]): Promise<string | null> {
  for (const k of keys) {
    const l = await isLocked(k);
    if (l.locked) return `Terlalu banyak percobaan. Coba lagi dalam ${minutes(l.retryAfterSec)} menit.`;
  }
  return null;
}

function deviceInfoOf(info: any) {
  const s = (v: any, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  return {
    userAgent: s(info?.userAgent, 300),
    platform: s(info?.platform, 60),
    language: s(info?.language, 30),
    screen: s(info?.screen, 20),
  };
}

type LoginRow = {
  id: string;
  user_id: string;
  required: { password: boolean; face: boolean; email: boolean; totp: boolean };
  done: Record<string, boolean>;
  nonce: string;
  device_id: string | null;
  email_started_at: string | null;
  expires_at: string;
  completed_at: string | null;
};

async function currentLogin(): Promise<LoginRow> {
  const token = await getLoginCookie();
  if (!token) throw new AuthError("Proses login tidak ditemukan. Mulai ulang login.", "LOGIN_EXPIRED");
  const { data } = await db().from("auth_logins").select("*").eq("token_hash", tokenHash(token)).maybeSingle();
  if (!data || data.completed_at || new Date(data.expires_at).getTime() < Date.now()) {
    throw new AuthError("Proses login kedaluwarsa. Mulai ulang login.", "LOGIN_EXPIRED");
  }
  return data as LoginRow;
}

async function markDone(login: LoginRow, step: "password" | "face" | "email" | "totp") {
  await db()
    .from("auth_logins")
    .update({ done: { ...(login.done || {}), [step]: true } })
    .eq("id", login.id);
}

function requiredStepsFor(acc: AccountRow) {
  const hasPassword = Boolean(acc.password_hash);
  const hasFace = hasFaceOf(acc);
  const prefs = acc.login_preferences || { password: hasPassword, face: hasFace, email: false, totp: false };
  let password = hasPassword && prefs.password !== false;
  let face = hasFace && prefs.face !== false;
  if (!password && !face) {
    // Tidak boleh ada akun yang bisa login tanpa faktor utama.
    if (hasPassword) password = true;
    else if (hasFace) face = true;
  }
  const email = Boolean(acc.email_verified && acc.email && prefs.email === true);
  const totp = Boolean(acc.totp_verified && prefs.totp === true);
  return { password, face, email, totp };
}

async function startLogin(acc: AccountRow, initialDone: Record<string, boolean> = {}) {
  const token = randomToken(32);
  const nonce = randomToken(24);
  const required = requiredStepsFor(acc);
  const { data, error } = await db()
    .from("auth_logins")
    .insert({
      token_hash: tokenHash(token),
      user_id: acc.id,
      required,
      done: initialDone,
      nonce,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ip_hash: await clientIpHash(),
    })
    .select("id")
    .single();
  if (error || !data) throw new AuthError("Gagal memulai proses login.", "SERVER_ERROR");
  await setLoginCookie(token);
  return { loginId: data.id as string, nonce, required };
}

/** Muat template wajah; migrasi malas dari kolom lama (patokan = entri pendaftaran paling lama). */
async function loadFaceTemplate(acc: AccountRow): Promise<number[][] | null> {
  if (acc.face_template) {
    try {
      return decryptTemplate(acc.face_template, acc.id);
    } catch {
      return null;
    }
  }
  const anchor = legacyAnchor(acc.face_vectors);
  if (!anchor) return null;
  const four = validateVectors(anchor.length === 4 ? anchor : [anchor[0], anchor[0], anchor[0], anchor[0]]);
  if (!four) return null;
  await db()
    .from("user_accounts")
    .update({ face_template: encryptTemplate(four, acc.id), face_enrolled_at: new Date().toISOString(), face_vectors: null })
    .eq("id", acc.id)
    .is("face_template", null);
  return four;
}

async function refreshFromRoster(acc: AccountRow): Promise<AccountRow> {
  if (!acc.is_tsg_member) return acc;
  const roster = await lookupRoster(acc.name);
  if (!roster) return acc;
  const updates: any = {};
  if (roster.categoryName && roster.categoryName !== acc.generation) updates.generation = roster.categoryName;
  if (!acc.photo && roster.photo) updates.photo = roster.photo;
  if (!acc.email && roster.email) {
    updates.email = roster.email.toLowerCase();
    updates.email_verified = true; // roster dikurasi pengurus
  }
  if (Object.keys(updates).length === 0) return acc;
  updates.updated_at = new Date().toISOString();
  await db().from("user_accounts").update(updates).eq("id", acc.id);
  return { ...acc, ...updates };
}

async function completeLogin(login: LoginRow, deviceId: string) {
  const { data: claimed } = await db()
    .from("auth_logins")
    .update({ completed_at: new Date().toISOString(), device_id: deviceId })
    .eq("id", login.id)
    .is("completed_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) throw new AuthError("Proses login sudah selesai.", "LOGIN_EXPIRED");

  let acc = await findAccountById(login.user_id);
  if (!acc) throw new AuthError("Akun tidak ditemukan.", "LOGIN_EXPIRED");
  try {
    acc = await refreshFromRoster(acc);
  } catch {}
  await createSession(acc.id, deviceId);
  await clearLoginCookie();
  await audit(acc.id, "login_ok", { device: deviceId.slice(0, 8) });
  return { status: "ok" as const, profile: lightProfile(acc) };
}

function ctxOf(s: { userId: string; sessionId: string; deviceId: string }) {
  return { userId: s.userId, sessionId: s.sessionId, deviceId: s.deviceId };
}

async function requireFreshSession(sessionId: string) {
  const { data } = await db().from("auth_sessions").select("created_at").eq("id", sessionId).maybeSingle();
  if (!data || Date.now() - new Date(data.created_at).getTime() > FRESH_SESSION_MS) {
    throw new AuthError("Demi keamanan, login ulang terlebih dahulu lalu coba lagi dalam 5 menit.", "FRESH_LOGIN_REQUIRED");
  }
}

async function checkPasswordForAction(acc: AccountRow, password: any) {
  if (typeof password !== "string" || password.length === 0 || password.length > 200) {
    throw new AuthError("Password wajib diisi.", "PASSWORD_REQUIRED");
  }
  const keys = [`pw:${acc.id}`, `ip:${await clientIpHash()}`];
  const msg = await lockedMessage(keys);
  if (msg) throw new AuthError(msg, "LOCKED");
  const res = await verifyPassword(password, acc.password_hash || "");
  if (!res.ok) {
    await recordFailure(keys[0], LOGIN_POLICY);
    await recordFailure(keys[1], IP_POLICY);
    await audit(acc.id, "sensitive_password_fail");
    throw new AuthError("Password tidak sesuai.", "PASSWORD_INVALID");
  }
  await clearFailures(keys[0]);
}

/* ============================ info akun publik ============================ */

/** Info publik sebelum login. TIDAK mengirim id akun, email, vektor wajah, atau hash apa pun. */
export async function checkAccountAction(name: string) {
  return guarded(async () => {
    const n = cleanNameInput(name);
    if (!n) return { error: "Nama wajib diisi" };
    const ipKey = `chk:${await clientIpHash()}`;
    if (!(await hit(ipKey, { max: 90, windowSec: 600, lockSec: 300 }))) {
      return { error: "Terlalu banyak permintaan. Coba lagi sebentar." };
    }

    const roster = await lookupRoster(n);
    const tsgInfo = roster
      ? { name: roster.name, categoryName: roster.categoryName, photo: roster.photo }
      : null;
    const acc = await findAccountByName(n);

    if (!acc) {
      return {
        exists: false,
        authMethod: null,
        isTsgMember: Boolean(roster),
        tsgInfo,
        generation: roster?.categoryName || "",
        photo: roster?.photo || "",
        loginPreferences: { password: true, face: false, email: false },
      };
    }

    const hasPassword = Boolean(acc.password_hash);
    const hasFace = hasFaceOf(acc);
    const generation = acc.generation || roster?.categoryName || "";
    const photo = acc.photo || roster?.photo || "";
    return {
      exists: true,
      authMethod: authMethodOf(acc),
      hasPassword,
      hasFace,
      hasEmail: Boolean(acc.email),
      generation,
      photo,
      createdAt: acc.created_at,
      isTsgMember: Boolean(acc.is_tsg_member) || Boolean(roster),
      tsgInfo: roster
        ? { ...tsgInfo, categoryName: generation || roster.categoryName, photo: photo || roster.photo }
        : { name: acc.name, categoryName: generation, photo },
      loginPreferences: acc.login_preferences || { password: hasPassword, face: hasFace, email: false },
    };
  });
}

/* ============================ pendaftaran ============================ */

export async function registerAccountAction(body: {
  name: string;
  password: string;
  claimTsgMember?: boolean;
  verifDeviceId?: string;
}) {
  return guarded(async () => {
    const n = cleanNameInput(body?.name);
    if (!n) return { error: "Nama tidak valid." };
    const ip = await clientIpHash();
    if (!(await hit(`reg:${ip}`, { max: 5, windowSec: 3600, lockSec: 3600 }))) {
      return { error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." };
    }

    const policyErr = passwordPolicyError(body?.password);
    if (policyErr) return { error: policyErr };

    if (await findAccountByName(n)) return { error: "Nama sudah terdaftar. Silakan login." };

    let isMember = false;
    let generation: string | null = null;
    let email: string | null = null;
    let photo: string | null = null;

    if (body?.claimTsgMember) {
      const roster = await lookupRoster(n);
      if (!roster) return { error: "Nama tidak ditemukan di daftar anggota TSG." };
      const devId = typeof body.verifDeviceId === "string" && DEVICE_ID_RE.test(body.verifDeviceId) ? body.verifDeviceId : "";
      if (!devId) return { error: "Verifikasi anggota TSG belum disetujui." };
      const { data: ver } = await db()
        .from("tsg_member_verifications")
        .select("id")
        .ilike("name", n.replace(/[\\%_]/g, (c) => `\\${c}`))
        .eq("status", "approved")
        .eq("device_id", devId)
        .limit(1);
      if (!ver || ver.length === 0) return { error: "Verifikasi anggota TSG belum disetujui oleh Creator." };
      isMember = true;
      generation = roster.categoryName || null;
      email = roster.email ? roster.email.toLowerCase() : null;
      photo = roster.photo || null;
    }

    const now = new Date().toISOString();
    const { data: inserted, error } = await db()
      .from("user_accounts")
      .insert({
        name: n,
        password_hash: await hashPassword(body.password),
        auth_method: "password",
        is_tsg_member: isMember,
        email,
        email_verified: Boolean(email),
        generation,
        photo,
        login_preferences: { password: true, face: false, email: false },
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error || !inserted) {
      if (error?.code === "23505") return { error: "Nama sudah terdaftar. Silakan login." };
      return { error: "Gagal membuat akun." };
    }

    await audit(inserted.id, "register_ok");
    const login = await startLogin(inserted as AccountRow, { password: true });
    return { success: true, loginId: login.loginId, nonce: login.nonce, required: login.required };
  });
}

/* ============================ alur login ============================ */

export async function beginLoginAction(name: string) {
  return guarded(async () => {
    const n = cleanNameInput(name);
    if (!n) return { error: GENERIC_AUTH_ERROR };
    const ip = await clientIpHash();
    if (!(await hit(`lb:${ip}`, { max: 40, windowSec: 900, lockSec: 900 }))) {
      return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
    }
    const acc = await findAccountByName(n);
    if (!acc) return { error: GENERIC_AUTH_ERROR };
    const locked = await lockedMessage([`pw:${acc.id}`, `face:${acc.id}`, `ip:${ip}`]);
    if (locked) return { error: locked };

    const login = await startLogin(acc);
    return {
      success: true,
      loginId: login.loginId,
      nonce: login.nonce,
      required: login.required,
      hasPassword: Boolean(acc.password_hash),
      hasFace: hasFaceOf(acc),
      emailMasked: login.required.email ? maskEmail(acc.email || "") : "",
    };
  });
}

export async function loginPasswordAction(password: string) {
  return guarded(async () => {
    const login = await currentLogin();
    if (!login.required.password) return { error: "Langkah ini tidak diperlukan." };
    if (login.done.password) return { success: true };
    if (typeof password !== "string" || password.length === 0 || password.length > 200) {
      return { error: "Password wajib diisi" };
    }
    const ip = await clientIpHash();
    const keys = [`pw:${login.user_id}`, `ip:${ip}`];
    const locked = await lockedMessage(keys);
    if (locked) return { error: locked };

    const acc = await findAccountById(login.user_id);
    if (!acc || !acc.password_hash) {
      await dummyVerify();
      return { error: GENERIC_AUTH_ERROR };
    }
    const res = await verifyPassword(password, acc.password_hash);
    if (!res.ok) {
      await recordFailure(keys[0], LOGIN_POLICY);
      await recordFailure(keys[1], IP_POLICY);
      await audit(acc.id, "login_password_fail");
      return { error: "Password salah. Silakan coba lagi." };
    }
    if (res.needsUpgrade) {
      await db().from("user_accounts").update({ password_hash: await hashPassword(password) }).eq("id", acc.id);
    }
    await clearFailures(keys[0]);
    await markDone(login, "password");
    return { success: true };
  });
}

export async function loginFaceAction(faceVectors: number[][]) {
  return guarded(async () => {
    const login = await currentLogin();
    if (!login.required.face) return { error: "Langkah ini tidak diperlukan." };
    if (login.done.face) return { success: true };
    const vectors = validateVectors(faceVectors);
    if (!vectors) return { error: "Data wajah tidak valid." };

    const ip = await clientIpHash();
    const keys = [`face:${login.user_id}`, `ip:${ip}`];
    const locked = await lockedMessage(keys);
    if (locked) return { error: locked };

    const acc = await findAccountById(login.user_id);
    const template = acc ? await loadFaceTemplate(acc) : null;
    // Server TIDAK pernah mengembalikan jarak/skor: hanya lolos atau gagal.
    if (!acc || !template || !matchFace(template, vectors)) {
      await recordFailure(keys[0], LOGIN_POLICY);
      await recordFailure(keys[1], IP_POLICY);
      await audit(login.user_id, "login_face_fail");
      return { error: "Verifikasi Wajah Gagal: Wajah tidak cocok dengan patokan pendaftaran utama." };
    }
    await clearFailures(keys[0]);
    await markDone(login, "face");
    return { success: true };
  });
}

async function sendMagicLink(email: string) {
  const { error } = await db().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  return error;
}

export async function sendLoginEmailAction() {
  return guarded(async () => {
    const login = await currentLogin();
    if (!login.required.email) return { error: "Langkah ini tidak diperlukan." };
    if (login.done.email) return { success: true };
    const acc = await findAccountById(login.user_id);
    if (!acc || !acc.email || !acc.email_verified) return { error: "Email akun tidak tersedia." };

    const ip = await clientIpHash();
    if (!(await hit(`mail:${login.user_id}`, EMAIL_POLICY)) || !(await hit(`mailip:${ip}`, { max: 15, windowSec: 3600, lockSec: 3600 }))) {
      return { error: "Terlalu banyak permintaan email. Coba lagi nanti." };
    }
    const err = await sendMagicLink(acc.email);
    if (err) return { error: "Gagal mengirimkan tautan konfirmasi." };
    await db().from("auth_logins").update({ email_started_at: new Date().toISOString() }).eq("id", login.id);
    return { success: true, message: "Tautan konfirmasi berhasil dikirimkan." };
  });
}

export async function checkLoginEmailAction() {
  return guarded(async () => {
    const login = await currentLogin();
    if (login.done.email) return { confirmed: true };
    if (!login.required.email || !login.email_started_at) return { confirmed: false };
    if (!(await hit(`poll:${login.id}`, POLL_POLICY))) return { confirmed: false };
    const acc = await findAccountById(login.user_id);
    if (!acc?.email) return { confirmed: false };
    const au = await authUserByEmail(acc.email);
    // Bukti SEGAR: tautan harus diklik SETELAH permintaan email ini dimulai.
    if (au?.lastSignInAt && au.lastSignInAt > new Date(login.email_started_at).getTime()) {
      await markDone(login, "email");
      return { confirmed: true };
    }
    return { confirmed: false };
  });
}

export async function finishLoginAction(body: { devicePublicJwk: any; signature: string; deviceInfo?: any }) {
  return guarded(async () => {
    const login = await currentLogin();
    for (const step of ["password", "face", "email", "totp"] as const) {
      if (login.required[step] && !login.done[step]) return { error: "Langkah verifikasi belum lengkap." };
    }
    if (!validPublicJwk(body?.devicePublicJwk) || typeof body?.signature !== "string") {
      return { error: "Data perangkat tidak valid." };
    }
    // Bukti kepemilikan kunci perangkat atas nonce dari server.
    if (!verifySignature(body.devicePublicJwk, proofMessage("login", login.nonce, login.id), body.signature)) {
      return { error: "Verifikasi perangkat gagal." };
    }

    const deviceId = deviceIdOf(body.devicePublicJwk);
    const supabase = db();
    const info = deviceInfoOf(body.deviceInfo);
    const { data: devices } = await supabase
      .from("auth_devices")
      .select("*")
      .eq("user_id", login.user_id)
      .order("created_at", { ascending: true });
    const actives = (devices || []).filter((d: any) => d.status === "active");
    const mine = (devices || []).find((d: any) => d.id === deviceId);

    if (mine?.status === "active") {
      await supabase.from("auth_devices").update({ last_seen_at: new Date().toISOString() }).eq("user_id", login.user_id).eq("id", deviceId);
      return await completeLogin(login, deviceId);
    }
    if (mine?.status === "revoked") return { error: "Perangkat ini diblokir untuk akun tersebut." };

    if (actives.length === 0) {
      // Perangkat pertama menjadi perangkat utama.
      await supabase.from("auth_devices").upsert({
        user_id: login.user_id,
        id: deviceId,
        public_key: body.devicePublicJwk,
        info,
        is_primary: true,
        status: "active",
        last_seen_at: new Date().toISOString(),
      });
      return await completeLogin(login, deviceId);
    }

    const primary = actives.find((d: any) => d.is_primary) || actives[0];
    if (Date.now() - new Date(primary.last_seen_at).getTime() > PRIMARY_OFFLINE_MS) {
      return {
        error: "Perangkat utama sedang offline (tidak aktif). Perangkat utama wajib online untuk memberikan persetujuan login.",
      };
    }
    await supabase.from("auth_devices").upsert({
      user_id: login.user_id,
      id: deviceId,
      public_key: body.devicePublicJwk,
      info,
      is_primary: false,
      status: "pending",
      last_seen_at: new Date().toISOString(),
    });
    await supabase.from("auth_logins").update({ device_id: deviceId }).eq("id", login.id);
    await audit(login.user_id, "device_request", { device: deviceId.slice(0, 8) });
    return { status: "waiting" as const, message: "Menunggu persetujuan dari perangkat utama..." };
  });
}

export async function pollDeviceApprovalAction() {
  return guarded(async () => {
    const login = await currentLogin();
    if (!login.device_id) return { error: "Tidak ada permintaan perangkat." };
    if (!(await hit(`poll:${login.id}`, POLL_POLICY))) return { status: "waiting" as const };
    const { data: dev } = await db()
      .from("auth_devices")
      .select("status")
      .eq("user_id", login.user_id)
      .eq("id", login.device_id)
      .maybeSingle();
    if (!dev) return { error: "Permintaan perangkat tidak ditemukan." };
    if (dev.status === "rejected" || dev.status === "revoked") return { status: "rejected" as const };
    if (dev.status !== "active") return { status: "waiting" as const };
    return await completeLogin(login, login.device_id);
  });
}

/* ============================ sesi ============================ */

export async function getSessionAction() {
  return guarded(async () => {
    const s = await getSession();
    if (!s) return { authenticated: false };
    const acc = await findAccountById(s.userId);
    if (!acc) return { authenticated: false };
    return { authenticated: true, profile: lightProfile(acc) };
  });
}

/** Data akun lengkap milik sendiri (termasuk foto & email). */
export async function getMyAccountAction() {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    const hasPassword = Boolean(acc.password_hash);
    const hasFace = hasFaceOf(acc);
    const hasTotp = Boolean(acc.totp_verified && (acc.login_preferences as any)?.totp === true);
    const recoveryCount = Array.isArray(acc.recovery_codes_hash) ? acc.recovery_codes_hash.length : 0;
    return {
      ...lightProfile(acc),
      photo: acc.photo || "",
      hasPassword,
      hasFace,
      hasTotp,
      totpVerified: Boolean(acc.totp_verified),
      recoveryCodesRemaining: recoveryCount,
      loginPreferences: acc.login_preferences || { password: hasPassword, face: hasFace, email: false, totp: hasTotp },
    };
  });
}

export async function logoutAction() {
  await revokeCurrentSession();
  return { success: true };
}

/* ============================ pengelolaan akun (butuh sesi) ============================ */

export async function updateProfileAction(body: { newName?: string; photo?: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    const updates: any = { updated_at: new Date().toISOString() };

    if (typeof body?.newName === "string" && body.newName.trim() && body.newName.trim() !== acc.name) {
      const n = cleanNameInput(body.newName);
      if (!n) return { error: "Nama tidak valid." };
      const other = await findAccountByName(n);
      if (other && other.id !== acc.id) return { error: "Nama sudah dipakai akun lain." };
      updates.name = n;
    }
    if (typeof body?.photo === "string" && body.photo.trim()) {
      const p = body.photo.trim();
      const okPhoto = (p.startsWith("data:image/") && p.length <= 3_000_000) || (/^https:\/\//.test(p) && p.length <= 2000);
      if (!okPhoto) return { error: "Format foto tidak valid." };
      updates.photo = p;
    }
    // `generation`, `is_tsg_member`, dan peran TIDAK bisa diubah klien (hanya dari roster di server).
    const { error } = await db().from("user_accounts").update(updates).eq("id", acc.id);
    if (error) return { error: "Gagal memperbarui profil." };
    return {
      success: true,
      message: "Profil berhasil diperbarui.",
      profile: { id: acc.id, name: updates.name || acc.name, generation: acc.generation || "", photo: updates.photo ?? acc.photo },
    };
  });
}

export async function updateLoginPreferencesAction(preferences: any) {
  return guarded(async () => {
    const s = await requireSession();
    if (!preferences || typeof preferences !== "object") return { error: "Preferensi login tidak valid." };
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    const hasPass = Boolean(acc.password_hash);
    const hasFc = hasFaceOf(acc);
    if (hasPass && hasFc && !preferences.password && !preferences.face) {
      return { error: "Minimal harus mencentang salah satu antara verifikasi password atau verifikasi wajah." };
    }
    const newPrefs = {
      password: hasPass ? Boolean(preferences.password) : false,
      face: hasFc ? Boolean(preferences.face) : false,
      email: Boolean(preferences.email) && Boolean(acc.email) && Boolean(acc.email_verified),
      totp: Boolean(acc.totp_verified) && Boolean(preferences.totp),
    };
    if (!newPrefs.password && !newPrefs.face) {
      if (hasPass) newPrefs.password = true;
      else if (hasFc) newPrefs.face = true;
    }
    // Perubahan apapun pada preferensi login saat 2FA aktif wajib gate TOTP.
    const totpActive = totpActiveOf(acc);
    const prefsChanged =
      newPrefs.password !== (acc.login_preferences?.password ?? hasPass) ||
      newPrefs.face !== (acc.login_preferences?.face ?? hasFc) ||
      newPrefs.email !== (acc.login_preferences?.email ?? false) ||
      newPrefs.totp !== (acc.login_preferences?.totp ?? false);
    if (prefsChanged && totpActive) {
      const totpCode = (preferences as any)?.totpCode;
      await checkTotpForAction(acc, totpCode);
    }
    await db().from("user_accounts").update({ login_preferences: newPrefs, updated_at: new Date().toISOString() }).eq("id", acc.id);
    return { success: true, message: "Preferensi login berhasil disimpan." };
  });
}

/* ============================ 2FA TOTP ============================ */

const ROTATE_TTL_MS = 30 * 1000;
const ENROLL_TTL_MS = 15 * 60 * 1000;

async function checkTotpForAction(acc: AccountRow, code: any) {
  if (!code) throw new AuthError("Kode 2FA diperlukan untuk melanjutkan.", "TOTP_REQUIRED");
  const keys = [`totp:${acc.id}`, `ip:${await clientIpHash()}`];
  const msg = await lockedMessage(keys);
  if (msg) throw new AuthError(msg, "LOCKED");
  const res = await verifyUserTotpCode(acc, code);
  if (!res.ok) {
    await recordFailure(keys[0], TOTP_POLICY);
    await recordFailure(keys[1], IP_POLICY);
    await audit(acc.id, "totp_rejected", { reason: "invalid_code" });
    throw new AuthError("Kode 2FA tidak valid.", "TOTP_INVALID");
  }
  if (res.window !== undefined) {
    await markTotpWindowUsed(acc.id, res.window);
  }
  if (res.recoveryHash) {
    await consumeRecoveryCode(acc.id, res.recoveryHash);
    await audit(acc.id, "recovery_used", { remaining: 0 });
  }
  await clearFailures(keys[0]);
  return { window: res.window, recovery: !!res.recoveryHash };
}

/** Mulai enrollment TOTP — butuh sesi valid, password/face + device proof. Tolak bila sudah terverifikasi. */
export async function enableTotpStartAction(body: { password?: string; proof: DeviceProof }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (acc.totp_verified) {
      await audit(acc.id, "totp_rejected", { reason: "already_verified" });
      return { error: "2FA sudah diaktifkan dan tidak dapat ditambahkan ulang.", code: "TOTP_EXISTS" };
    }
    // Verifikasi step-up: password (atau face untuk akun face-only) + device proof
    if (acc.password_hash) {
      await checkPasswordForAction(acc, body?.password);
    } else if (hasFaceOf(acc)) {
      await requireFreshSession(s.sessionId);
    } else {
      return { error: "Akun tidak memiliki faktor verifikasi untuk enroll 2FA.", code: "NO_VERIFICATION_FACTOR" };
    }
    await requireDeviceProof(ctxOf(s), "enable_totp", body?.proof);

    // Generate secret baru
    const secretBytes = crypto.randomBytes(20);
    const secretBase32 = base32Encode(secretBytes);
    const encSecret = encryptTotpSecret(secretBase32, acc.id);

    await db()
      .from("user_accounts")
      .update({
        totp_secret: encSecret,
        totp_secret_issued_at: new Date().toISOString(),
        totp_verified: false,
        recovery_codes_hash: [],
        last_used_totp_window: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id);

    await audit(acc.id, "totp_enroll_start");
    return { success: true, secretBase32, otpauthUrl: otpauthUrl(acc.name, secretBase32) };
  });
}

/** Verifikasi kode TOTP pertama dan aktifkan 2FA — generate recovery codes. */
export async function verifyTotpAction(body: { code: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (acc.totp_verified) {
      return { error: "2FA sudah diaktifkan.", code: "TOTP_EXISTS" };
    }
    if (!acc.totp_secret || !acc.totp_secret_issued_at) {
      return { error: "Enrollment 2FA tidak ditemukan. Mulai ulang.", code: "TOTP_NOT_STARTED" };
    }
    // Cek batas 30 detik dari issued_at (server-side strict)
    if (Date.now() - new Date(acc.totp_secret_issued_at).getTime() > ROTATE_TTL_MS) {
      return { error: "Secret sudah kadaluarsa (30 detik). Generate ulang.", code: "TOTP_EXPIRED" };
    }
    const keys = [`totp:${acc.id}`, `ip:${await clientIpHash()}`];
    const msg = await lockedMessage(keys);
    if (msg) throw new AuthError(msg, "LOCKED");

    if (!acc.totp_secret) throw new AuthError("Secret 2FA tidak ditemukan.", "SERVER_ERROR");
    const secret = decryptTotpSecret(acc.totp_secret, acc.id);
    const w = verifyTotpWindow(secret, body?.code);
    if (w === null) {
      await recordFailure(keys[0], TOTP_POLICY);
      await recordFailure(keys[1], IP_POLICY);
      await audit(acc.id, "totp_rejected", { reason: "invalid_code" });
      return { error: "Kode TOTP tidak valid.", code: "TOTP_INVALID" };
    }

    // Berhasil: generate recovery codes & aktifkan
    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = recoveryCodes.map((c) => hashRecoveryCode(normalizeRecoveryCode(c)!, acc.id));

    await db()
      .from("user_accounts")
      .update({
        totp_verified: true,
        last_used_totp_window: Number(w),
        recovery_codes_hash: recoveryHashes,
        login_preferences: { ...(acc.login_preferences || {}), totp: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id);

    await clearFailures(keys[0]);
    await audit(acc.id, "totp_verified", { recovery_count: recoveryCodes.length });
    return { success: true, recoveryCodes };
  });
}

/** Rotasi secret otomatis saat timer 30 detik habis sebelum terverifikasi. */
export async function rotateTotpSecretAction() {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (acc.totp_verified) {
      return { error: "2FA sudah terverifikasi — tidak bisa rotasi.", code: "TOTP_VERIFIED" };
    }
    // Generate secret baru, override lama
    const secretBytes = crypto.randomBytes(20);
    const secretBase32 = base32Encode(secretBytes);
    const encSecret = encryptTotpSecret(secretBase32, acc.id);

    await db()
      .from("user_accounts")
      .update({
        totp_secret: encSecret,
        totp_secret_issued_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id);

    await audit(acc.id, "totp_rotate");
    return { success: true, secretBase32, otpauthUrl: otpauthUrl(acc.name, secretBase32) };
  });
}

/** Langkah login TOTP / recovery code (dipanggil oleh client saat login.required.totp). */
export async function loginTotpAction(body: { code: string }) {
  return guarded(async () => {
    const login = await currentLogin();
    if (!login.required.totp) return { error: "Langkah ini tidak diperlukan." };
    if (login.done.totp) return { success: true };
    const acc = await findAccountById(login.user_id);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");

    await checkTotpForAction(acc, body?.code);
    await markDone(login, "totp");
    return { success: true };
  });
}

/* ============================ aksi sensitif ============================ */

const STEPUP_PURPOSES = new Set(["delete_account", "change_password", "add_password", "set_email", "add_face", "approve_device", "enable_totp", "reset_password"]);

export async function getStepUpNonceAction(purpose: string) {
  return guarded(async () => {
    const s = await requireSession();
    if (typeof purpose !== "string" || !STEPUP_PURPOSES.has(purpose)) return { error: "Tujuan tidak valid." };
    const n = await issueNonce(s.userId, s.sessionId, purpose);
    return { ...n, purpose, userId: s.userId };
  });
}

export async function changePasswordAction(body: { oldPassword: string; newPassword: string; proof: DeviceProof; totpCode?: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (!acc.password_hash) return { error: "Akun belum memiliki password." };
    const policyErr = passwordPolicyError(body?.newPassword);
    if (policyErr) return { error: policyErr };
    await checkPasswordForAction(acc, body?.oldPassword);
    await requireDeviceProof(ctxOf(s), "change_password", body?.proof);
    // Gate TOTP
    if (totpActiveOf(acc)) {
      await checkTotpForAction(acc, body?.totpCode);
    }
    await db()
      .from("user_accounts")
      .update({ password_hash: await hashPassword(body.newPassword), updated_at: new Date().toISOString() })
      .eq("id", acc.id);
    await revokeAllSessions(acc.id, s.sessionId);
    await audit(acc.id, "password_changed");
    return { success: true, message: "Password berhasil diperbarui." };
  });
}

export async function addPasswordAction(body: { newPassword: string; proof: DeviceProof; totpCode?: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (acc.password_hash) return { error: "Akun sudah memiliki password. Gunakan ganti password." };
    const policyErr = passwordPolicyError(body?.newPassword);
    if (policyErr) return { error: policyErr };
    await requireFreshSession(s.sessionId);
    await requireDeviceProof(ctxOf(s), "add_password", body?.proof);
    // Gate TOTP
    if (totpActiveOf(acc)) {
      await checkTotpForAction(acc, body?.totpCode);
    }
    const hasFace = hasFaceOf(acc);
    const prefs = acc.login_preferences || { face: hasFace, email: false };
    await db()
      .from("user_accounts")
      .update({
        password_hash: await hashPassword(body.newPassword),
        auth_method: hasFace ? "both" : "password",
        login_preferences: { ...prefs, password: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id)
      .is("password_hash", null);
    await audit(acc.id, "password_added");
    return { success: true, message: "Password berhasil ditambahkan." };
  });
}

/**
 * Verifikasi wajah khusus alur "Lupa Password": menghasilkan token status valid 2 menit.
 * Klien hanya menerima STATUS token — vektor tidak pernah keluar dari verifikasi.
 */
export async function verifyFaceForPasswordResetAction(faceVectors: number[][]) {
  return guarded(async () => {
    const s = await getSession();
    if (!s) return { error: "Sesi tidak valid.", code: "UNAUTHENTICATED" };
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (!acc.password_hash) return { error: "Akun ini belum memiliki password." };
    if (!hasFaceOf(acc)) return { error: "Wajah tidak terdaftar pada akun ini." };

    const vectors = validateVectors(faceVectors);
    if (!vectors) return { error: "Data wajah tidak valid." };
    const template = await loadFaceTemplate(acc);
    if (!template || !matchFace(template, vectors)) {
      await audit(acc.id, "password_reset_face_failed");
      return { error: "Verifikasi Wajah Gagal: Wajah tidak cocok dengan patokan akun." };
    }

    const token = randomToken(32);
    await db().from("auth_nonces").insert({
      user_id: acc.id,
      session_id: s.sessionId,
      purpose: "password_reset_face",
      nonce_hash: tokenHash(token),
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    });

    await audit(acc.id, "password_reset_face_passed");
    return { success: true, faceVerifiedToken: token };
  });
}

/**
 * Reset password via token verifikasi wajah (alur "Lupa Password") tanpa password lama.
 * Gate: konsumsi token wajah + device proof + TOTP/recovery code bila 2FA aktif.
 */
export async function resetPasswordWithFaceAction(body: {
  faceVerifiedToken: string;
  newPassword: string;
  proof: DeviceProof;
  totpCode?: string;
}) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (!acc.password_hash) return { error: "Akun ini belum memiliki password." };
    if (!hasFaceOf(acc)) return { error: "Wajah tidak terdaftar pada akun ini." };

    const policyErr = passwordPolicyError(body?.newPassword);
    if (policyErr) return { error: policyErr };

    // 1) Konsumsi token status verifikasi wajah (sekali pakai, terikat sesi).
    if (!body?.faceVerifiedToken || typeof body.faceVerifiedToken !== "string") {
      return { error: "Verifikasi Wajah AI diperlukan untuk mereset password.", code: "FACE_REQUIRED" };
    }
    const { data: row } = await db()
      .from("auth_nonces")
      .select("id, expires_at, used_at, user_id, session_id")
      .eq("nonce_hash", tokenHash(body.faceVerifiedToken))
      .eq("purpose", "password_reset_face")
      .maybeSingle();
    if (
      !row ||
      row.used_at ||
      row.user_id !== acc.id ||
      row.session_id !== s.sessionId ||
      new Date(row.expires_at).getTime() < Date.now()
    ) {
      return { error: "Status verifikasi wajah tidak valid atau telah kedaluwarsa. Ulangi verifikasi wajah.", code: "FACE_INVALID" };
    }
    await db().from("auth_nonces").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    // 2) Bukti perangkat
    await requireDeviceProof(ctxOf(s), "reset_password", body?.proof);

    // 3) TOTP / recovery code bila 2FA aktif
    if (totpActiveOf(acc)) {
      await checkTotpForAction(acc, body?.totpCode);
    }

    const { error } = await db()
      .from("user_accounts")
      .update({ password_hash: await hashPassword(body.newPassword), updated_at: new Date().toISOString() })
      .eq("id", acc.id)
      .not("password_hash", "is", null);
    if (error) return { error: "Gagal memperbarui password." };

    // Sesi lain dicabut: hanya sesi ini yang bertahan setelah reset.
    await revokeAllSessions(acc.id, s.sessionId);
    await audit(acc.id, "password_reset_via_face");
    return { success: true, message: "Password berhasil diperbarui." };
  });
}

export async function setEmailAction(body: { email: string; password?: string; proof: DeviceProof; totpCode?: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (!isValidEmail(body?.email)) return { error: "Email tidak valid." };
    const email = body.email.trim().toLowerCase();

    if (acc.password_hash) await checkPasswordForAction(acc, body?.password);
    else await requireFreshSession(s.sessionId);
    await requireDeviceProof(ctxOf(s), "set_email", body?.proof);
    // Gate TOTP
    if (totpActiveOf(acc)) {
      await checkTotpForAction(acc, body?.totpCode);
    }

    const { data: clash } = await db().from("user_accounts").select("id").ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).neq("id", acc.id).limit(1);
    if (clash && clash.length > 0) return { error: "Email sudah dipakai akun lain." };

    const prefs = { ...(acc.login_preferences || {}), email: false };
    await db()
      .from("user_accounts")
      .update({ email, email_verified: false, email_verify_started_at: null, login_preferences: prefs, updated_at: new Date().toISOString() })
      .eq("id", acc.id);
    await audit(acc.id, "email_set");
    return { success: true, message: "Email disimpan. Verifikasi email agar bisa dipakai untuk login." };
  });
}

export async function sendEmailVerifyAction() {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc?.email) return { error: "Email belum diatur." };
    if (acc.email_verified) return { success: true, alreadyVerified: true };
    if (!(await hit(`mail:${acc.id}`, EMAIL_POLICY))) return { error: "Terlalu banyak permintaan email. Coba lagi nanti." };
    const err = await sendMagicLink(acc.email);
    if (err) return { error: "Gagal mengirimkan tautan konfirmasi." };
    await db().from("user_accounts").update({ email_verify_started_at: new Date().toISOString() }).eq("id", acc.id);
    return { success: true, message: "Tautan konfirmasi berhasil dikirimkan." };
  });
}

export async function checkEmailVerifyAction() {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc?.email) return { confirmed: false };
    if (acc.email_verified) return { confirmed: true };
    if (!acc.email_verify_started_at) return { confirmed: false };
    if (!(await hit(`poll:${s.sessionId}`, POLL_POLICY))) return { confirmed: false };
    const au = await authUserByEmail(acc.email);
    if (au?.lastSignInAt && au.lastSignInAt > new Date(acc.email_verify_started_at).getTime()) {
      await db().from("user_accounts").update({ email_verified: true, email_verify_started_at: null }).eq("id", acc.id);
      return { confirmed: true };
    }
    return { confirmed: false };
  });
}

/**
 * Daftarkan wajah. Hanya SEKALI per akun: bila sudah ada, ditolak keras (dan dicatat).
 * Tidak ada fitur ganti/hapus wajah; patokan tidak pernah berubah.
 */
export async function addFaceAction(body: { faceVectors: number[][]; password: string; proof: DeviceProof; totpCode?: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");

    if (hasFaceOf(acc)) {
      await audit(acc.id, "face_add_rejected_exists");
      return { error: "Wajah sudah terdaftar dan tidak dapat diganti atau ditambah.", code: "FACE_EXISTS" };
    }
    if (!acc.password_hash) return { error: "Buat password terlebih dahulu sebelum mendaftarkan wajah." };
    const vectors = validateVectors(body?.faceVectors);
    if (!vectors) return { error: "Data wajah tidak valid." };

    await checkPasswordForAction(acc, body?.password);
    await requireDeviceProof(ctxOf(s), "add_face", body?.proof);
    // Gate TOTP
    if (totpActiveOf(acc)) {
      await checkTotpForAction(acc, body?.totpCode);
    }

    const prefs = acc.login_preferences || { password: true, email: false };
    const { data: updated, error } = await db()
      .from("user_accounts")
      .update({
        face_template: encryptTemplate(vectors, acc.id),
        face_enrolled_at: new Date().toISOString(),
        auth_method: "both",
        login_preferences: { ...prefs, face: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", acc.id)
      .is("face_template", null)
      .select("id");
    if (error || !updated || updated.length === 0) {
      await audit(acc.id, "face_add_rejected_race");
      return { error: "Wajah sudah terdaftar dan tidak dapat diganti atau ditambah.", code: "FACE_EXISTS" };
    }
    await audit(acc.id, "face_enrolled");
    return { success: true, message: "Verifikasi wajah berhasil ditambahkan." };
  });
}

export async function deleteAccountAction(body: { password: string; proof: DeviceProof; totpCode?: string }) {
  return guarded(async () => {
    const s = await requireSession();
    const acc = await findAccountById(s.userId);
    if (!acc) throw new AuthError("Akun tidak ditemukan.");
    if (!acc.password_hash) return { error: "Buat password terlebih dahulu untuk dapat menghapus akun." };
    await checkPasswordForAction(acc, body?.password);
    await requireDeviceProof(ctxOf(s), "delete_account", body?.proof);
    // Gate TOTP
    if (totpActiveOf(acc)) {
      await checkTotpForAction(acc, body?.totpCode);
    }

    const supabase = db();
    await audit(acc.id, "account_deleted");
    // Cabut persetujuan verifikasi TSG agar nama ini tidak bisa didaftarkan ulang memakai persetujuan lama.
    await supabase
      .from("tsg_member_verifications")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .ilike("name", acc.name.replace(/[\\%_]/g, (c) => `\\${c}`))
      .eq("status", "approved");
    await supabase.from("chat_keys").delete().eq("user_id", acc.id);
    await revokeAllSessions(acc.id);
    await supabase.from("auth_nonces").delete().eq("user_id", acc.id);
    await supabase.from("auth_logins").delete().eq("user_id", acc.id);
    await supabase.from("auth_devices").delete().eq("user_id", acc.id);
    const { error } = await supabase.from("user_accounts").delete().eq("id", acc.id);
    if (error) return { error: "Gagal menghapus akun." };
    await revokeCurrentSession();
    return { success: true, message: "Akun berhasil dihapus secara permanen." };
  });
}

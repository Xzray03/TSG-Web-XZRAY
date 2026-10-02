import crypto from "crypto";
import { client as sanityClient } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import { db } from "./db";

export type AccountRow = {
  id: string;
  name: string;
  password_hash: string | null;
  face_vectors: any;
  face_template: string | null;
  auth_method: string | null;
  is_tsg_member: boolean | null;
  email: string | null;
  email_verified: boolean | null;
  email_verify_started_at: string | null;
  generation: string | null;
  photo: string | null;
  login_preferences: any;
  created_at: string;
  updated_at: string;
};

export function cleanNameInput(name: any): string | null {
  if (typeof name !== "string") return null;
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 80) return null;
  if (/[*\u0000-\u001f]/.test(n)) return null; // '*' = wildcard PostgREST; kontrol char ditolak
  return n;
}

/** Cocokkan nama secara case-insensitive TANPA wildcard (escape % _ \). */
function exactPattern(name: string): string {
  return name.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function findAccountByName(name: string): Promise<AccountRow | null> {
  const n = cleanNameInput(name);
  if (!n) return null;
  const { data } = await db().from("user_accounts").select("*").ilike("name", exactPattern(n)).limit(1);
  return (data && data[0]) || null;
}

export async function findAccountById(id: string): Promise<AccountRow | null> {
  const { data } = await db().from("user_accounts").select("*").eq("id", id).limit(1);
  return (data && data[0]) || null;
}

export const hasFaceOf = (a: AccountRow) =>
  Boolean(a.face_template) || Boolean(Array.isArray(a.face_vectors) && a.face_vectors.length > 0);

export const authMethodOf = (a: AccountRow) => {
  const p = Boolean(a.password_hash);
  const f = hasFaceOf(a);
  return p && f ? "both" : p ? "password" : f ? "face" : a.auth_method || "password";
};

export const isCreator = (a: AccountRow) => Boolean(a.is_tsg_member) && /^creator$/i.test((a.generation || "").trim());

export function photoHashOf(photo: string | null | undefined): string {
  return photo ? crypto.createHash("sha256").update(photo).digest("hex") : "";
}

/** Profil ringan (tanpa foto) yang aman dikirim ke klien setelah autentikasi. */
export function lightProfile(a: AccountRow) {
  return {
    id: a.id,
    name: a.name,
    generation: a.generation || "",
    email: a.email || "",
    emailVerified: Boolean(a.email_verified),
    isTsgMember: Boolean(a.is_tsg_member),
    authMethod: authMethodOf(a),
    createdAt: a.created_at,
    photoHash: photoHashOf(a.photo),
  };
}

export type RosterInfo = { name: string; categoryName: string; photo: string; email: string };

/**
 * Cari anggota di roster Sanity. Prioritas: nama persis (case-insensitive); bila tidak ada,
 * hanya diterima jika tepat satu kecocokan parsial (mencegah klaim ambigu).
 */
export async function lookupRoster(name: string): Promise<RosterInfo | null> {
  const n = cleanNameInput(name);
  if (!n) return null;
  try {
    const members: any[] = await sanityClient.fetch(
      `*[_type == "teamMember" && lower(name) match lower($name)] { _id, name, "categoryName": category->title, photo, email }`,
      { name: `*${n}*` }
    );
    if (!members || members.length === 0) return null;
    const exact = members.filter((m) => (m.name || "").trim().toLowerCase() === n.toLowerCase());
    const pick = exact.length > 0 ? exact[0] : members.length === 1 ? members[0] : null;
    if (!pick) return null;
    const photo = pick.photo
      ? urlForImage(pick.photo).width(400).height(400).fit("crop").crop("top").auto("format").url()
      : "";
    return { name: pick.name, categoryName: pick.categoryName || "", photo, email: pick.email || "" };
  } catch {
    return null;
  }
}

export const isValidEmail = (e: any) =>
  typeof e === "string" && e.length <= 200 && /^[^\s@,;()<>]+@[^\s@,;()<>]+\.[^\s@,;()<>]+$/.test(e.trim());

/** Cek apakah ada akun Supabase Auth untuk email + kapan terakhir login (RPC khusus service_role). */
export async function authUserByEmail(email: string): Promise<{ lastSignInAt: number | null } | null> {
  const { data, error } = await db().rpc("tsg_auth_user", { p_email: email.trim().toLowerCase() });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return { lastSignInAt: row?.last_sign_in_at ? new Date(row.last_sign_in_at).getTime() : null };
}

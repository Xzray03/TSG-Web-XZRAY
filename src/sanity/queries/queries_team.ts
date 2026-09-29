import { smartFetchWithCache } from "../cacheClient";
import { urlForImage } from "../image";
import type { TeamMember, TeamBadge, TeamCategory } from "@/types";
import type { Image } from "sanity";
import { createClient } from "@supabase/supabase-js";

interface SanityAchievementItem {
  icon: Image;
  label: string;
}

interface SanityTeamMember {
  _id: string;
  _rev?: string;
  name: string;
  fullName?: string;
  nickname?: string;
  birthDate?: string;
  role: string;
  division?: string;
  categories: string[];
  photo: Image;
  instagram?: string;
  linkedin?: string;
  email?: string;
  badge?: TeamBadge;
  achievements?: SanityAchievementItem[];
  featured: boolean;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const query = `*[_type == "teamMember"] | order(order asc) {
    _id, _rev, name, nickname, birthDate, role, division,
    "categories": categories[]->slug.current,
    photo, instagram, linkedin, email, badge, achievements, featured
  }`;

  const userAccountsMap = new Map<string, any>();
  const publicAccountsMap = new Map<string, any>();

  const serverSupabase = getSupabaseServerClient();
  if (serverSupabase) {
    try {
      const [userRes, pubRes] = await Promise.all([
        serverSupabase.from("user_accounts").select("id, name, email, photo, is_tsg_member, generation"),
        serverSupabase.from("public_accounts").select("*"),
      ]);

      if (userRes.data) {
        for (const u of userRes.data) {
          if (u.name) {
            userAccountsMap.set(u.name.trim().toLowerCase(), u);
          }
          if (u.email) {
            userAccountsMap.set(u.email.trim().toLowerCase(), u);
          }
        }
      }

      if (pubRes.data) {
        for (const p of pubRes.data) {
          if (p.real_account_id) {
            publicAccountsMap.set(p.real_account_id, p);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching Supabase data for team members:", e);
    }
  }

  return smartFetchWithCache<TeamMember[]>(
    "team_members_list",
    query,
    (data: SanityTeamMember[]) =>
      (data ?? []).map((item) => {
        const cleanName = item.name ? item.name.trim().toLowerCase() : "";
        const cleanEmail = item.email ? item.email.replace(/^mailto:/, "").trim().toLowerCase() : "";

        const userAcc = userAccountsMap.get(cleanName) || (cleanEmail ? userAccountsMap.get(cleanEmail) : null);
        const isSupabaseConnected = Boolean(userAcc);
        const pubAcc = userAcc ? publicAccountsMap.get(userAcc.id) : null;

        const supabaseNickname = pubAcc?.nickname && pubAcc.nickname.trim() ? pubAcc.nickname.trim() : null;
        const effectiveNickname = supabaseNickname || item.nickname || "";

        return {
          id: item._id,
          name: item.name,
          fullName: item.name,
          nickname: effectiveNickname,
          birthDate: item.birthDate,
          role: item.role,
          division: item.division ?? "",
          categories: item.categories ?? [],
          photo: urlForImage(item.photo).width(400).height(500).fit("crop").auto("format").url(),
          socials: {
            ...(item.instagram && { instagram: item.instagram }),
            ...(item.linkedin && { linkedin: item.linkedin }),
            ...(item.email && { email: `mailto:${item.email}` }),
          },
          badge: item.badge,
          achievements: (item.achievements ?? []).map((a) => ({
            icon: urlForImage(a.icon).width(96).height(96).fit("max").auto("format").url(),
            title: a.label,
          })),
          featured: item.featured,
          isSupabaseConnected,
          publicAccount: pubAcc ?? null,
        };
      }),
    []
  );
}

interface SanityTeamCategory {
  _id: string;
  _rev?: string;
  name: string;
  slug: { current: string };
  order: number;
}

export async function getTeamCategories(): Promise<TeamCategory[]> {
  const query = `*[_type == "teamCategory"] | order(order asc) { _id, _rev, name, slug, order }`;

  return smartFetchWithCache<TeamCategory[]>(
    "team_categories_list",
    query,
    (data: SanityTeamCategory[]) =>
      (data ?? []).map((item) => ({
        id: item._id,
        name: item.name,
        slug: item.slug?.current ?? "",
        order: item.order,
      })),
    []
  );
}
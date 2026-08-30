import { NextResponse } from "next/server";
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import { verifyApiRequest } from "@/lib/api-guard";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const category = searchParams.get("category");

  if (!name) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  }

  try {
    const query = `*[_type == "teamMember" && lower(name) match lower($name)] {
      _id,
      name,
      "categoryName": category->title,
      photo,
      email
    }`;

    const members = await client.fetch(query, { name: `*${name}*` });

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: "Anggota tim tidak ditemukan di Sanity CMS" },
        { status: 404 }
      );
    }

    let matchedMember = members[0];
    if (category) {
      const found = members.find(
        (m: any) =>
          m.categoryName &&
          m.categoryName.toLowerCase().includes(category.toLowerCase())
      );
      if (found) matchedMember = found;
    }

    // Proxy foto Sanity agar melalui server API jika di mobile (menghindari CORS)
    const rawPhotoUrl = matchedMember.photo
      ? urlForImage(matchedMember.photo)
          .width(400)
          .height(500)
          .fit("crop")
          .auto("format")
          .url()
      : "";

    const formattedMember = {
      name: matchedMember.name,
      categoryName: matchedMember.categoryName || category || "",
      photo: rawPhotoUrl,
      email: matchedMember.email || "",
    };

    return NextResponse.json({ success: true, member: formattedMember });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengambil data dari Sanity" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

  try {
    const body = await request.json();
    const { name, category, blinkSnapshot, snapshots, memberId } = body;

    if (!name) {
      return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    }

    const query = `*[_type == "teamMember" && lower(name) match lower($name)] {
      _id,
      name,
      "categoryName": category->title,
      photo,
      email
    }`;

    const members = await client.fetch(query, { name: `*${name}*` });

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: "Anggota tim tidak ditemukan di Sanity CMS" },
        { status: 404 }
      );
    }

    let matchedMember = members[0];
    if (category) {
      const found = members.find(
        (m: any) =>
          m.categoryName &&
          m.categoryName.toLowerCase().includes(category.toLowerCase())
      );
      if (found) matchedMember = found;
    }

    const memberEmailClean = matchedMember.email
      ? matchedMember.email.replace(/^mailto:/, "").trim()
      : `${matchedMember.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}@tsg-member.local`;

    const passwordPlaceholder = `TSG_Secure_${matchedMember._id || "Verified"}!2026`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (supabaseUrl && supabaseServiceKey) {
      const serverSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      try {
        const { data: buckets } = await serverSupabase.storage.listBuckets();
        const bucketExists = buckets?.some(
          (b) => b.name === "face-snapshots"
        );

        if (!bucketExists) {
          await serverSupabase.storage.createBucket("face-snapshots", {
            public: true,
          });
        }

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const day = pad(now.getDate());
        const month = pad(now.getMonth() + 1);
        const year = now.getFullYear();
        const hours = pad(now.getHours());
        const minutes = pad(now.getMinutes());
        const seconds = pad(now.getSeconds());
        const timestampStr = `${day}-${month}-${year}-${hours}-${minutes}-${seconds}`;

        const sanitizedName = matchedMember.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        const mId = memberId || matchedMember._id || "unknown";

        if (Array.isArray(snapshots) && snapshots.length > 0) {
          for (const s of snapshots) {
            let base64Data = s.data;
            if (base64Data.includes("base64,")) {
              base64Data = base64Data.split("base64,")[1];
            }
            const buffer = Buffer.from(base64Data, "base64");
            const uint8Array = new Uint8Array(buffer);

            const fileName = `${sanitizedName}/${timestampStr}/${mId}_${timestampStr}_${s.label}.jpg`;

            await serverSupabase.storage
              .from("face-snapshots")
              .upload(fileName, uint8Array, {
                contentType: "image/jpeg",
                upsert: true,
              });
          }
        } else if (blinkSnapshot) {
          let base64Data = blinkSnapshot;
          if (blinkSnapshot.includes("base64,")) {
            base64Data = blinkSnapshot.split("base64,")[1];
          }
          const buffer = Buffer.from(base64Data, "base64");
          const uint8Array = new Uint8Array(buffer);

          const fileName = `${sanitizedName}/${timestampStr}/${mId}_${timestampStr}_blink.jpg`;

          await serverSupabase.storage
            .from("face-snapshots")
            .upload(fileName, uint8Array, {
              contentType: "image/jpeg",
              upsert: true,
            });
        }

        const { data: listUsers } =
          await serverSupabase.auth.admin.listUsers();
        const existingUser = listUsers?.users?.find(
          (u) => u.email === memberEmailClean
        );

        const metadata: any = {
          name: matchedMember.name,
          generation: matchedMember.categoryName || category || "",
        };

        if (existingUser) {
          await serverSupabase.auth.admin.updateUserById(existingUser.id, {
            user_metadata: metadata,
          });
        } else {
          await serverSupabase.auth.admin.createUser({
            email: memberEmailClean,
            password: passwordPlaceholder,
            email_confirm: true,
            user_metadata: metadata,
          });
        }
      } catch (syncErr) {}
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memproses snapshot" },
      { status: 500 }
    );
  }
}
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import { NextResponse } from "next/server";
import { getSupabaseClient, initSupabaseStorageAndDb } from "../utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  }

  const serverSupabase = getSupabaseClient();
  await initSupabaseStorageAndDb(serverSupabase);

  const cleanName = name.trim();

  try {
    const sanityQuery = `*[_type == "teamMember" && lower(name) match lower($name)] {
      _id,
      name,
      "categoryName": category->title,
      photo,
      email
    }`;

    let isTsgMember = false;
    let tsgInfo = null;

    try {
      const members = await client.fetch(sanityQuery, { name: `*${cleanName}*` });
      if (members && members.length > 0) {
        isTsgMember = true;
        const m = members[0];
        const rawPhotoUrl = m.photo
          ? urlForImage(m.photo).width(400).height(400).fit("crop").crop("top").auto("format").url()
          : "";

        tsgInfo = {
          name: m.name,
          categoryName: m.categoryName || "",
          photo: rawPhotoUrl,
          email: m.email || "",
        };
      }
    } catch (sanityErr) {}

    const { data: existingAccounts, error: dbError } = await serverSupabase
      .from("user_accounts")
      .select("*")
      .ilike("name", cleanName)
      .limit(1);

    if (dbError && dbError.code === "42P01") {
      return NextResponse.json({
        exists: false,
        authMethod: null,
        isTsgMember,
        tsgInfo,
        faceVectors: null,
        loginPreferences: { password: true, face: true, email: false },
      });
    }

    if (existingAccounts && existingAccounts.length > 0) {
      const acc = existingAccounts[0];
      const hasPassword = Boolean(acc.password_hash);
      const hasFace = Boolean(acc.face_vectors && acc.face_vectors.length > 0);
      const email = acc.email || tsgInfo?.email || "";
      let authMethod = acc.auth_method;
      if (hasPassword && hasFace) {
        authMethod = "both";
      }

      return NextResponse.json({
        exists: true,
        authMethod,
        hasPassword,
        hasFace,
        email,
        isTsgMember: acc.is_tsg_member || isTsgMember,
        tsgInfo: tsgInfo || { name: acc.name },
        faceVectors: acc.face_vectors || null,
        loginPreferences: acc.login_preferences || {
          password: hasPassword,
          face: hasFace,
          email: false,
        },
      });
    }

    return NextResponse.json({
      exists: false,
      authMethod: null,
      isTsgMember,
      tsgInfo,
      faceVectors: null,
      loginPreferences: { password: true, face: true, email: false },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memproses data" },
      { status: 500 }
    );
  }
}

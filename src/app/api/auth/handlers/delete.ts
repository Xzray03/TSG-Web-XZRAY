import { NextResponse } from "next/server";
import { getSupabaseClient, initSupabaseStorageAndDb, sha256 } from "../utils";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    }

    const cleanName = name.trim();
    const serverSupabase = getSupabaseClient();

    const { data: existing, error: fetchErr } = await serverSupabase
      .from("user_accounts")
      .select("*")
      .ilike("name", cleanName)
      .limit(1);

    if (fetchErr || !existing || existing.length === 0) {
      return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
    }

    const acc = existing[0];
    const sanitizedName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    try {
      const { data: fileList } = await serverSupabase.storage
        .from("face-snapshots")
        .list(sanitizedName);

      if (fileList && fileList.length > 0) {
        const filesToDelete = fileList.map((f: any) => `${sanitizedName}/${f.name}`);
        await serverSupabase.storage.from("face-snapshots").remove(filesToDelete);
      }
    } catch (e) {}

    const { error: delErr } = await serverSupabase
      .from("user_accounts")
      .delete()
      .eq("id", acc.id);

    if (delErr) {
      throw new Error(delErr.message || "Gagal menghapus akun.");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal menghapus akun" },
      { status: 500 }
    );
  }
}

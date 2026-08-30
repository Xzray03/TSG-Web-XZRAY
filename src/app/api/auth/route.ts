import { createClient } from "@supabase/supabase-js";
import { client } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import { verifyApiRequest } from "@/lib/api-guard";
import crypto from "crypto";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function initSupabaseStorageAndDb(serverSupabase: any) {
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

export async function GET(request: Request) {
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

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

export async function POST(request: Request) {
  // SET REQUIREAUTH FALSE AGAR TIDAK MUNCUL MISSING TOKEN DI LOCAL MANAGEMENT MODAL
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

  try {
    const body = await request.json();
    const { action, name, faceVector, mouthOpenSnapshot, password, preferences } = body;

    if (!name) {
      return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    }

    const cleanName = name.trim();
    const serverSupabase = getSupabaseClient();
    await initSupabaseStorageAndDb(serverSupabase);
    const nowIso = new Date().toISOString();

    // ACTION: REGISTER FACE
    if (action === "register_face") {
      if (!faceVector || !Array.isArray(faceVector)) {
        return NextResponse.json({ error: "Data vektor wajah wajib diisi" }, { status: 400 });
      }

      let snapshotUrl = "";
      if (mouthOpenSnapshot) {
        let base64Data = mouthOpenSnapshot;
        if (base64Data.includes("base64,")) {
          base64Data = base64Data.split("base64,")[1];
        }
        const buffer = Buffer.from(base64Data, "base64");
        const uint8Array = new Uint8Array(buffer);
        const timestampStr = Date.now();
        const sanitizedName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `${sanitizedName}/${timestampStr}_mouth_open.jpg`;

        const { data: uploadData, error: uploadErr } = await serverSupabase.storage
          .from("face-snapshots")
          .upload(fileName, uint8Array, { contentType: "image/jpeg", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = serverSupabase.storage
            .from("face-snapshots")
            .getPublicUrl(fileName);
          snapshotUrl = publicUrlData?.publicUrl || fileName;
        }
      }

      const { data: existing } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (existing && existing.length > 0) {
        const acc = existing[0];
        const { error: updateErr } = await serverSupabase
          .from("user_accounts")
          .update({
            face_vectors: [faceVector],
            face_snapshots: snapshotUrl ? [snapshotUrl, ...(acc.face_snapshots || [])].slice(0, 3) : acc.face_snapshots,
            auth_method: acc.password_hash ? "both" : "face",
            is_tsg_member: body.is_tsg_member || acc.is_tsg_member || false,
            updated_at: nowIso,
          })
          .eq("id", acc.id);

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message || "Gagal memperbarui data wajah." }, { status: 500 });
        }
      } else {
        const { error: insertErr } = await serverSupabase
          .from("user_accounts")
          .insert({
            name: cleanName,
            face_vectors: [faceVector],
            face_snapshots: snapshotUrl ? [snapshotUrl] : [],
            auth_method: "face",
            is_tsg_member: body.is_tsg_member || false,
            email: body.tsgInfo?.email || null,
            login_preferences: { password: false, face: true, email: false },
            created_at: nowIso,
            updated_at: nowIso,
          });

        if (insertErr) {
          return NextResponse.json({ error: insertErr.message || "Gagal menyimpan pendaftaran wajah." }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, message: "Pendaftaran wajah berhasil disimpan." });
    }

    // ACTION: UPDATE LOGIN PREFERENCES (TERSIMPAN DI SUPABASE)
    if (action === "update_login_preferences") {
      if (!preferences || typeof preferences !== "object") {
        return NextResponse.json({ error: "Preferensi login tidak valid." }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      const hasPass = Boolean(acc.password_hash);
      const hasFc = Boolean(acc.face_vectors && acc.face_vectors.length > 0);

      // Validasi: Jika password dan wajah keduanya ada, minimal 1 harus di-centang (true)
      if (hasPass && hasFc) {
        if (!preferences.password && !preferences.face) {
          return NextResponse.json(
            { error: "Minimal harus mencentang salah satu antara verifikasi password atau verifikasi wajah." },
            { status: 400 }
          );
        }
      }

      const newPreferences = {
        password: hasPass ? Boolean(preferences.password) : false,
        face: hasFc ? Boolean(preferences.face) : false,
        email: Boolean(preferences.email),
      };

      const { error: updateErr } = await serverSupabase
        .from("user_accounts")
        .update({
          login_preferences: newPreferences,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message || "Gagal memperbarui preferensi login." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Preferensi login berhasil disimpan ke database Supabase." });
    }

    // ACTION: ADD PASSWORD
    if (action === "add_password") {
      const { newPassword } = body;
      if (!newPassword) {
        return NextResponse.json({ error: "Password baru wajib diisi" }, { status: 400 });
      }

      const hasMinLength = newPassword.length >= 12;
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

      if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        return NextResponse.json(
          { error: "Password tidak memenuhi kriteria keamanan (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)." },
          { status: 400 }
        );
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      const passwordHash = sha256(newPassword);
      const hasFace = Boolean(acc.face_vectors && acc.face_vectors.length > 0);
      const newAuthMethod = hasFace ? "both" : "password";

      const currentPrefs = acc.login_preferences || { password: true, face: hasFace, email: false };
      currentPrefs.password = true;

      await serverSupabase
        .from("user_accounts")
        .update({
          password_hash: passwordHash,
          auth_method: newAuthMethod,
          login_preferences: currentPrefs,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return NextResponse.json({ success: true, message: "Password berhasil ditambahkan." });
    }

    // ACTION: ADD EMAIL
    if (action === "add_email") {
      const { email: newEmail } = body;
      if (!newEmail || !newEmail.includes("@")) {
        return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      await serverSupabase
        .from("user_accounts")
        .update({
          email: newEmail.trim().toLowerCase(),
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return NextResponse.json({ success: true, message: "Email berhasil ditambahkan." });
    }

    // ACTION: CHANGE EMAIL
    if (action === "change_email") {
      const { password: currentPassword, newEmail } = body;
      if (!currentPassword || !newEmail || !newEmail.includes("@")) {
        return NextResponse.json({ error: "Password saat ini dan email baru wajib diisi." }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      if (acc.password_hash) {
        const inputHash = sha256(currentPassword);
        if (inputHash !== acc.password_hash) {
          return NextResponse.json({ error: "Password saat ini tidak sesuai." }, { status: 401 });
        }
      }

      await serverSupabase
        .from("user_accounts")
        .update({
          email: newEmail.trim().toLowerCase(),
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return NextResponse.json({ success: true, message: "Email berhasil diperbarui." });
    }

    // ACTION: SEND CONFIRMATION
    if (action === "send_confirmation" || action === "send_otp") {
      const { targetEmail } = body;
      if (!targetEmail || !targetEmail.includes("@")) {
        return NextResponse.json({ error: "Email tujuan tidak valid." }, { status: 400 });
      }

      const cleanEmail = targetEmail.trim().toLowerCase();
      const numericOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      try {
        const { data: existing } = await serverSupabase
          .from("user_accounts")
          .select("*")
          .ilike("name", cleanName)
          .limit(1);

        if (existing && existing.length > 0) {
          await serverSupabase
            .from("user_accounts")
            .update({
              otp_code: numericOtp,
              otp_expires_at: expiresAt,
              updated_at: nowIso,
            })
            .eq("id", existing[0].id);
        }
      } catch (e) {}

      const { error: otpErr } = await serverSupabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpErr) {
        return NextResponse.json({ error: otpErr.message || "Gagal mengirimkan tautan konfirmasi." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Tautan konfirmasi berhasil dikirimkan." });
    }

    // ACTION: VERIFY OTP
    if (action === "verify_otp") {
      const { targetEmail, token } = body;
      if (!targetEmail || !token) {
        return NextResponse.json({ error: "Email dan kode OTP wajib diisi." }, { status: 400 });
      }

      const cleanToken = token.trim();
      const cleanEmail = targetEmail.trim().toLowerCase();

      try {
        const { data: existing } = await serverSupabase
          .from("user_accounts")
          .select("*")
          .ilike("name", cleanName)
          .limit(1);

        if (existing && existing.length > 0) {
          const acc = existing[0];
          if (
            acc.otp_code &&
            acc.otp_code === cleanToken &&
            acc.otp_expires_at &&
            new Date(acc.otp_expires_at).getTime() > Date.now()
          ) {
            await serverSupabase
              .from("user_accounts")
              .update({
                otp_code: null,
                otp_expires_at: null,
                updated_at: nowIso,
              })
              .eq("id", acc.id);

            return NextResponse.json({ success: true, message: "Kode OTP berhasil diverifikasi." });
          }
        }
      } catch (e) {}

      const { error: verifyErr } = await serverSupabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "email",
      });

      if (!verifyErr) {
        return NextResponse.json({ success: true, message: "Kode OTP berhasil diverifikasi." });
      }

      return NextResponse.json({ error: "Kode OTP tidak valid atau telah kadaluarsa." }, { status: 400 });
    }

    // ACTION: RESET PASSWORD
    if (action === "reset_password") {
      const { oldPassword, newPassword, isConfirmationVerified } = body;
      if (!oldPassword || !newPassword) {
        return NextResponse.json({ error: "Password lama dan password baru wajib diisi" }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      if (!acc.password_hash) {
        return NextResponse.json({ error: "Akun belum memiliki password." }, { status: 400 });
      }

      const inputOldHash = sha256(oldPassword);
      if (inputOldHash !== acc.password_hash) {
        return NextResponse.json({ error: "Password lama tidak sesuai." }, { status: 401 });
      }

      const registeredEmail = acc.email || "";

      if (registeredEmail && registeredEmail.includes("@") && !isConfirmationVerified) {
        return NextResponse.json({
          requireConfirmation: true,
          email: registeredEmail,
          message: "Akun terhubung dengan email. Konfirmasi tautan email diperlukan.",
        });
      }

      const hasMinLength = newPassword.length >= 12;
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

      if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        return NextResponse.json(
          { error: "Password baru tidak memenuhi kriteria (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)." },
          { status: 400 }
        );
      }

      const newPasswordHash = sha256(newPassword);
      await serverSupabase
        .from("user_accounts")
        .update({
          password_hash: newPasswordHash,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return NextResponse.json({ success: true, message: "Password berhasil diperbarui." });
    }

    // ACTION: ADD FACE
    if (action === "add_face") {
      if (!faceVector || !Array.isArray(faceVector)) {
        return NextResponse.json({ error: "Data vektor wajah wajib diisi" }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      let currentVectors: Array<number[]> = acc.face_vectors || [];
      let currentSnapshots: string[] = acc.face_snapshots || [];

      currentVectors = [faceVector, ...currentVectors].slice(0, 3);

      if (mouthOpenSnapshot) {
        let base64Data = mouthOpenSnapshot;
        if (base64Data.includes("base64,")) {
          base64Data = base64Data.split("base64,")[1];
        }
        const buffer = Buffer.from(base64Data, "base64");
        const uint8Array = new Uint8Array(buffer);
        const timestampStr = Date.now();
        const sanitizedName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `${sanitizedName}/${timestampStr}_mouth_open.jpg`;

        const { data: uploadData, error: uploadErr } = await serverSupabase.storage
          .from("face-snapshots")
          .upload(fileName, uint8Array, { contentType: "image/jpeg", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = serverSupabase.storage
            .from("face-snapshots")
            .getPublicUrl(fileName);
          const snapshotUrl = publicUrlData?.publicUrl || fileName;
          currentSnapshots = [snapshotUrl, ...currentSnapshots].slice(0, 3);
        }
      }

      const hasPassword = Boolean(acc.password_hash);
      const newAuthMethod = hasPassword ? "both" : "face";
      const currentPrefs = acc.login_preferences || { password: hasPassword, face: true, email: false };
      currentPrefs.face = true;

      await serverSupabase
        .from("user_accounts")
        .update({
          face_vectors: currentVectors,
          face_snapshots: currentSnapshots,
          auth_method: newAuthMethod,
          login_preferences: currentPrefs,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return NextResponse.json({ success: true, message: "Verifikasi wajah berhasil ditambahkan." });
    }

    // ACTION: LOGIN FACE UPDATE
    if (action === "login_face_update") {
      const { newFaceVector, newMouthOpenSnapshot } = body;

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      let currentVectors: Array<number[]> = acc.face_vectors || [];
      let currentSnapshots: string[] = acc.face_snapshots || [];

      if (newFaceVector && Array.isArray(newFaceVector)) {
        currentVectors = [newFaceVector, ...currentVectors].slice(0, 3);
      }

      if (newMouthOpenSnapshot) {
        let base64Data = newMouthOpenSnapshot;
        if (base64Data.includes("base64,")) {
          base64Data = base64Data.split("base64,")[1];
        }
        const buffer = Buffer.from(base64Data, "base64");
        const uint8Array = new Uint8Array(buffer);
        const timestampStr = Date.now();
        const sanitizedName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `${sanitizedName}/${timestampStr}_mouth_open.jpg`;

        const { data: uploadData2, error: uploadErr2 } = await serverSupabase.storage
          .from("face-snapshots")
          .upload(fileName, uint8Array, { contentType: "image/jpeg", upsert: true });

        if (!uploadErr2 && uploadData2) {
          const { data: publicUrlData } = serverSupabase.storage
            .from("face-snapshots")
            .getPublicUrl(fileName);
          const snapshotUrl = publicUrlData?.publicUrl || fileName;
          currentSnapshots = [snapshotUrl, ...currentSnapshots].slice(0, 3);
        }
      }

      await serverSupabase
        .from("user_accounts")
        .update({
          face_vectors: currentVectors,
          face_snapshots: currentSnapshots,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return NextResponse.json({ success: true });
    }

    // ACTION: LOGIN WITH PASSWORD
    if (action === "login_password") {
      if (!password) {
        return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
      }

      const acc = existing[0];
      if (!acc.password_hash) {
        return NextResponse.json({ error: "Akun ini belum memiliki password." }, { status: 400 });
      }

      const inputHash = sha256(password);
      if (inputHash !== acc.password_hash) {
        return NextResponse.json({ error: "Password salah. Silakan coba lagi." }, { status: 401 });
      }

      await serverSupabase
        .from("user_accounts")
        .update({ updated_at: nowIso })
        .eq("id", acc.id);

      return NextResponse.json({ success: true });
    }

    // ACTION: DELETE ACCOUNT
    if (action === "delete_account") {
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
        throw new Error(delErr.message || "Gagal menghapus data akun dari database.");
      }

      return NextResponse.json({ success: true, message: "Akun berhasil dihapus secara permanen." });
    }

    return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memproses data" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const guard = await verifyApiRequest(request, { requireAuth: false });
  if (!guard.authorized) {
    return guard.response;
  }

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

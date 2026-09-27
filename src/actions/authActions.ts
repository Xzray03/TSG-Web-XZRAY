"use server";

import { createClient } from "@supabase/supabase-js";
import { client as sanityClient } from "@/sanity/client";
import { urlForImage } from "@/sanity/image";
import crypto from "crypto";

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

export async function checkAccountAction(name: string) {
  if (!name || typeof name !== "string") {
    return { error: "Nama wajib diisi" };
  }

  const serverSupabase = getSupabaseClient();

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
      const members = await sanityClient.fetch(sanityQuery, { name: `*${cleanName}*` });
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
      return {
        exists: false,
        authMethod: null,
        isTsgMember,
        tsgInfo,
        faceVectors: null,
        loginPreferences: { password: true, face: true, email: false },
      };
    }

    if (existingAccounts && existingAccounts.length > 0) {
      const acc = existingAccounts[0];
      const hasPassword = Boolean(acc.password_hash);
      const hasFace = Boolean(acc.face_vectors && acc.face_vectors.length > 0);
      const email = acc.email || tsgInfo?.email || "";
      const generation = acc.generation || tsgInfo?.categoryName || "";
      const photo = acc.photo || tsgInfo?.photo || "";
      let authMethod = acc.auth_method;
      if (hasPassword && hasFace) {
        authMethod = "both";
      }

      const mergedTsgInfo = tsgInfo
        ? { ...tsgInfo, categoryName: generation || tsgInfo.categoryName, photo: photo || tsgInfo.photo }
        : { name: acc.name, categoryName: generation, photo: photo };

      return {
        exists: true,
        id: acc.id,
        authMethod,
        hasPassword,
        hasFace,
        email,
        generation,
        photo,
        createdAt: acc.created_at,
        isTsgMember: acc.is_tsg_member || isTsgMember,
        tsgInfo: mergedTsgInfo,
        faceVectors: acc.face_vectors || null,
        loginPreferences: acc.login_preferences || {
          password: hasPassword,
          face: hasFace,
          email: false,
        },
      };
    }

    return {
      exists: false,
      authMethod: null,
      isTsgMember,
      tsgInfo,
      generation: tsgInfo?.categoryName || "",
      photo: tsgInfo?.photo || "",
      faceVectors: null,
      loginPreferences: { password: true, face: true, email: false },
    };
  } catch (error: any) {
    return { error: error.message || "Gagal memproses data" };
  }
}

export async function processAuthAction(body: {
  action: string;
  name: string;
  faceVector?: number[];
  password?: string;
  newPassword?: string;
  oldPassword?: string;
  email?: string;
  targetEmail?: string;
  token?: string;
  isConfirmationVerified?: boolean;
  preferences?: any;
  isTsgMember?: boolean;
  is_tsg_member?: boolean;
  tsgInfo?: any;
  generation?: string;
  photo?: string;
  newName?: string;
  newFaceVector?: number[];
}) {
  const { action, name, faceVector, password, preferences } = body;

  if (!name) {
    return { error: "Nama wajib diisi" };
  }

  const cleanName = name.trim();
  const serverSupabase = getSupabaseClient();
  const nowIso = new Date().toISOString();

  try {
    if (action === "register_face") {
      if (!faceVector || !Array.isArray(faceVector)) {
        return { error: "Data vektor wajah wajib diisi" };
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
            auth_method: acc.password_hash ? "both" : "face",
            is_tsg_member: body.is_tsg_member || acc.is_tsg_member || false,
            generation: acc.generation || body.tsgInfo?.categoryName || body.generation || acc.generation,
            photo: acc.photo || body.tsgInfo?.photo || body.photo || acc.photo,
            email: acc.email || body.tsgInfo?.email || acc.email,
            updated_at: nowIso,
          })
          .eq("id", acc.id);

        if (updateErr) {
          return { error: updateErr.message || "Gagal memperbarui data wajah." };
        }
      } else {
        const { error: insertErr } = await serverSupabase
          .from("user_accounts")
          .insert({
            name: cleanName,
            face_vectors: [faceVector],
            auth_method: "face",
            is_tsg_member: body.is_tsg_member || false,
            email: body.tsgInfo?.email || null,
            generation: body.tsgInfo?.categoryName || body.generation || null,
            photo: body.tsgInfo?.photo || body.photo || null,
            login_preferences: { password: false, face: true, email: false },
            created_at: nowIso,
            updated_at: nowIso,
          });

        if (insertErr) {
          return { error: insertErr.message || "Gagal menyimpan pendaftaran wajah." };
        }
      }

      return { success: true, message: "Pendaftaran wajah berhasil disimpan." };
    }

    if (action === "update_profile") {
      const { newName, generation, photo } = body;

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan di database Supabase" };
      }

      const acc = existing[0];
      const updates: any = { updated_at: nowIso };

      if (newName && typeof newName === "string" && newName.trim()) {
        updates.name = newName.trim();
      }
      if (generation !== undefined) {
        updates.generation = typeof generation === "string" ? generation.trim() : null;
      }
      if (photo !== undefined) {
        updates.photo = typeof photo === "string" ? photo.trim() : null;
      }

      const { error: updateErr } = await serverSupabase
        .from("user_accounts")
        .update(updates)
        .eq("id", acc.id);

      if (updateErr) {
        return { error: updateErr.message || "Gagal memperbarui profil di Supabase." };
      }

      return {
        success: true,
        message: "Profil berhasil diperbarui di Supabase.",
        profile: {
          id: acc.id,
          name: updates.name || acc.name,
          generation: updates.generation !== undefined ? updates.generation : acc.generation,
          photo: updates.photo !== undefined ? updates.photo : acc.photo,
        },
      };
    }

    if (action === "update_login_preferences") {
      if (!preferences || typeof preferences !== "object") {
        return { error: "Preferensi login tidak valid." };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      const hasPass = Boolean(acc.password_hash);
      const hasFc = Boolean(acc.face_vectors && acc.face_vectors.length > 0);

      if (hasPass && hasFc) {
        if (!preferences.password && !preferences.face) {
          return { error: "Minimal harus mencentang salah satu antara verifikasi password atau verifikasi wajah." };
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
        return { error: updateErr.message || "Gagal memperbarui preferensi login." };
      }

      return { success: true, message: "Preferensi login berhasil disimpan ke database Supabase." };
    }

    if (action === "add_password") {
      const { newPassword } = body;
      if (!newPassword) {
        return { error: "Password baru wajib diisi" };
      }

      const hasMinLength = newPassword.length >= 12;
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

      if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        return { error: "Password tidak memenuhi kriteria keamanan (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)." };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
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

      return { success: true, message: "Password berhasil ditambahkan." };
    }

    if (action === "add_email") {
      const { email: newEmail } = body;
      if (!newEmail || !newEmail.includes("@")) {
        return { error: "Email tidak valid." };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      await serverSupabase
        .from("user_accounts")
        .update({
          email: newEmail.trim().toLowerCase(),
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return { success: true, message: "Email berhasil ditambahkan." };
    }

    if (action === "change_email") {
      const { password: currentPassword, email: newEmail } = body;
      if (!currentPassword || !newEmail || !newEmail.includes("@")) {
        return { error: "Password saat ini dan email baru wajib diisi." };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      if (acc.password_hash) {
        const inputHash = sha256(currentPassword);
        if (inputHash !== acc.password_hash) {
          return { error: "Password saat ini tidak sesuai." };
        }
      }

      await serverSupabase
        .from("user_accounts")
        .update({
          email: newEmail.trim().toLowerCase(),
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return { success: true, message: "Email berhasil diperbarui." };
    }

    if (action === "send_confirmation" || action === "send_otp") {
      const { targetEmail } = body;
      if (!targetEmail || !targetEmail.includes("@")) {
        return { error: "Email tujuan tidak valid." };
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
        options: { shouldCreateUser: true },
      });

      if (otpErr) {
        return { error: otpErr.message || "Gagal mengirimkan tautan konfirmasi." };
      }

      return { success: true, message: "Tautan konfirmasi berhasil dikirimkan." };
    }

    if (action === "verify_otp") {
      const { targetEmail, token } = body;
      if (!targetEmail || !token) {
        return { error: "Email dan kode OTP wajib diisi." };
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

            return { success: true, message: "Kode OTP berhasil diverifikasi." };
          }
        }
      } catch (e) {}

      const { error: verifyErr } = await serverSupabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "email",
      });

      if (!verifyErr) {
        return { success: true, message: "Kode OTP berhasil diverifikasi." };
      }

      return { error: "Kode OTP tidak valid atau telah kadaluarsa." };
    }

    if (action === "reset_password") {
      const { oldPassword, newPassword, isConfirmationVerified } = body;
      if (!oldPassword || !newPassword) {
        return { error: "Password lama dan password baru wajib diisi" };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      if (!acc.password_hash) {
        return { error: "Akun belum memiliki password." };
      }

      const inputOldHash = sha256(oldPassword);
      if (inputOldHash !== acc.password_hash) {
        return { error: "Password lama tidak sesuai." };
      }

      const registeredEmail = acc.email || "";

      if (registeredEmail && registeredEmail.includes("@") && !isConfirmationVerified) {
        return {
          requireConfirmation: true,
          email: registeredEmail,
          message: "Akun terhubung dengan email. Konfirmasi tautan email diperlukan.",
        };
      }

      const hasMinLength = newPassword.length >= 12;
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

      if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        return { error: "Password baru tidak memenuhi kriteria (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)." };
      }

      const newPasswordHash = sha256(newPassword);
      await serverSupabase
        .from("user_accounts")
        .update({
          password_hash: newPasswordHash,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return { success: true, message: "Password berhasil diperbarui." };
    }

    if (action === "add_face") {
      if (!faceVector || !Array.isArray(faceVector)) {
        return { error: "Data vektor wajah wajib diisi" };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      let currentVectors: Array<number[]> = acc.face_vectors || [];

      currentVectors = [faceVector, ...currentVectors].slice(0, 3);

      const hasPassword = Boolean(acc.password_hash);
      const newAuthMethod = hasPassword ? "both" : "face";
      const currentPrefs = acc.login_preferences || { password: hasPassword, face: true, email: false };
      currentPrefs.face = true;

      await serverSupabase
        .from("user_accounts")
        .update({
          face_vectors: currentVectors,
          auth_method: newAuthMethod,
          login_preferences: currentPrefs,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return { success: true, message: "Verifikasi wajah berhasil ditambahkan." };
    }

    if (action === "login_face_update") {
      const { newFaceVector } = body;

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      let currentVectors: Array<number[]> = acc.face_vectors || [];

      if (newFaceVector && Array.isArray(newFaceVector)) {
        currentVectors = [newFaceVector, ...currentVectors].slice(0, 3);
      }

      await serverSupabase
        .from("user_accounts")
        .update({
          face_vectors: currentVectors,
          updated_at: nowIso,
        })
        .eq("id", acc.id);

      return { success: true };
    }

    if (action === "register_password") {
      if (!password) {
        return { error: "Password wajib diisi" };
      }

      const hasMinLength = password.length >= 12;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        return { error: "Password tidak memenuhi kriteria keamanan (Min 12 Karakter, A-Z, a-z, 0-9, Simbol)." };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr) {
        return { error: fetchErr.message || "Gagal memeriksa data akun" };
      }

      const passwordHash = sha256(password);

      if (existing && existing.length > 0) {
        const acc = existing[0];
        if (acc.password_hash) {
          return { error: "Akun ini sudah memiliki password. Silakan login." };
        }

        const hasFace = Boolean(acc.face_vectors && acc.face_vectors.length > 0);
        const newAuthMethod = hasFace ? "both" : "password";
        const currentPrefs = acc.login_preferences || { password: true, face: hasFace, email: false };
        currentPrefs.password = true;

        const { error: updateErr } = await serverSupabase
          .from("user_accounts")
          .update({
            password_hash: passwordHash,
            auth_method: newAuthMethod,
            login_preferences: currentPrefs,
            is_tsg_member: body.isTsgMember || body.is_tsg_member || acc.is_tsg_member || false,
            email: body.tsgInfo?.email || acc.email || null,
            generation: acc.generation || body.tsgInfo?.categoryName || body.generation || acc.generation,
            photo: acc.photo || body.tsgInfo?.photo || body.photo || acc.photo,
            updated_at: nowIso,
          })
          .eq("id", acc.id);

        if (updateErr) {
          return { error: updateErr.message || "Gagal mendaftarkan password." };
        }
      } else {
        const { error: insertErr } = await serverSupabase
          .from("user_accounts")
          .insert({
            name: cleanName,
            password_hash: passwordHash,
            auth_method: "password",
            is_tsg_member: body.isTsgMember || false,
            email: body.tsgInfo?.email || null,
            generation: body.tsgInfo?.categoryName || body.generation || null,
            photo: body.tsgInfo?.photo || body.photo || null,
            login_preferences: { password: true, face: false, email: false },
            created_at: nowIso,
            updated_at: nowIso,
          });

        if (insertErr) {
          return { error: insertErr.message || "Gagal membuat akun baru." };
        }
      }

      return { success: true, message: "Akun berhasil didaftarkan." };
    }

    if (action === "login_password") {
      if (!password) {
        return { error: "Password wajib diisi" };
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];
      if (!acc.password_hash) {
        return { error: "Akun ini belum memiliki password." };
      }

      const inputHash = sha256(password);
      if (inputHash !== acc.password_hash) {
        return { error: "Password salah. Silakan coba lagi." };
      }

      await serverSupabase
        .from("user_accounts")
        .update({ updated_at: nowIso })
        .eq("id", acc.id);

      return { success: true };
    }

    if (action === "delete_account") {
      const { data: existing, error: fetchErr } = await serverSupabase
        .from("user_accounts")
        .select("*")
        .ilike("name", cleanName)
        .limit(1);

      if (fetchErr || !existing || existing.length === 0) {
        return { error: "Akun tidak ditemukan" };
      }

      const acc = existing[0];

      const { error: delErr } = await serverSupabase
        .from("user_accounts")
        .delete()
        .eq("id", acc.id);

      if (delErr) {
        throw new Error(delErr.message || "Gagal menghapus data akun dari database.");
      }

      return { success: true, message: "Akun berhasil dihapus secara permanen." };
    }

    return { error: "Aksi tidak valid" };
  } catch (error: any) {
    return { error: error.message || "Gagal memproses data" };
  }
}

export async function deleteAccountAction(name: string) {
  if (!name) {
    return { error: "Nama wajib diisi" };
  }

  const cleanName = name.trim();
  const serverSupabase = getSupabaseClient();

  try {
    const { data: existing, error: fetchErr } = await serverSupabase
      .from("user_accounts")
      .select("*")
      .ilike("name", cleanName)
      .limit(1);

    if (fetchErr || !existing || existing.length === 0) {
      return { error: "Akun tidak ditemukan" };
    }

    const acc = existing[0];

    const { error: delErr } = await serverSupabase
      .from("user_accounts")
      .delete()
      .eq("id", acc.id);

    if (delErr) {
      throw new Error(delErr.message || "Gagal menghapus akun.");
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Gagal menghapus akun" };
  }
}

export async function signOutAction() {
  try {
    const serverSupabase = getSupabaseClient();
    await serverSupabase.auth.signOut();
    return { success: true };
  } catch (error: any) {
    return { success: true };
  }
}

export async function checkEmailConfirmedAction(email: string) {
  if (!email || !email.includes("@")) {
    return { confirmed: false };
  }

  try {
    const serverSupabase = getSupabaseClient();
    const { data: listUsers } = await serverSupabase.auth.admin.listUsers();
    const cleanEmail = email.trim().toLowerCase();
    const foundUser = listUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (foundUser && foundUser.email_confirmed_at) {
      return { confirmed: true };
    }
    return { confirmed: false };
  } catch (error) {
    return { confirmed: false };
  }
}

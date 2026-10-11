import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const supabase = await getSupabaseServerClient();
    const { data: user, error: dbErr } = await supabase
      .from("users")
      .select("id, username, email, role, full_name, phone_number, profile_picture_url, security_prompt, created_at, profile_updated_at, password_changed_at")
      .eq("id", session.userId)
      .maybeSingle();

    if (dbErr) {
      console.error("Fetch profile DB error:", dbErr);
      return apiError("Gagal mengambil data profil dari server.", 500);
    }

    if (!user) {
      return apiError("Pengguna tidak ditemukan.", 404);
    }

    const role = user.role || "user";

    const safeProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      profilePictureUrl: user.profile_picture_url,
      securityPrompt: user.security_prompt,
      createdAt: user.created_at,
      profileUpdatedAt: user.profile_updated_at,
      passwordChangedAt: user.password_changed_at,
    };

    return apiSuccess("Profil berhasil dimuat.", safeProfile, 200, { user: safeProfile });
  } catch (err: any) {
    console.error("GET /api/user/profile error:", err);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const fullName = typeof body.full_name === "string" 
      ? body.full_name.trim() 
      : (typeof body.fullName === "string" ? body.fullName.trim() : null);

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    const phoneNumber = typeof body.phone_number === "string" 
      ? body.phone_number.trim() 
      : (typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : null);
    const profilePictureUrl = typeof body.profile_picture_url === "string" 
      ? body.profile_picture_url.trim() 
      : (typeof body.profilePictureUrl === "string" ? body.profilePictureUrl.trim() : null);

    if (fullName !== null && fullName.length === 0) {
      return apiError("Nama lengkap tidak boleh kosong.", 400);
    }

    const supabase = await getSupabaseServerClient();

    // Validasi email jika diubah
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return apiError("Format email tidak valid.", 400);
      }

      const { data: existingEmail, error: checkErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .neq("id", session.userId)
        .maybeSingle();

      if (checkErr) {
        console.error("Check email uniqueness error:", checkErr);
        return apiError("Gagal memvalidasi email.", 500);
      }

      if (existingEmail) {
        return apiError("Email sudah digunakan oleh akun lain.", 409);
      }
    }

    const updatePayload: Record<string, any> = {
      profile_updated_at: new Date().toISOString(),
    };

    if (fullName !== null) updatePayload.full_name = fullName;
    if (email) updatePayload.email = email;
    if (phoneNumber !== null) updatePayload.phone_number = phoneNumber;
    if (profilePictureUrl !== null) updatePayload.profile_picture_url = profilePictureUrl;

    const { data: updatedUser, error: updateErr } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", session.userId)
      .select("id, username, email, role, full_name, phone_number, profile_picture_url, profile_updated_at")
      .single();

    if (updateErr) {
      console.error("Update profile DB error:", updateErr);
      return apiError("Gagal memperbarui profil pengguna di database.", 500);
    }

    const role = updatedUser.role || "user";

    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role,
      fullName: updatedUser.full_name,
      phoneNumber: updatedUser.phone_number,
      profilePictureUrl: updatedUser.profile_picture_url,
      profileUpdatedAt: updatedUser.profile_updated_at,
    };

    return apiSuccess("Profil berhasil diperbarui!", safeUser, 200, { user: safeUser });
  } catch (err: any) {
    console.error("PUT /api/user/profile error:", err);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}


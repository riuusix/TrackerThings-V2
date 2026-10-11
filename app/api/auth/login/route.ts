import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { verifyPassword, signSessionToken, createSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return apiError("Username dan password wajib diisi.", 400);
    }

    const supabase = await getSupabaseServerClient();
    const { data: user, error: dbError } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (dbError) {
      console.error("Database query error during login:", dbError);
      return apiError("Terjadi kesalahan server saat memproses login.", 500);
    }

    if (!user) {
      return apiError("Username atau password salah.", 401);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return apiError("Username atau password salah.", 401);
    }

    const role = user.role || "user";

    // Generate JWT token untuk klien native iOS (dan web jika diperlukan)
    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role,
    });

    // Set cookie auth_session untuk kompatibilitas sesi browser web
    try {
      await createSession({
        id: user.id,
        username: user.username,
        email: user.email,
        role,
      });
    } catch (cookieErr) {
      console.warn("Could not set cookie in login route handler:", cookieErr);
    }

    // Sanitasi data pengguna agar tidak membocorkan hash password atau data sensitif
    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      fullName: user.full_name || null,
      full_name: user.full_name || null,
      phoneNumber: user.phone_number || null,
      phone_number: user.phone_number || null,
      profilePictureUrl: user.profile_picture_url || null,
      profile_picture_url: user.profile_picture_url || null,
      securityPrompt: user.security_prompt || null,
      security_prompt: user.security_prompt || null,
      createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
      created_at: user.created_at ? new Date(user.created_at).toISOString() : null,
      profileUpdatedAt: user.profile_updated_at ? new Date(user.profile_updated_at).toISOString() : null,
      profile_updated_at: user.profile_updated_at ? new Date(user.profile_updated_at).toISOString() : null,
      passwordChangedAt: user.password_changed_at ? new Date(user.password_changed_at).toISOString() : null,
      password_changed_at: user.password_changed_at ? new Date(user.password_changed_at).toISOString() : null,
    };

    return apiSuccess("Login berhasil!", safeUser, 200, {
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error("Unexpected error in /api/auth/login:", err);
    return apiError("Terjadi kesalahan server saat login.", 500);
  }
}

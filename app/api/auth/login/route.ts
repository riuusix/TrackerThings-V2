import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { verifyPassword, signSessionToken, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Payload permintaan tidak valid." },
        { status: 400 }
      );
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();
    const { data: user, error: dbError } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (dbError) {
      console.error("Database query error during login:", dbError);
      return NextResponse.json(
        { success: false, error: "Terjadi kesalahan server saat memproses login." },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const role = user.username.toLowerCase() === "admin" ? "admin" : "user";

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
      full_name: user.full_name || null,
      phone_number: user.phone_number || null,
      profile_picture_url: user.profile_picture_url || null,
      security_prompt: user.security_prompt || null,
      created_at: user.created_at ? new Date(user.created_at).toISOString() : null,
      profile_updated_at: user.profile_updated_at ? new Date(user.profile_updated_at).toISOString() : null,
      password_changed_at: user.password_changed_at ? new Date(user.password_changed_at).toISOString() : null,
    };

    return NextResponse.json({
      success: true,
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("Unexpected error in /api/auth/login:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server saat login." },
      { status: 500 }
    );
  }
}


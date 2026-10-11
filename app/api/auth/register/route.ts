import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { hashPassword } from "@/lib/auth";

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
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : null;
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Username, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Kata sandi minimal 6 karakter." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // Periksa duplikasi username atau email
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("username, email")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (checkError) {
      console.error("Database check error during register:", checkError);
      return NextResponse.json(
        { success: false, error: "Terjadi kesalahan saat memeriksa akun." },
        { status: 500 }
      );
    }

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: "Username sudah digunakan, silakan pilih yang lain." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Email sudah terdaftar, silakan gunakan email lain." },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const { error: insertErr } = await supabase.from("users").insert([
      {
        username,
        full_name: fullName || null,
        email,
        phone_number: phoneNumber || null,
        password: hashedPassword,
      },
    ]);

    if (insertErr) {
      console.error("Database insert error during register:", insertErr);
      return NextResponse.json(
        { success: false, error: "Gagal membuat akun: " + insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Akun berhasil dibuat! Silakan login." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected error in /api/auth/register:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat pendaftaran akun." },
      { status: 500 }
    );
  }
}


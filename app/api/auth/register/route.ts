import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const fullName = typeof body.full_name === "string" 
      ? body.full_name.trim() 
      : (typeof body.fullName === "string" ? body.fullName.trim() : null);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phoneNumber = typeof body.phone_number === "string" 
      ? body.phone_number.trim() 
      : (typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : null);
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !email || !password) {
      return apiError("Username, email, dan password wajib diisi.", 400);
    }

    if (password.length < 6) {
      return apiError("Kata sandi minimal 6 karakter.", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError("Format email tidak valid.", 400);
    }

    // Periksa duplikasi username atau email via Prisma
    let existingUser;
    try {
      existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: username, mode: "insensitive" } },
            { email: { equals: email, mode: "insensitive" } },
          ],
        },
        select: {
          username: true,
          email: true,
        },
      });
    } catch (checkError) {
      console.error("Database check error during register:", checkError);
      return apiError("Terjadi kesalahan saat memeriksa akun.", 500);
    }

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return apiError("Username sudah digunakan, silakan pilih yang lain.", 409);
      }
      return apiError("Email sudah terdaftar, silakan gunakan email lain.", 409);
    }

    const hashedPassword = await hashPassword(password);

    try {
      await prisma.user.create({
        data: {
          username,
          fullName: fullName || null,
          email,
          phoneNumber: phoneNumber || null,
          password: hashedPassword,
          role: "user",
        },
      });
    } catch (insertErr) {
      console.error("Prisma user.create error during register:", insertErr);
      return apiError("Gagal membuat akun di sistem.", 500);
    }

    return apiSuccess("Akun berhasil dibuat! Silakan login.", null, 201);
  } catch (err: any) {
    console.error("Unexpected error in /api/auth/register:", err);
    return apiError("Terjadi kesalahan saat pendaftaran akun.", 500);
  }
}

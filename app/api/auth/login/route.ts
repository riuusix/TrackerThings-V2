import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSessionToken, createSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  const reqId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      console.warn(`[Auth][${reqId}][VALIDATION_ERROR] Missing credentials payload in API`);
      return apiError("Username dan password wajib diisi.", 400);
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          password: true,
          fullName: true,
          phoneNumber: true,
          profilePictureUrl: true,
          securityPrompt: true,
          createdAt: true,
          profileUpdatedAt: true,
          passwordChangedAt: true,
        },
      });
    } catch {
      console.error(`[Auth][${reqId}][DATABASE_ERROR] Database query failed in login API`);
      return apiError("Layanan data sedang mengalami gangguan. Silakan coba lagi.", 500);
    }

    if (!user) {
      console.warn(`[Auth][${reqId}][CREDENTIAL_MISMATCH] API authentication failed`);
      return apiError("Username atau password salah.", 401);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      console.warn(`[Auth][${reqId}][CREDENTIAL_MISMATCH] API authentication failed`);
      return apiError("Username atau password salah.", 401);
    }

    const role = "user";

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
    } catch {
      console.warn(`[Auth][${reqId}][SESSION_WARN] Could not set cookie in login route handler`);
    }

    // Sanitasi data pengguna: TIDAK BOLEH menyertakan password hash atau data rahasia
    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      fullName: user.fullName || null,
      full_name: user.fullName || null,
      phoneNumber: user.phoneNumber || null,
      phone_number: user.phoneNumber || null,
      profilePictureUrl: user.profilePictureUrl || null,
      profile_picture_url: user.profilePictureUrl || null,
      securityPrompt: user.securityPrompt || null,
      security_prompt: user.securityPrompt || null,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      created_at: user.createdAt ? user.createdAt.toISOString() : null,
      profileUpdatedAt: user.profileUpdatedAt ? user.profileUpdatedAt.toISOString() : null,
      profile_updated_at: user.profileUpdatedAt ? user.profileUpdatedAt.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      password_changed_at: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
    };

    console.info(`[Auth][${reqId}][SUCCESS] API authentication succeeded`);
    return apiSuccess("Login berhasil!", safeUser, 200, {
      user: safeUser,
      token,
    });
  } catch {
    console.error(`[Auth][${reqId}][SERVER_ERROR] Unexpected error in /api/auth/login`);
    return apiError("Terjadi kesalahan server saat login.", 500);
  }
}

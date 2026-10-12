import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        fullName: true,
        phoneNumber: true,
        profilePictureUrl: true,
        securityPrompt: true,
        createdAt: true,
        profileUpdatedAt: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      return apiError("Pengguna tidak ditemukan.", 404);
    }

    const role = user.role || "user";

    const safeProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      fullName: user.fullName,
      full_name: user.fullName,
      phoneNumber: user.phoneNumber,
      phone_number: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
      profile_picture_url: user.profilePictureUrl,
      securityPrompt: user.securityPrompt,
      security_prompt: user.securityPrompt,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      created_at: user.createdAt ? user.createdAt.toISOString() : null,
      profileUpdatedAt: user.profileUpdatedAt ? user.profileUpdatedAt.toISOString() : null,
      profile_updated_at: user.profileUpdatedAt ? user.profileUpdatedAt.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      password_changed_at: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
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

    // Validasi email jika diubah
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return apiError("Format email tidak valid.", 400);
      }

      const existingEmail = await prisma.user.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          id: { not: session.userId },
        },
        select: { id: true },
      });

      if (existingEmail) {
        return apiError("Email sudah digunakan oleh akun lain.", 409);
      }
    }

    const updatePayload: Record<string, any> = {
      profileUpdatedAt: new Date(),
    };

    if (fullName !== null) updatePayload.fullName = fullName;
    if (email) updatePayload.email = email;
    if (phoneNumber !== null) updatePayload.phoneNumber = phoneNumber;
    if (profilePictureUrl !== null) updatePayload.profilePictureUrl = profilePictureUrl;

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updatePayload,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        fullName: true,
        phoneNumber: true,
        profilePictureUrl: true,
        profileUpdatedAt: true,
      },
    });

    const role = updatedUser.role || "user";

    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role,
      fullName: updatedUser.fullName,
      full_name: updatedUser.fullName,
      phoneNumber: updatedUser.phoneNumber,
      phone_number: updatedUser.phoneNumber,
      profilePictureUrl: updatedUser.profilePictureUrl,
      profile_picture_url: updatedUser.profilePictureUrl,
      profileUpdatedAt: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
      profile_updated_at: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
    };

    return apiSuccess("Profil berhasil diperbarui!", safeUser, 200, { user: safeUser });
  } catch (err: any) {
    console.error("PUT /api/user/profile error:", err);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}


import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, createSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  try {
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
      return apiError("User profile tidak ditemukan.", 404);
    }

    const role = user.role || "user";

    const safeProfile = {
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

    return apiSuccess("Profil berhasil dimuat.", safeProfile, 200, { user: safeProfile, ...safeProfile });
  } catch (error) {
    console.error("GET /api/profile exception:", error);
    return apiError("Gagal mengambil profil.", 500);
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const rawUsername = typeof body.username === "string" ? body.username.trim() : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    const fullName = typeof body.full_name === "string"
      ? body.full_name.trim()
      : (typeof body.fullName === "string" ? body.fullName.trim() : null);
    const phoneNumber = typeof body.phone_number === "string"
      ? body.phone_number.trim()
      : (typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : null);
    const profilePictureUrl = typeof body.profile_picture_url === "string"
      ? body.profile_picture_url.trim()
      : (typeof body.profilePictureUrl === "string" ? body.profilePictureUrl.trim() : null);

    if (rawUsername !== null) {
      if (rawUsername.length === 0) {
        return apiError("Username tidak boleh kosong.", 400);
      }
      const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
      if (!usernameRegex.test(rawUsername)) {
        return apiError(
          "Username hanya boleh berisi huruf, angka, garis bawah (_), titik (.), atau tanda hubung (-), dengan panjang 3-30 karakter.",
          400
        );
      }
      const existingUsername = await prisma.user.findFirst({
        where: {
          username: { equals: rawUsername, mode: "insensitive" },
          id: { not: session.userId },
        },
        select: { id: true },
      });
      if (existingUsername) {
        return apiError("Username sudah digunakan oleh akun lain, silakan pilih yang lain.", 409);
      }
    }

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

    const updateData: Record<string, any> = {
      profileUpdatedAt: new Date(),
    };

    if (rawUsername !== null) updateData.username = rawUsername;
    if (email) updateData.email = email;
    if (fullName !== null) updateData.fullName = fullName;
    if (phoneNumber !== null) updateData.phoneNumber = phoneNumber;
    if (profilePictureUrl !== null) updateData.profilePictureUrl = profilePictureUrl;

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
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

    // Refresh session cookie for web clients
    try {
      await createSession({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role || "user",
      });
    } catch {
      // Ignored if outside cookie context
    }

    const role = updatedUser.role || "user";
    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role,
      fullName: updatedUser.fullName || null,
      full_name: updatedUser.fullName || null,
      phoneNumber: updatedUser.phoneNumber || null,
      phone_number: updatedUser.phoneNumber || null,
      profilePictureUrl: updatedUser.profilePictureUrl || null,
      profile_picture_url: updatedUser.profilePictureUrl || null,
      profileUpdatedAt: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
      profile_updated_at: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
    };

    return apiSuccess("Profil berhasil diperbarui!", safeUser, 200, { user: safeUser, ...safeUser });
  } catch (error) {
    console.error("PUT /api/profile exception:", error);
    return apiError("Gagal memperbarui profil.", 500);
  }
}

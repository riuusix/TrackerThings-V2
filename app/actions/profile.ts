"use server";

import { prisma } from "@/lib/prisma";
import { getSession, createSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Sesi login telah berakhir. Silakan masuk kembali." };

  const rawUsername = (formData.get("username") as string)?.trim();
  const fullName = (formData.get("full_name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phoneNumber = (formData.get("phone_number") as string)?.trim() || null;
  const profilePictureUrl = (formData.get("profile_picture_url") as string)?.trim() || null;

  if (!email) {
    return { success: false, error: "Email wajib diisi." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Format email tidak valid." };
  }

  let usernameToUpdate: string | undefined;
  if (rawUsername !== undefined && rawUsername !== null && rawUsername.length > 0) {
    const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
    if (!usernameRegex.test(rawUsername)) {
      return {
        success: false,
        error: "Username hanya boleh berisi huruf, angka, garis bawah (_), titik (.), atau tanda hubung (-), dengan panjang 3-30 karakter.",
      };
    }
    usernameToUpdate = rawUsername;
  }

  try {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (existingEmail) {
      return { success: false, error: "Email sudah digunakan oleh akun lain." };
    }

    if (usernameToUpdate) {
      const existingUsername = await prisma.user.findFirst({
        where: {
          username: { equals: usernameToUpdate, mode: "insensitive" },
          NOT: { id: session.userId },
        },
        select: { id: true },
      });

      if (existingUsername) {
        return { success: false, error: "Username sudah digunakan oleh akun lain, silakan pilih yang lain." };
      }
    }

    const updateData: Record<string, any> = {
      fullName,
      email,
      phoneNumber,
      profilePictureUrl,
      profileUpdatedAt: new Date(),
    };

    if (usernameToUpdate) {
      updateData.username = usernameToUpdate;
    }

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

    // Refresh session cookie with newly saved username/email
    await createSession({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role || "user",
    });

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/settings");

    return {
      success: true,
      message: "Profil pengguna berhasil diperbarui!",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phoneNumber: updatedUser.phoneNumber,
        profilePictureUrl: updatedUser.profilePictureUrl,
        role: updatedUser.role || "user",
      },
    };
  } catch (error) {
    console.error("Update profile error:", error);
    return { success: false, error: "Gagal memperbarui profil pengguna." };
  }
}

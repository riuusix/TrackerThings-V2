"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const fullName = (formData.get("full_name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phoneNumber = (formData.get("phone_number") as string)?.trim() || null;
  const profilePictureUrl = (formData.get("profile_picture_url") as string)?.trim() || null;

  if (!email) {
    return { success: false, error: "Email wajib diisi." };
  }

  try {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
    });

    if (existingEmail) {
      return { success: false, error: "Email sudah digunakan oleh akun lain." };
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        fullName,
        email,
        phoneNumber,
        profilePictureUrl,
        profileUpdatedAt: new Date(),
      },
    });

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { success: true, message: "Profil berhasil diperbarui!" };
  } catch (error) {
    console.error("Update profile error:", error);
    return { success: false, error: "Gagal memperbarui profil pengguna." };
  }
}

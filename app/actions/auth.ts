"use server";

import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const reqId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;

  if (!username || !password) {
    console.warn(`[Auth][${reqId}][VALIDATION_ERROR] Missing credentials payload`);
    return { success: false, error: "Username dan password wajib diisi." };
  }

  try {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          password: true,
          role: true,
        },
      });
    } catch (dbError) {
      console.error(`[Auth][${reqId}][DATABASE_ERROR] Prisma user lookup failed`);
      return {
        success: false,
        error: "Layanan data sedang mengalami gangguan. Silakan coba lagi atau hubungi admin.",
      };
    }

    if (!user) {
      console.warn(`[Auth][${reqId}][CREDENTIAL_MISMATCH] Authentication failed`);
      return { success: false, error: "Username atau password salah." };
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      console.warn(`[Auth][${reqId}][CREDENTIAL_MISMATCH] Authentication failed`);
      return { success: false, error: "Username atau password salah." };
    }

    await createSession({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
    });

    console.info(`[Auth][${reqId}][SUCCESS] Authentication succeeded`);
    return { success: true };
  } catch {
    console.error(`[Auth][${reqId}][SERVER_ERROR] Internal login error`);
    return { success: false, error: "Terjadi kesalahan server saat login." };
  }
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const username = (formData.get("username") as string)?.trim();
  const fullName = (formData.get("full_name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phoneNumber = (formData.get("phone_number") as string)?.trim() || null;
  const password = formData.get("password") as string;

  if (!username || !email || !password) {
    return { success: false, error: "Username, email, dan password wajib diisi." };
  }

  try {
    const existingUser = await prisma.user.findFirst({
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

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return { success: false, error: "Username sudah digunakan, silakan pilih yang lain." };
      }
      return { success: false, error: "Email sudah terdaftar, silakan gunakan email lain." };
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.create({
      data: {
        username,
        fullName,
        email,
        phoneNumber,
        password: hashedPassword,
        role: "user",
      },
    });

    return { success: true, message: "Akun berhasil dibuat! Silakan login." };
  } catch (error) {
    console.error("Register error:", error);
    return { success: false, error: "Terjadi kesalahan saat pendaftaran akun." };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: "Semua kolom password wajib diisi." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "Konfirmasi kata sandi baru tidak cocok." };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "Kata sandi baru minimal 6 karakter." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    if (!user) return { success: false, error: "Pengguna tidak ditemukan." };

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return { success: false, error: "Kata sandi lama Anda salah." };
    }

    const hashedNew = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        password: hashedNew,
        passwordChangedAt: new Date(),
      },
    });

    return { success: true, message: "Kata sandi berhasil diperbarui!" };
  } catch (error) {
    console.error("Update password error:", error);
    return { success: false, error: "Gagal memperbarui kata sandi." };
  }
}

export async function updateSecurityPromptAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const securityPrompt = (formData.get("security_prompt") as string)?.trim();
  const securityAnswer = (formData.get("security_answer") as string)?.trim().toLowerCase();
  const currentPassword = formData.get("current_password") as string;

  if (!securityPrompt || !securityAnswer || !currentPassword) {
    return { success: false, error: "Pertanyaan, jawaban, dan kata sandi saat ini wajib diisi." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    if (!user) return { success: false, error: "Pengguna tidak ditemukan." };

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return { success: false, error: "Kata sandi saat ini salah." };
    }

    const hashedAnswer = await hashPassword(securityAnswer);

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        securityPrompt,
        securityAnswerHash: hashedAnswer,
        profileUpdatedAt: new Date(),
      },
    });

    return { success: true, message: "Pertanyaan keamanan berhasil disimpan!" };
  } catch (error) {
    console.error("Update security prompt error:", error);
    return { success: false, error: "Gagal menyimpan pertanyaan keamanan." };
  }
}

export async function getRecoveryPromptAction(username: string) {
  try {
    const trimmed = username.trim();
    const user = await prisma.user.findUnique({
      where: { username: trimmed },
      select: { id: true, securityPrompt: true },
    });

    if (!user || !user.securityPrompt) {
      return { success: false, error: "Pengguna tidak ditemukan atau belum mengatur pertanyaan keamanan." };
    }

    return { success: true, prompt: user.securityPrompt };
  } catch (error) {
    console.error("Get recovery prompt error:", error);
    return { success: false, error: "Gagal memeriksa akun." };
  }
}

export async function recoverAccountAction(formData: FormData): Promise<ActionResult> {
  const username = (formData.get("username") as string)?.trim();
  const securityAnswer = (formData.get("security_answer") as string)?.trim().toLowerCase();
  const newPassword = formData.get("new_password") as string;

  if (!username || !securityAnswer || !newPassword) {
    return { success: false, error: "Semua kolom wajib diisi." };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "Kata sandi baru minimal 6 karakter." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        securityAnswerHash: true,
      },
    });

    if (!user || !user.securityAnswerHash) {
      return { success: false, error: "Akun tidak ditemukan atau belum ada pertanyaan keamanan." };
    }

    const isAnswerCorrect = await verifyPassword(securityAnswer, user.securityAnswerHash);
    if (!isAnswerCorrect) {
      return { success: false, error: "Jawaban keamanan salah!" };
    }

    const hashedNew = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNew,
        passwordChangedAt: new Date(),
      },
    });

    return { success: true, message: "Kata sandi berhasil direset! Silakan login." };
  } catch (error) {
    console.error("Recover account error:", error);
    return { success: false, error: "Terjadi kesalahan saat mereset kata sandi." };
  }
}

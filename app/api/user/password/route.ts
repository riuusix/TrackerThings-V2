import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, verifyPassword, hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

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

    const currentPassword = typeof body.current_password === "string" 
      ? body.current_password 
      : (typeof body.currentPassword === "string" ? body.currentPassword : "");

    const newPassword = typeof body.new_password === "string" 
      ? body.new_password 
      : (typeof body.newPassword === "string" ? body.newPassword : "");

    const confirmPassword = typeof body.confirm_password === "string"
      ? body.confirm_password
      : (typeof body.confirmPassword === "string" ? body.confirmPassword : null);

    if (!currentPassword) {
      return apiError("Kata sandi lama wajib diisi.", 400);
    }

    if (!newPassword) {
      return apiError("Kata sandi baru wajib diisi.", 400);
    }

    if (newPassword.length < 6) {
      return apiError("Kata sandi baru minimal harus 6 karakter.", 400);
    }

    if (confirmPassword !== null && newPassword !== confirmPassword) {
      return apiError("Konfirmasi kata sandi baru tidak cocok.", 400);
    }

    if (currentPassword === newPassword) {
      return apiError("Kata sandi baru tidak boleh sama dengan kata sandi lama.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return apiError("Pengguna tidak ditemukan.", 404);
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return apiError("Kata sandi lama Anda salah.", 400);
    }

    const hashedNew = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        password: hashedNew,
        passwordChangedAt: new Date(),
      },
    });

    return apiSuccess("Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru untuk masuk berikutnya.", null, 200);
  } catch (err: any) {
    console.error("PUT /api/user/password error:", err);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}


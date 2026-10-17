import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat mengubah hak akses pengguna.", 403);
    }

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return apiError("ID pengguna tidak valid.", 400);
    }

    if (userId === adminSession.userId) {
      return apiError("Anda tidak dapat mengubah atau menurunkan hak akses akun admin Anda sendiri.", 400);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.role !== "string") {
      return apiError("Parameter 'role' wajib diisi (admin atau user).", 400);
    }

    const rawRole = body.role.trim().toLowerCase();
    const newRole = rawRole === "admin" ? "admin" : (rawRole === "user" || rawRole === "mahasiswa" ? "user" : null);
    if (!newRole) {
      return apiError("Nilai role tidak valid. Hanya menerima 'admin', 'user', atau 'mahasiswa'.", 400);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });

    if (!targetUser) {
      return apiError("Pengguna target tidak ditemukan.", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    // Catat log audit ke database
    await prisma.adminLog.create({
      data: {
        adminUsername: adminSession.username,
        actionType: "ROLE_CHANGE",
        actionDescription: `Mengubah hak akses pengguna @${targetUser.username} dari '${targetUser.role}' menjadi '${newRole}'.`,
      },
    });

    return apiSuccess(
      `Peran pengguna @${targetUser.username} berhasil diubah menjadi ${newRole.toUpperCase()}.`,
      updatedUser,
      200
    );
  } catch (err: any) {
    console.error("PUT /api/admin/users/[id]/role error:", err);
    return apiError("Gagal memperbarui peran pengguna.", 500);
  }
}


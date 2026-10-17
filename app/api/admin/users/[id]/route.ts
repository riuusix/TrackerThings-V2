import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat menghapus akun pengguna.", 403);
    }

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return apiError("ID pengguna tidak valid.", 400);
    }

    if (userId === adminSession.userId) {
      return apiError("Anda tidak dapat menghapus akun administrator Anda sendiri.", 400);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true },
    });

    if (!targetUser) {
      return apiError("Pengguna target tidak ditemukan.", 404);
    }

    // Hapus pengguna (cascade otomatis menghapus jadwal, tugas, ujian, kelasPengganti via Prisma schema relation)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Catat log audit ke database
    await prisma.adminLog.create({
      data: {
        adminUsername: adminSession.username,
        actionType: "DELETE_USER",
        actionDescription: `Menghapus akun pengguna @${targetUser.username} (${targetUser.email}) beserta seluruh data terkait.`,
      },
    });

    return apiSuccess(`Akun pengguna @${targetUser.username} berhasil dihapus dari sistem.`, null, 200);
  } catch (err: any) {
    console.error("DELETE /api/admin/users/[id] error:", err);
    return apiError("Gagal menghapus pengguna dari sistem.", 500);
  }
}


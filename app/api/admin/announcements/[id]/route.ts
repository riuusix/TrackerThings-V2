import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat mengubah pengumuman.", 403);
    }

    const announcementId = BigInt(params.id);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const target = await prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!target) {
      return apiError("Pengumuman tidak ditemukan.", 404);
    }

    const title = typeof body.title === "string" ? body.title.trim() : target.title;
    const content = typeof body.content === "string" ? body.content.trim() : target.content;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : (typeof body.is_active === "boolean" ? body.is_active : target.isActive);

    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title,
        content,
        isActive,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminUsername: adminSession.username,
        actionType: "UPDATE_ANNOUNCEMENT",
        actionDescription: `Memperbarui pengumuman ID #${params.id}: '${title}' (Aktif: ${isActive}).`,
      },
    });

    const formatted = {
      id: Number(updated.id),
      title: updated.title,
      content: updated.content,
      isActive: updated.isActive,
      is_active: updated.isActive,
      createdAt: updated.createdAt ? updated.createdAt.toISOString() : new Date().toISOString(),
    };

    return apiSuccess("Pengumuman berhasil diperbarui!", formatted, 200);
  } catch (err: any) {
    console.error("PUT /api/admin/announcements/[id] error:", err);
    return apiError("Gagal memperbarui pengumuman.", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat menghapus pengumuman.", 403);
    }

    const announcementId = BigInt(params.id);
    const target = await prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!target) {
      return apiError("Pengumuman tidak ditemukan.", 404);
    }

    await prisma.announcement.delete({
      where: { id: announcementId },
    });

    await prisma.adminLog.create({
      data: {
        adminUsername: adminSession.username,
        actionType: "DELETE_ANNOUNCEMENT",
        actionDescription: `Menghapus pengumuman: '${target.title}'.`,
      },
    });

    return apiSuccess(`Pengumuman '${target.title}' berhasil dihapus.`, null, 200);
  } catch (err: any) {
    console.error("DELETE /api/admin/announcements/[id] error:", err);
    return apiError("Gagal menghapus pengumuman.", 500);
  }
}


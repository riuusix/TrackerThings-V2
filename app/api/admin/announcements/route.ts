import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat melihat daftar pengumuman admin.", 403);
    }

    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formatted = announcements.map((a) => ({
      id: Number(a.id),
      title: a.title,
      content: a.content,
      isActive: a.isActive,
      is_active: a.isActive,
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString(),
      created_at: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString(),
    }));

    return apiSuccess("Daftar pengumuman berhasil dimuat.", formatted, 200, { announcements: formatted });
  } catch (err: any) {
    console.error("GET /api/admin/announcements error:", err);
    return apiError("Gagal memuat daftar pengumuman.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat membuat pengumuman.", 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const isActive = typeof body.isActive === "boolean" ? body.isActive : (typeof body.is_active === "boolean" ? body.is_active : true);

    if (!title || !content) {
      return apiError("Judul dan isi pengumuman wajib diisi.", 400);
    }

    const created = await prisma.announcement.create({
      data: {
        title,
        content,
        isActive,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminUsername: adminSession.username,
        actionType: "CREATE_ANNOUNCEMENT",
        actionDescription: `Membuat pengumuman baru: '${title}'.`,
      },
    });

    const formatted = {
      id: Number(created.id),
      title: created.title,
      content: created.content,
      isActive: created.isActive,
      is_active: created.isActive,
      createdAt: created.createdAt ? created.createdAt.toISOString() : new Date().toISOString(),
    };

    return apiSuccess("Pengumuman berhasil diterbitkan!", formatted, 201);
  } catch (err: any) {
    console.error("POST /api/admin/announcements error:", err);
    return apiError("Gagal menerbitkan pengumuman.", 500);
  }
}


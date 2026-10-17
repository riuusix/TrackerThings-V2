import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      return apiError("Akses ditolak: Hanya Administrator yang dapat melihat daftar pengguna.", 403);
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      full_name: u.fullName,
      phoneNumber: u.phoneNumber,
      phone_number: u.phoneNumber,
      role: u.role || "mahasiswa",
      createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
      created_at: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
    }));

    return apiSuccess("Daftar pengguna berhasil dimuat.", formatted, 200, { users: formatted });
  } catch (err: any) {
    console.error("GET /api/admin/users error:", err);
    return apiError("Gagal memuat daftar pengguna.", 500);
  }
}


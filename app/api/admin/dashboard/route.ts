import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, requireAdminSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) {
      const session = await getAuthSession(req);
      if (!session) {
        return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
      }
      return apiError("Akses ditolak: Fitur ini hanya dapat diakses oleh Administrator.", 403);
    }

    // Query metrik sistem secara paralel via Prisma
    const [
      totalUsers,
      totalTasks,
      totalCourses,
      totalExams,
      totalReplacements,
      recentUsersDb,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.tugas.count(),
      prisma.jadwal.count(),
      prisma.ujian.count(),
      prisma.kelasPengganti.count(),
      prisma.user.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    const recentUsers = recentUsersDb.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName || null,
      full_name: u.fullName || null,
      role: u.role || "user",
      createdAt: u.createdAt ? u.createdAt.toISOString() : null,
      created_at: u.createdAt ? u.createdAt.toISOString() : null,
    }));

    const metrics = {
      totalUsers,
      total_users: totalUsers,
      totalTasks,
      total_tasks: totalTasks,
      totalCourses,
      total_courses: totalCourses,
      totalExams,
      total_exams: totalExams,
      totalReplacements,
      total_replacements: totalReplacements,
      serverTime: new Date().toISOString(),
      server_time: new Date().toISOString(),
      systemStatus: "Healthy",
      system_status: "Healthy",
      recentUsers,
      recent_users: recentUsers,
    };

    return apiSuccess("Data metrik sistem admin berhasil dimuat.", metrics, 200, { metrics });
  } catch (err: any) {
    console.error("GET /api/admin/dashboard error:", err);
    return apiError("Terjadi kesalahan internal pada server admin.", 500);
  }
}


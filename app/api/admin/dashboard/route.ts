import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
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

    const supabase = await getSupabaseServerClient();

    // Query metrik sistem secara paralel
    const [
      usersCountRes,
      tasksCountRes,
      coursesCountRes,
      examsCountRes,
      replacementsCountRes,
      recentUsersRes,
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("tugas").select("*", { count: "exact", head: true }),
      supabase.from("jadwal").select("*", { count: "exact", head: true }),
      supabase.from("ujian").select("*", { count: "exact", head: true }),
      supabase.from("kelas_pengganti").select("*", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("id, username, email, full_name, role, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (
      usersCountRes.error ||
      tasksCountRes.error ||
      coursesCountRes.error ||
      examsCountRes.error ||
      replacementsCountRes.error ||
      recentUsersRes.error
    ) {
      console.error("Database query error in admin dashboard:", {
        usersErr: usersCountRes.error,
        tasksErr: tasksCountRes.error,
        coursesErr: coursesCountRes.error,
        examsErr: examsCountRes.error,
        replacementsErr: replacementsCountRes.error,
        recentUsersErr: recentUsersRes.error,
      });
      return apiError("Gagal memuat metrik dashboard admin dari database.", 500);
    }

    const totalUsers = usersCountRes.count ?? 0;
    const totalTasks = tasksCountRes.count ?? 0;
    const totalCourses = coursesCountRes.count ?? 0;
    const totalExams = examsCountRes.count ?? 0;
    const totalReplacements = replacementsCountRes.count ?? 0;

    const recentUsers = (recentUsersRes.data || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.full_name || null,
      full_name: u.full_name || null,
      role: u.role || "user",
      createdAt: u.created_at,
      created_at: u.created_at,
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


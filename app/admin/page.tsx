import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?from=/admin");
  }

  // Strict database role verification - no username fallback
  const currentUserData = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { username: true, email: true, role: true },
  });

  const userRole = (currentUserData?.role || "").toLowerCase();
  if (userRole !== "admin") {
    redirect("/dashboard");
  }

  // Query actual system metrics, recent users, and audit logs
  const [
    totalUsers,
    totalCourses,
    totalTasks,
    totalExams,
    totalReplacements,
    activeAnnouncements,
    rawRecentUsers,
    rawRecentLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.jadwal.count(),
    prisma.tugas.count(),
    prisma.ujian.count(),
    prisma.kelasPengganti.count(),
    prisma.announcement.count({ where: { isActive: true } }),
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
    prisma.adminLog.findMany({
      take: 5,
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const recentUsers = rawRecentUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName || null,
    role: u.role || "user",
    createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
  }));

  const recentLogs = rawRecentLogs.map((l) => ({
    id: l.id.toString(),
    adminUsername: l.adminUsername,
    actionType: l.actionType,
    actionDescription: l.actionDescription,
    timestamp: l.timestamp ? l.timestamp.toISOString() : new Date().toISOString(),
  }));

  const metrics = {
    totalUsers,
    totalCourses,
    totalTasks,
    totalExams,
    totalReplacements,
    activeAnnouncements,
    serverTime: new Date().toISOString(),
    systemStatus: "Healthy",
  };

  return (
    <AdminDashboardClient
      currentUsername={currentUserData?.username || session.username}
      currentUserEmail={currentUserData?.email || session.email}
      role={userRole}
      metrics={metrics}
      recentUsers={recentUsers}
      recentLogs={recentLogs}
    />
  );
}


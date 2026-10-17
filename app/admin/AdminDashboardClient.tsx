"use client";

import Link from "next/link";
import {
  Shield,
  Users,
  BookOpen,
  CheckSquare,
  GraduationCap,
  Calendar,
  Megaphone,
  Activity,
  ArrowRight,
  Clock,
  UserCheck,
  Server,
  FileText,
} from "lucide-react";

interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: string;
}

interface AdminLogSummary {
  id: string;
  adminUsername: string;
  actionType: string;
  actionDescription: string;
  timestamp: string;
}

interface AdminDashboardClientProps {
  currentUsername: string;
  currentUserEmail: string;
  role: string;
  metrics: {
    totalUsers: number;
    totalCourses: number;
    totalTasks: number;
    totalExams: number;
    totalReplacements: number;
    activeAnnouncements: number;
    serverTime: string;
    systemStatus: string;
  };
  recentUsers: AdminUserSummary[];
  recentLogs: AdminLogSummary[];
}

export function AdminDashboardClient({
  currentUsername,
  currentUserEmail,
  role,
  metrics,
  recentUsers,
  recentLogs,
}: AdminDashboardClientProps) {
  const statCards = [
    {
      title: "Total Pengguna",
      value: metrics.totalUsers,
      desc: "Akun terdaftar dalam sistem",
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40",
      href: "/admin/users",
    },
    {
      title: "Mata Kuliah",
      value: metrics.totalCourses,
      desc: "Jadwal kuliah mahasiswa",
      icon: BookOpen,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40",
      href: "/matakuliah",
    },
    {
      title: "Tugas Kuliah",
      value: metrics.totalTasks,
      desc: "Tugas dicatat di platform",
      icon: CheckSquare,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40",
      href: "/dashboard",
    },
    {
      title: "Jadwal Ujian",
      value: metrics.totalExams,
      desc: "UTS & UAS aktif",
      icon: GraduationCap,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40",
      href: "/ujian",
    },
    {
      title: "Kelas Pengganti",
      value: metrics.totalReplacements,
      desc: "Sesi pengganti diajukan",
      icon: Calendar,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40",
      href: "/history",
    },
    {
      title: "Pengumuman Aktif",
      value: metrics.activeAnnouncements,
      desc: "Siaran untuk mahasiswa",
      icon: Megaphone,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40",
      href: "/admin/announcements",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8 pb-20">
      {/* Header Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                Admin Center
              </span>
              <span>/</span>
              <span className="text-slate-700 dark:text-slate-200">Dashboard Utama</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Shield className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span>Panel Administrator</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Pusat kendali, pemantauan metrik sistem, manajemen akun pengguna, dan pengelolaan pengumuman.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Link
              href="/admin/users"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>Kelola Pengguna</span>
            </Link>

            <Link
              href="/admin/announcements"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Megaphone className="w-4 h-4" />
              <span>Kelola Pengumuman</span>
            </Link>
          </div>
        </div>

        {/* System Health Status Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Status Server:</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {metrics.systemStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Database PostgreSQL terhubung normal dan melayani kueri tanpa hambatan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>Waktu Server: {new Date(metrics.serverTime).toLocaleString("id-ID")}</span>
          </div>
        </div>

        {/* Metric Bento Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className={`p-5 rounded-2xl border transition-all hover:shadow-md hover:scale-[1.01] block group ${card.bg}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-6 h-6 ${card.color}`} />
                  <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  {card.value.toLocaleString()}
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                  {card.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {card.desc}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Two Column Section: Recent Users & Admin Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Users Table */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Pengguna Baru Terdaftar</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Akun terbaru yang mendaftar ke TrackerThings V2
                </p>
              </div>

              <Link
                href="/admin/users"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
                    <th className="py-2">Pengguna</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Peran</th>
                    <th className="py-2">Tanggal Daftar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 font-bold text-slate-800 dark:text-slate-100">
                        {u.fullName || `@${u.username}`}
                        {u.fullName && <div className="text-[10px] text-slate-400 font-normal">@{u.username}</div>}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            u.role.toLowerCase() === "admin"
                              ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Audit Logs */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  <span>Log Audit Sistem</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aktivitas administratif terbaru
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada log aktivitas admin tercatat.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        @{log.adminUsername}
                      </span>
                      <span>
                        {new Date(log.timestamp).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {log.actionType}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {log.actionDescription}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
    </div>
  );
}


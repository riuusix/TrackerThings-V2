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
      color: "text-accent",
      badgeBg: "bg-accent-muted text-accent border-line-subtle",
      href: "/admin/users",
    },
    {
      title: "Mata Kuliah",
      value: metrics.totalCourses,
      desc: "Jadwal kuliah mahasiswa",
      icon: BookOpen,
      color: "text-sky-600 dark:text-sky-400",
      badgeBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      href: "/matakuliah",
    },
    {
      title: "Tugas Kuliah",
      value: metrics.totalTasks,
      desc: "Tugas dicatat di platform",
      icon: CheckSquare,
      color: "text-amber-600 dark:text-amber-400",
      badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      href: "/dashboard",
    },
    {
      title: "Jadwal Ujian",
      value: metrics.totalExams,
      desc: "UTS & UAS aktif",
      icon: GraduationCap,
      color: "text-rose-600 dark:text-rose-400",
      badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      href: "/ujian",
    },
    {
      title: "Kelas Pengganti",
      value: metrics.totalReplacements,
      desc: "Sesi pengganti diajukan",
      icon: Calendar,
      color: "text-emerald-600 dark:text-emerald-400",
      badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      href: "/history",
    },
    {
      title: "Pengumuman Aktif",
      value: metrics.activeAnnouncements,
      desc: "Siaran untuk mahasiswa",
      icon: Megaphone,
      color: "text-accent",
      badgeBg: "bg-accent-muted text-accent border-line-subtle",
      href: "/admin/announcements",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8 pb-20">
      {/* Header Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-content-secondary mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-accent-muted text-accent font-bold border border-line-subtle">
              Admin Center
            </span>
            <span className="text-content-muted">/</span>
            <span className="text-content-primary font-medium">Dashboard Utama</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-content-primary flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-accent" />
            <span>Panel Administrator</span>
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Pusat kendali, pemantauan metrik sistem, manajemen akun pengguna, dan pengelolaan pengumuman.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/admin/users"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-surface hover:bg-surface-elevated border border-line text-content-primary shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Users className="w-4 h-4 text-accent" />
            <span>Kelola Pengguna</span>
          </Link>

          <Link
            href="/admin/announcements"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Megaphone className="w-4 h-4" />
            <span>Kelola Pengumuman</span>
          </Link>
        </div>
      </div>

      {/* System Health Status Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-content-primary">Status Server:</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {metrics.systemStatus}
              </span>
            </div>
            <p className="text-xs text-content-secondary">
              Database PostgreSQL terhubung normal dan melayani kueri tanpa hambatan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-content-muted self-start sm:self-auto">
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
              className="p-5 rounded-2xl bg-surface hover:bg-surface-elevated border border-line hover:border-accent/40 shadow-xs transition-all hover:scale-[1.01] block group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl border ${card.badgeBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-content-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-content-primary">
                {card.value.toLocaleString()}
              </div>
              <div className="text-xs font-bold text-content-secondary mt-1">
                {card.title}
              </div>
              <div className="text-[11px] text-content-muted mt-0.5">
                {card.desc}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Two Column Section: Recent Users & Admin Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Users Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface border border-line shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-content-primary flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                <span>Pengguna Baru Terdaftar</span>
              </h2>
              <p className="text-xs text-content-secondary">
                Akun terbaru yang mendaftar ke TrackerThings V2
              </p>
            </div>

            <Link
              href="/admin/users"
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-line overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-content-muted font-semibold border-b border-line pb-2">
                  <th className="py-2.5">Pengguna</th>
                  <th className="py-2.5">Email</th>
                  <th className="py-2.5">Peran</th>
                  <th className="py-2.5">Tanggal Daftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="py-3 font-bold text-content-primary">
                      {u.fullName || `@${u.username}`}
                      {u.fullName && <div className="text-[10px] text-content-muted font-normal">@{u.username}</div>}
                    </td>
                    <td className="py-3 text-content-secondary">{u.email}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          u.role.toLowerCase() === "admin"
                            ? "bg-accent-muted text-accent border-line-subtle"
                            : "bg-surface-elevated text-content-secondary border-line"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 text-content-muted">
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
        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-content-primary flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" />
                <span>Log Audit Sistem</span>
              </h2>
              <p className="text-xs text-content-secondary">
                Aktivitas administratif terbaru
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-content-muted text-xs">
                Belum ada log aktivitas admin tercatat.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-surface-elevated/70 border border-line text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-content-muted">
                    <span className="font-bold text-accent">
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
                  <div className="font-semibold text-content-primary">
                    {log.actionType}
                  </div>
                  <p className="text-[11px] text-content-secondary">
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


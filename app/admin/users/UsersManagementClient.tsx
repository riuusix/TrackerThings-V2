"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Users,
  Search,
  Shield,
  UserCheck,
  UserX,
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MoreVertical,
  CheckCircle2,
  Trash2,
  KeyRound,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface UserItem {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  phone_number?: string | null;
  role?: string | null;
  created_at: string;
}

interface UsersManagementClientProps {
  initialUsers: UserItem[];
  currentUsername: string;
  currentUserEmail: string;
  role: string;
}

export function UsersManagementClient({
  initialUsers,
  currentUsername,
  currentUserEmail,
  role,
}: UsersManagementClientProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const userRole = u.role?.toLowerCase() === "admin" ? "admin" : "user";
    const matchesRole = roleFilter === "all" || userRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalAdmin = users.filter((u) => u.role?.toLowerCase() === "admin").length;
  const totalStudents = users.length - totalAdmin;

  const handleToggleRole = (userId: number, currentRole?: string | null) => {
    if (processingUserId !== null) return;
    const newRole = currentRole?.toLowerCase() === "admin" ? "user" : "admin";
    if (!confirm(`Ubah role user ini menjadi ${newRole.toUpperCase()}?`)) return;

    setProcessingUserId(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setActionMessage(`Role pengguna ID #${userId} berhasil diperbarui menjadi ${newRole.toUpperCase()}.`);
    setTimeout(() => {
      setProcessingUserId(null);
      setActionMessage(null);
    }, 1500);
  };

  const handleResetPassword = (username: string, userId: number) => {
    if (processingUserId !== null) return;
    if (!confirm(`Kirim instruksi reset password darurat untuk user @${username}?`)) return;
    setProcessingUserId(userId);
    setActionMessage(`Instruksi reset password darurat telah dikirimkan ke email terdaftar @${username}.`);
    setTimeout(() => {
      setProcessingUserId(null);
      setActionMessage(null);
    }, 1500);
  };

  const handleDeleteUser = (userId: number, username: string) => {
    if (processingUserId !== null) return;
    if (!confirm(`PERINGATAN: Hapus permanen akun @${username}? Seluruh data jadwal dan tugas akan terhapus.`)) return;
    setProcessingUserId(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setActionMessage(`Akun pengguna @${username} berhasil dihapus dari sistem.`);
    setTimeout(() => {
      setProcessingUserId(null);
      setActionMessage(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors pb-20">
      <Navbar
        username={currentUsername}
        userEmail={currentUserEmail}
        role={role}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Navigation Breadcrumbs & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              <Link href="/dashboard" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <span>/</span>
              <span className="text-blue-600 dark:text-blue-400">Panel Administrator</span>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200">Manajemen User</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span>Manajemen Pengguna</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Kelola data seluruh akun mahasiswa, tetapkan hak akses admin, dan lakukan pemeliharaan akun.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/admin/announcements"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
            >
              Kelola Pengumuman
            </Link>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionMessage && (
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in-50 duration-200">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Akun Terdaftar
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {users.length}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Termasuk admin & mahasiswa</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Administrator Sistem
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {totalAdmin}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Memiliki akses panel kendali</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Mahasiswa Aktif
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {totalStudents}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Pengguna akademik reguler</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, username, atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Peran</option>
              <option value="admin">Administrator</option>
              <option value="user">Mahasiswa</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Pengguna</th>
                  <th className="px-5 py-3.5">Kontak</th>
                  <th className="px-5 py-3.5">Peran (Role)</th>
                  <th className="px-5 py-3.5">Terdaftar Sejak</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      Tidak ada pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isUserAdmin = user.role?.toLowerCase() === "admin";
                    const initial = user.username.charAt(0).toUpperCase();
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                              {initial}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-100">
                                {user.full_name || user.username}
                              </div>
                              <div className="text-xs text-slate-400">@{user.username}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{user.email}</span>
                            </div>
                            {user.phone_number && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{user.phone_number}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {isUserAdmin ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                              <Shield className="w-3 h-3" />
                              Administrator
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Mahasiswa
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(user.created_at).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(user.id, user.role)}
                              disabled={processingUserId !== null}
                              title={isUserAdmin ? "Jadikan Mahasiswa Reguler" : "Angkat Jadi Admin"}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                            >
                              {processingUserId === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              ) : isUserAdmin ? (
                                <UserX className="w-4 h-4 text-amber-500" />
                              ) : (
                                <UserCheck className="w-4 h-4 text-blue-600" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResetPassword(user.username, user.id)}
                              disabled={processingUserId !== null}
                              title="Reset Password Pengguna"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                            >
                              <KeyRound className="w-4 h-4 text-slate-500" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              disabled={processingUserId !== null}
                              title="Hapus Akun Pengguna"
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

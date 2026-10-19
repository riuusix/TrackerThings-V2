"use client";

import { useState } from "react";
import Link from "next/link";
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

  const handleToggleRole = async (userId: number, currentRole?: string | null) => {
    if (processingUserId !== null) return;
    const newRole = currentRole?.toLowerCase() === "admin" ? "user" : "admin";
    if (!confirm(`Ubah role pengguna ini menjadi ${newRole.toUpperCase()}?`)) return;

    setProcessingUserId(userId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Gagal memperbarui peran pengguna.");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setActionMessage(`Hak akses pengguna ID #${userId} berhasil diperbarui menjadi ${newRole.toUpperCase()}.`);
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setProcessingUserId(null);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleResetPassword = (username: string, userId?: number) => {
    setActionMessage(`Fitur reset kata sandi email dinonaktifkan sementara sesuai konfigurasi sistem.`);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (processingUserId !== null) return;
    if (!confirm(`PERINGATAN: Hapus permanen akun @${username}? Seluruh data jadwal, tugas, dan ujian akan terhapus secara permanen.`)) return;

    setProcessingUserId(userId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Gagal menghapus akun pengguna.");
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setActionMessage(`Akun pengguna @${username} berhasil dihapus dari sistem.`);
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setProcessingUserId(null);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 pb-20">
      {/* Navigation Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-content-secondary mb-1.5">
            <Link href="/admin" className="hover:text-accent transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
            <span className="text-content-muted">/</span>
            <span className="text-content-primary font-medium">Manajemen User</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-content-primary flex items-center gap-2.5">
            <Users className="w-7 h-7 text-accent" />
            <span>Manajemen Pengguna</span>
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Kelola data seluruh akun mahasiswa, tetapkan hak akses admin, dan lakukan pemeliharaan akun.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/admin/announcements"
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-surface hover:bg-surface-elevated border border-line text-content-primary hover:border-accent/40 transition-all shadow-xs"
          >
            Kelola Pengumuman
          </Link>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-accent-muted border border-line-subtle text-accent text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in-50 duration-200">
          <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
            Total Akun Terdaftar
          </span>
          <div className="text-2xl sm:text-3xl font-black text-content-primary mt-1">
            {users.length}
          </div>
          <span className="text-xs text-content-muted mt-0.5 block">Termasuk admin & mahasiswa</span>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">
            Administrator Sistem
          </span>
          <div className="text-2xl sm:text-3xl font-black text-accent mt-1">
            {totalAdmin}
          </div>
          <span className="text-xs text-content-muted mt-0.5 block">Memiliki akses panel kendali</span>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-line shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Mahasiswa Aktif
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {totalStudents}
          </div>
          <span className="text-xs text-content-muted mt-0.5 block">Pengguna akademik reguler</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-line shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, username, atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-elevated border border-line text-xs sm:text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl bg-surface-elevated border border-line text-xs sm:text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">Semua Peran</option>
            <option value="admin">Administrator</option>
            <option value="user">Mahasiswa</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl bg-surface border border-line shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-surface-elevated/70 border-b border-line text-content-secondary font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Pengguna</th>
                <th className="px-5 py-3.5">Kontak</th>
                <th className="px-5 py-3.5">Peran (Role)</th>
                <th className="px-5 py-3.5">Terdaftar Sejak</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-content-muted">
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
                      className="hover:bg-surface-elevated/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-accent-text font-bold text-sm shadow-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-content-primary">
                              {user.full_name || user.username}
                            </div>
                            <div className="text-xs text-content-muted">@{user.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-content-secondary">
                            <Mail className="w-3.5 h-3.5 text-content-muted shrink-0" />
                            <span className="truncate max-w-[200px]">{user.email}</span>
                          </div>
                          {user.phone_number && (
                            <div className="flex items-center gap-1.5 text-xs text-content-muted">
                              <Phone className="w-3.5 h-3.5 text-content-muted shrink-0" />
                              <span>{user.phone_number}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-accent-muted text-accent border border-line-subtle">
                            <Shield className="w-3 h-3" />
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-surface-elevated text-content-secondary border border-line">
                            Mahasiswa
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-content-muted">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-content-muted" />
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
                            aria-label={isUserAdmin ? "Jadikan Mahasiswa Reguler" : "Angkat Jadi Admin"}
                            className="p-2 rounded-lg bg-surface-elevated hover:bg-surface text-content-secondary hover:text-content-primary border border-line hover:border-accent/40 transition-colors disabled:opacity-50"
                          >
                            {processingUserId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            ) : isUserAdmin ? (
                              <UserX className="w-4 h-4 text-amber-500" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-accent" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetPassword(user.username, user.id)}
                            disabled={processingUserId !== null}
                            title="Reset Password Pengguna"
                            aria-label="Reset Password Pengguna"
                            className="p-2 rounded-lg bg-surface-elevated hover:bg-surface text-content-secondary hover:text-content-primary border border-line transition-colors disabled:opacity-50"
                          >
                            <KeyRound className="w-4 h-4 text-content-muted" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            disabled={processingUserId !== null}
                            title="Hapus Akun Pengguna"
                            aria-label="Hapus Akun Pengguna"
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors disabled:opacity-50"
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
    </div>
  );
}

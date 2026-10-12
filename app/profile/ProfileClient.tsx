"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Modal } from "@/components/Modal";
import { UserProfile } from "@/types";
import { updateProfileAction } from "@/app/actions/profile";
import { formatIndonesianDate } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  ListTodo,
  CheckCircle2,
  Edit2,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface ProfileClientProps {
  user: UserProfile;
  stats: {
    totalCourses: number;
    totalTasks: number;
    completedTasks: number;
  };
}

export function ProfileClient({ user, stats }: ProfileClientProps) {
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const completionRate =
    stats.totalTasks > 0
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const res = await updateProfileAction(formData);
        if (res.success) {
          setIsEditModalOpen(false);
          showSuccess("Profil pengguna berhasil diperbarui!");
          router.refresh();
        } else {
          const friendly = classifyApiError(res.error, "Gagal memperbarui profil.");
          setError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal memproses pembaruan profil.");
        setError(friendly);
        showError(friendly);
      }
    });
  };

  return (
    <div className="min-h-screen pb-16">
      <Navbar username={user.username} userEmail={user.email} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <div className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Informasi Pengguna
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Profil Mahasiswa
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Lihat detail identitas akun dan statistik pencapaian studi Anda.
          </p>
        </div>

        {/* User Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-white/60 dark:border-white/10">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-extrabold shadow-xl shadow-indigo-500/25 shrink-0 overflow-hidden">
            {user.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profilePictureUrl}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {user.fullName || user.username}
                </h2>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  @{user.username}
                </p>
              </div>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all self-center sm:self-auto"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profil</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>

              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{user.phoneNumber || "Belum diatur"}</span>
              </div>

              <div className="flex items-center gap-2 justify-center sm:justify-start sm:col-span-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Terdaftar sejak {formatIndonesianDate(user.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="glass-card rounded-2xl p-6 border border-white/60 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Mata Kuliah
              </span>
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {stats.totalCourses}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total mata kuliah semester ini</p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/60 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Tugas
              </span>
              <ListTodo className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {stats.totalTasks}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.completedTasks} dari {stats.totalTasks} telah selesai
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/60 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tingkat Selesai
              </span>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {completionRate}%
            </div>
            <p className="text-xs text-slate-400 mt-1">Persentase keberhasilan tugas</p>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profil Pengguna"
        description="Perbarui informasi data diri Anda."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              name="full_name"
              defaultValue={user.fullName || ""}
              placeholder="Nama lengkap Anda"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              defaultValue={user.email}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nomor WhatsApp / HP
            </label>
            <input
              type="tel"
              name="phone_number"
              defaultValue={user.phoneNumber || ""}
              placeholder="081234567890"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              URL Foto Profil (Opsional)
            </label>
            <input
              type="url"
              name="profile_picture_url"
              defaultValue={user.profilePictureUrl || ""}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[150px] rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Profil</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

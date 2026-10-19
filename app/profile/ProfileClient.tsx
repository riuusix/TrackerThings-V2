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
  Trash2,
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
  const [currentUser, setCurrentUser] = useState<UserProfile>(user);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const completionRate =
    stats.totalTasks > 0
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showError("Ukuran file melebihi batas maksimal 2 MB.");
      e.target.value = "";
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showError("Format file tidak didukung. Harap pilih gambar JPEG, PNG, atau WebP.");
      e.target.value = "";
      return;
    }

    // Buat pratinjau lokal instan sebelum request selesai
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setAvatarError(false);
    setIsUploadingPhoto(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newAvatarUrl = data.data?.profilePictureUrl || data.user?.profilePictureUrl;
        setCurrentUser((prev) => ({ ...prev, profilePictureUrl: newAvatarUrl }));
        setLocalPreview(null);
        showSuccess("Foto profil berhasil diperbarui!");
        router.refresh();
      } else {
        setLocalPreview(null);
        const msg = data.error || data.message || "Gagal mengunggah foto profil.";
        showError(classifyApiError(msg, "Gagal mengunggah foto profil."));
      }
    } catch (uploadErr) {
      setLocalPreview(null);
      showError(classifyApiError(uploadErr, "Gagal menghubungi server saat mengunggah foto."));
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (isUploadingPhoto || !currentUser.profilePictureUrl) return;
    setIsUploadingPhoto(true);
    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser((prev) => ({ ...prev, profilePictureUrl: null }));
        setLocalPreview(null);
        setAvatarError(false);
        showSuccess("Foto profil berhasil dihapus.");
        router.refresh();
      } else {
        const msg = data.error || data.message || "Gagal menghapus foto profil.";
        showError(classifyApiError(msg, "Gagal menghapus foto profil."));
      }
    } catch (err) {
      showError(classifyApiError(err, "Gagal menghubungi server saat menghapus foto profil."));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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
    <div className="min-h-screen bg-canvas text-content-primary pb-16">
      <Navbar
        username={currentUser.username}
        userEmail={currentUser.email}
        profilePictureUrl={currentUser.profilePictureUrl}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <div className="pb-2 border-b border-line">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-accent-muted text-accent border border-line-subtle">
              Informasi Pengguna
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
            Profil Mahasiswa
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Lihat detail identitas akun dan statistik pencapaian studi Anda.
          </p>
        </div>

        {/* User Card */}
        <div className="bg-surface-elevated border border-line rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-xs">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-accent text-accent-text flex items-center justify-center text-3xl font-extrabold shadow-sm overflow-hidden">
                {localPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={localPreview}
                    alt="Pratinjau Foto"
                    className="w-full h-full object-cover"
                  />
                ) : currentUser.profilePictureUrl && !avatarError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.profilePictureUrl}
                    alt={currentUser.username}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  currentUser.username.charAt(0).toUpperCase()
                )}
              </div>

              <label className="absolute inset-0 bg-black/55 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-xs font-semibold backdrop-blur-[2px]">
                {isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 mb-1" />
                    <span>Ubah</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingPhoto}
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {/* Contextual Uploading or Delete Button */}
            {isUploadingPhoto ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Mengunggah...</span>
              </span>
            ) : currentUser.profilePictureUrl ? (
              <button
                type="button"
                onClick={handleDeletePhoto}
                disabled={isUploadingPhoto}
                className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-semibold transition-colors mt-0.5 hover:underline disabled:opacity-50"
                title="Hapus foto profil"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Foto</span>
              </button>
            ) : null}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-content-primary">
                  {currentUser.fullName || currentUser.username}
                </h2>
                <p className="text-sm text-accent font-medium">
                  @{currentUser.username}
                </p>
              </div>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-content-primary bg-surface hover:bg-surface-hover border border-line shadow-xs transition-all self-center sm:self-auto active:scale-95"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profil</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-content-secondary pt-3 border-t border-line">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>

              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{user.phoneNumber || "Belum diatur"}</span>
              </div>

              <div className="flex items-center gap-2 justify-center sm:justify-start sm:col-span-2">
                <Calendar className="w-4 h-4 text-content-muted shrink-0" />
                <span>Terdaftar sejak {formatIndonesianDate(user.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-surface-elevated border border-line hover:border-line-strong rounded-2xl p-6 shadow-xs transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Mata Kuliah
              </span>
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <div className="text-3xl font-extrabold text-content-primary">
              {stats.totalCourses}
            </div>
            <p className="text-xs text-content-muted mt-1">Total mata kuliah semester ini</p>
          </div>

          <div className="bg-surface-elevated border border-line hover:border-line-strong rounded-2xl p-6 shadow-xs transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Total Tugas
              </span>
              <ListTodo className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-content-primary">
              {stats.totalTasks}
            </div>
            <p className="text-xs text-content-muted mt-1">
              {stats.completedTasks} dari {stats.totalTasks} telah selesai
            </p>
          </div>

          <div className="bg-surface-elevated border border-line hover:border-line-strong rounded-2xl p-6 shadow-xs transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Tingkat Selesai
              </span>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {completionRate}%
            </div>
            <p className="text-xs text-content-muted mt-1">Persentase keberhasilan tugas</p>
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
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              name="full_name"
              defaultValue={user.fullName || ""}
              placeholder="Nama lengkap Anda"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              defaultValue={user.email}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Nomor WhatsApp / HP
            </label>
            <input
              type="tel"
              name="phone_number"
              defaultValue={user.phoneNumber || ""}
              placeholder="081234567890"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              URL Foto Profil (Opsional)
            </label>
            <input
              type="url"
              name="profile_picture_url"
              defaultValue={user.profilePictureUrl || ""}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-content-secondary hover:text-content-primary hover:bg-surface transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[150px] rounded-xl text-sm font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50"
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

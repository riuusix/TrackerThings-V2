"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Modal } from "@/components/Modal";
import { UserProfile } from "@/types";
import { updateProfileAction } from "@/app/actions/profile";
import { formatIndonesianDate } from "@/lib/utils";
import {
  Mail,
  Phone,
  Calendar,
  BookOpen,
  ListTodo,
  TrendingUp,
  Edit2,
  Trash2,
  Loader2,
  ShieldCheck,
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
          if (res.user) {
            setCurrentUser((prev) => ({
              ...prev,
              username: res.user.username,
              fullName: res.user.fullName,
              email: res.user.email,
              phoneNumber: res.user.phoneNumber,
              profilePictureUrl: res.user.profilePictureUrl,
            }));
          }
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

  const userInitial = (currentUser.fullName || currentUser.username || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const userRole =
    (currentUser.role || "user").toLowerCase() === "admin"
      ? "Administrator"
      : "Mahasiswa";

  return (
    <div className="min-h-screen bg-canvas text-content-primary pb-20">
      <Navbar
        username={currentUser.username}
        userEmail={currentUser.email}
        role={currentUser.role || "user"}
        profilePictureUrl={currentUser.profilePictureUrl}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 space-y-7">
        {/* Editorial Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-xs text-content-secondary font-medium">
              <span className="text-accent font-semibold">Akun & Identitas Mahasiswa</span>
              <span className="text-content-muted">·</span>
              <span className="text-content-muted">Semester Aktif 2026/2027</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
              Profil Pengguna
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary mt-1">
              Kelola informasi identitas akun, kredensial masuk, dan pantau pencapaian akademik Anda.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsEditModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-content-primary bg-surface-elevated hover:bg-surface border border-line shadow-2xs transition-all self-start sm:self-auto active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5 text-accent" />
            <span>Edit Profil</span>
          </button>
        </header>

        {/* 1. Main Identity & Profile Dossier Surface */}
        <section className="bg-surface-elevated border border-line rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-7 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {/* Avatar Surface */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-accent text-accent-text flex items-center justify-center text-3xl font-black shadow-2xs overflow-hidden">
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
                    <span>{userInitial}</span>
                  )}
                </div>

                <label className="absolute inset-0 bg-black/60 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-xs font-semibold backdrop-blur-[2px]">
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

              {isUploadingPhoto ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-accent animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Mengunggah...</span>
                </span>
              ) : currentUser.profilePictureUrl ? (
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  disabled={isUploadingPhoto}
                  className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-semibold transition-colors hover:underline disabled:opacity-50"
                  title="Hapus foto profil"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Foto</span>
                </button>
              ) : null}
            </div>

            {/* Identity Information */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="text-[11px] px-2.5 py-0.5 rounded-md font-bold bg-accent-muted text-accent border border-line-subtle">
                  {userRole}
                </span>
                <span className="text-xs font-mono tabular-nums text-content-muted">
                  ID #{currentUser.id}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-content-primary tracking-tight truncate">
                {currentUser.fullName || currentUser.username}
              </h2>

              <p className="text-sm font-mono font-semibold text-accent mt-0.5">
                @{currentUser.username}
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-mono tabular-nums text-content-muted mt-2">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Terdaftar sejak {formatIndonesianDate(currentUser.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Hairline-Divided Contact Details Strip (Eliminating Card-Inside-Card Nesting) */}
          <div className="border-t border-line bg-surface/40 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line text-xs sm:text-sm">
            <div className="px-5 py-4 flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                  Email Akun
                </div>
                <div className="text-content-primary font-medium truncate mt-0.5">
                  {currentUser.email}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                  WhatsApp / HP
                </div>
                <div className="font-mono tabular-nums text-content-primary font-medium truncate mt-0.5">
                  {currentUser.phoneNumber || "Belum diatur"}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                  Keamanan Akun
                </div>
                <div className="text-content-primary font-medium truncate mt-0.5">
                  {currentUser.passwordChangedAt ? "Kredensial Terproteksi" : "Sandi Aktif"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Connected Academic Achievement & Statistics Panel */}
        <section className="bg-surface-elevated border border-line rounded-2xl p-5 sm:p-7 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-line">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-content-primary tracking-tight">
                Statistik & Beban Studi Akademik
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-0.5 rounded-md bg-surface text-content-secondary border border-line-subtle">
              2026/2027
            </span>
          </div>

          {/* 3 Connected Metric Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-line/70">
            {/* Courses */}
            <div className="flex items-start gap-3.5 sm:px-2 pt-2 sm:pt-0">
              <div className="w-10 h-10 rounded-xl bg-accent-muted border border-line-subtle flex items-center justify-center text-accent shrink-0 mt-0.5">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-content-primary tracking-tight">
                  {stats.totalCourses}
                </div>
                <div className="text-xs font-semibold text-content-secondary mt-0.5">
                  Mata Kuliah Aktif
                </div>
                <p className="text-[11px] text-content-muted mt-0.5">
                  Total kelas terdaftar di semester ini
                </p>
              </div>
            </div>

            {/* Tasks */}
            <div className="flex items-start gap-3.5 sm:px-4 pt-4 sm:pt-0">
              <div className="w-10 h-10 rounded-xl bg-surface border border-line-subtle flex items-center justify-center text-accent shrink-0 mt-0.5">
                <ListTodo className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-content-primary tracking-tight">
                  {stats.totalTasks}
                </div>
                <div className="text-xs font-semibold text-content-secondary mt-0.5">
                  Total Tugas Kuliah
                </div>
                <p className="text-[11px] font-mono tabular-nums text-content-muted mt-0.5">
                  {stats.completedTasks} dari {stats.totalTasks} tugas selesai
                </p>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="flex items-start gap-3.5 sm:px-4 pt-4 sm:pt-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {completionRate}%
                </div>
                <div className="text-xs font-semibold text-content-secondary mt-0.5">
                  Tingkat Penyelesaian
                </div>
                <p className="text-[11px] text-content-muted mt-0.5">
                  Rasio keberhasilan tugas selesai
                </p>
              </div>
            </div>
          </div>

          {/* Integrated Horizontal Progress Bar */}
          <div className="pt-3.5 border-t border-line/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-content-secondary">Progress Keseluruhan Tugas</span>
              <span className="font-mono tabular-nums text-accent font-bold">
                {stats.completedTasks} / {stats.totalTasks} Selesai ({completionRate}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profil Pengguna"
        description="Perbarui informasi data diri dan kredensial akun Anda."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Username Field */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
              Username <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-content-muted font-bold text-sm pointer-events-none">
                @
              </span>
              <input
                type="text"
                name="username"
                required
                defaultValue={currentUser.username}
                placeholder="username"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono font-medium transition-colors"
              />
            </div>
            <p className="text-[11px] text-content-muted mt-1">
              Digunakan untuk masuk ke akun. Huruf, angka, garis bawah (_), titik (.), atau tanda hubung (-) (3-30 karakter).
            </p>
          </div>

          {/* Full Name Field */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              name="full_name"
              defaultValue={currentUser.fullName || ""}
              placeholder="Nama lengkap Anda"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-medium transition-colors"
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              defaultValue={currentUser.email}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-medium transition-colors"
            />
          </div>

          {/* Phone Number Field */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
              Nomor WhatsApp / HP
            </label>
            <input
              type="tel"
              name="phone_number"
              defaultValue={currentUser.phoneNumber || ""}
              placeholder="081234567890"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono font-medium transition-colors"
            />
          </div>

          {/* Profile Picture URL Field */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1.5">
              URL Foto Profil (Opsional)
            </label>
            <input
              type="url"
              name="profile_picture_url"
              defaultValue={currentUser.profilePictureUrl || ""}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-medium transition-colors"
            />
          </div>

          {/* Action Buttons */}
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

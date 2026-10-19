"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Modal } from "@/components/Modal";
import { UjianItem } from "@/types";
import {
  createUjianAction,
  updateUjianAction,
  deleteUjianAction,
} from "@/app/actions/ujian";
import { formatIndonesianDate, getDaysDifference } from "@/lib/utils";
import {
  GraduationCap,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Edit2,
  Trash2,
  Loader2,
  BookOpen,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface UjianClientProps {
  username: string;
  userEmail: string;
  profilePictureUrl?: string | null;
  initialExams: Array<UjianItem & { jadwal?: { namaMatkul: string } }>;
  courses: Array<{ id: number; namaMatkul: string }>;
}

const JENIS_UJIAN_OPTIONS = ["UTS", "UAS", "Kuis", "Responsi", "Praktikum"];

export function UjianClient({
  username,
  userEmail,
  profilePictureUrl,
  initialExams,
  courses,
}: UjianClientProps) {
  const router = useRouter();
  const [exams, setExams] = useState(initialExams);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<(UjianItem & { jadwal?: { namaMatkul: string } }) | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    setExams(initialExams);
  }, [initialExams]);

  const handleOpenAdd = () => {
    setExamToEdit(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exam: UjianItem & { jadwal?: { namaMatkul: string } }) => {
    setExamToEdit(exam);
    setError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (exam: UjianItem) => {
    if (deletingId !== null) return;
    if (!confirm("Hapus jadwal ujian ini?")) return;
    setDeletingId(exam.id);
    try {
      const res = await deleteUjianAction(exam.id);
      if (res.success) {
        setExams(exams.filter((e) => e.id !== exam.id));
        showSuccess("Jadwal ujian berhasil dihapus.");
        router.refresh();
      } else {
        const friendly = classifyApiError(res.error, "Gagal menghapus jadwal ujian.");
        showError(friendly);
      }
    } catch (err) {
      const friendly = classifyApiError(err, "Gagal memproses penghapusan ujian.");
      showError(friendly);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        let res;
        if (examToEdit) {
          formData.set("id", examToEdit.id.toString());
          res = await updateUjianAction(formData);
        } else {
          res = await createUjianAction(formData);
        }

        if (res.success) {
          showSuccess(
            examToEdit
              ? "Jadwal ujian berhasil diperbarui!"
              : "Jadwal ujian baru berhasil ditambahkan!"
          );
          setIsModalOpen(false);
          router.refresh();
        } else {
          const friendly = classifyApiError(res.error, "Gagal menyimpan jadwal ujian.");
          setError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal memproses jadwal ujian.");
        setError(friendly);
        showError(friendly);
      }
    });
  };

  const formatForDateInput = (d?: Date | string) => {
    if (!d) return "";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    return dateObj.toISOString().slice(0, 10);
  };

  return (
    <div className="min-h-screen bg-canvas text-content-primary pb-16">
      <Navbar
        username={username}
        userEmail={userEmail}
        profilePictureUrl={profilePictureUrl}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                Jadwal Evaluasi
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
              Jadwal Ujian Semester
            </h1>
            <p className="text-sm text-content-secondary mt-1">
              Persiapkan Ujian Tengah Semester (UTS), UAS, dan kuis akademik Anda.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            disabled={courses.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 self-start sm:self-auto active:scale-95 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal Ujian</span>
          </button>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.length === 0 ? (
            <div className="col-span-full bg-surface-elevated border border-line rounded-2xl p-12 text-center shadow-xs">
              <GraduationCap className="w-12 h-12 text-content-muted mx-auto mb-3 opacity-60" />
              <h3 className="font-bold text-content-primary text-lg">
                Belum Ada Jadwal Ujian
              </h3>
              <p className="text-sm text-content-secondary mt-1 max-w-md mx-auto">
                {courses.length === 0
                  ? "Tambahkan mata kuliah terlebih dahulu sebelum menjadwalkan ujian."
                  : "Klik tombol Tambah Jadwal Ujian untuk mencatat jadwal UTS atau UAS Anda."}
              </p>
            </div>
          ) : (
            exams.map((u) => {
              const daysLeft = getDaysDifference(u.tanggal);
              const isPast = daysLeft < 0;
              const isToday = daysLeft === 0;

              return (
                <div
                  key={u.id}
                  className={`bg-surface-elevated rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 border ${
                    isPast
                      ? "opacity-60 border-line"
                      : isToday
                      ? "border-rose-500/60 dark:border-rose-500/60 shadow-xs ring-1 ring-rose-500/30"
                      : "border-line hover:border-line-strong shadow-xs"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        {u.jenisUjian}
                      </span>

                      {isPast ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-surface text-content-muted border border-line">
                          Selesai
                        </span>
                      ) : isToday ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500 text-white animate-pulse">
                          Hari Ini!
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                          {daysLeft} hari lagi
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-content-primary tracking-tight mb-3">
                      {u.jadwal?.namaMatkul}
                    </h3>

                    <div className="space-y-2 text-xs sm:text-sm text-content-secondary">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-content-muted shrink-0" />
                        <span>{formatIndonesianDate(u.tanggal)}</span>
                      </div>

                      {u.waktuMulai && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-accent shrink-0" />
                          <span>
                            {u.waktuMulai}
                            {u.waktuSelesai ? ` - ${u.waktuSelesai}` : ""}
                          </span>
                        </div>
                      )}

                      {u.ruangan && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="truncate">{u.ruangan}</span>
                        </div>
                      )}

                      {u.catatan && (
                        <div className="p-2.5 rounded-xl bg-surface border border-line text-xs text-content-secondary mt-2">
                          <strong className="text-content-primary">Materi/Catatan:</strong> {u.catatan}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-line">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      disabled={deletingId !== null}
                      className="p-2 rounded-xl text-content-secondary hover:text-content-primary hover:bg-surface border border-transparent hover:border-line transition-colors disabled:opacity-50"
                      title="Edit Ujian"
                      aria-label="Edit Ujian"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingId !== null}
                      aria-busy={deletingId === u.id}
                      className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:border-rose-900 transition-colors disabled:opacity-50"
                      title="Hapus Ujian"
                      aria-label="Hapus Ujian"
                    >
                      {deletingId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add / Edit Exam Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={examToEdit ? "Edit Jadwal Ujian" : "Tambah Jadwal Ujian"}
        description="Atur tanggal, jenis evaluasi, waktu, dan ruangan ujian."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Mata Kuliah <span className="text-rose-500">*</span>
            </label>
            <select
              name="id_jadwal"
              required
              defaultValue={examToEdit?.idJadwal || courses[0]?.id || ""}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.namaMatkul}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Jenis Ujian <span className="text-rose-500">*</span>
              </label>
              <select
                name="jenis_ujian"
                required
                defaultValue={examToEdit?.jenisUjian || "UTS"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
              >
                {JENIS_UJIAN_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Tanggal Ujian <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="tanggal"
                required
                defaultValue={formatForDateInput(examToEdit?.tanggal)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Waktu Mulai
              </label>
              <input
                type="time"
                name="waktu_mulai"
                defaultValue={examToEdit?.waktuMulai || "08:00"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Waktu Selesai
              </label>
              <input
                type="time"
                name="waktu_selesai"
                defaultValue={examToEdit?.waktuSelesai || "10:00"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Ruangan / Platform
            </label>
            <input
              type="text"
              name="ruangan"
              defaultValue={examToEdit?.ruangan || ""}
              placeholder="Contoh: Lab Komputer A / Online E-Learning"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Catatan / Materi Ujian
            </label>
            <textarea
              name="catatan"
              rows={2}
              defaultValue={examToEdit?.catatan || ""}
              placeholder="Bab 1 sampai Bab 5, bawa kalkulator..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-content-secondary hover:text-content-primary hover:bg-surface transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[160px] rounded-xl text-sm font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{examToEdit ? "Simpan Perubahan" : "Simpan Jadwal"}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

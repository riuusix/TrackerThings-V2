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
  FileText,
  CheckCircle2,
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
  const [examToEdit, setExamToEdit] = useState<
    (UjianItem & { jadwal?: { namaMatkul: string } }) | null
  >(null);
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

  const handleOpenEdit = (
    exam: UjianItem & { jadwal?: { namaMatkul: string } }
  ) => {
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
        const friendly = classifyApiError(
          res.error,
          "Gagal menghapus jadwal ujian."
        );
        showError(friendly);
      }
    } catch (err) {
      const friendly = classifyApiError(
        err,
        "Gagal memproses penghapusan ujian."
      );
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
          const friendly = classifyApiError(
            res.error,
            "Gagal menyimpan jadwal ujian."
          );
          setError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(
          err,
          "Gagal memproses jadwal ujian."
        );
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

  // Partition exams into Upcoming (including Today) vs Past
  const upcomingExams = exams
    .filter((u) => getDaysDifference(u.tanggal) >= 0)
    .sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

  const pastExams = exams
    .filter((u) => getDaysDifference(u.tanggal) < 0)
    .sort(
      (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    );

  return (
    <div className="min-h-screen bg-canvas text-content-primary pb-20">
      <Navbar
        username={username}
        userEmail={userEmail}
        profilePictureUrl={profilePictureUrl}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 space-y-7">
        {/* Editorial Page Header (No Decorative Eyebrow Pill) */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-xs text-content-secondary font-medium">
              <span className="text-accent font-semibold">Evaluasi Akademik</span>
              <span className="text-content-muted">·</span>
              <span className="font-mono tabular-nums text-content-muted">
                {upcomingExams.length} Mendatang · {pastExams.length} Selesai
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
              Jadwal Ujian Semester
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary mt-1">
              Pantau hitung mundur Ujian Tengah Semester (UTS), UAS, kuis, dan materi evaluasi Anda.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            disabled={courses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 self-start sm:self-auto active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal Ujian</span>
          </button>
        </header>

        {exams.length === 0 ? (
          <div className="bg-surface-elevated border border-line rounded-2xl p-12 text-center shadow-2xs">
            <GraduationCap className="w-10 h-10 text-content-muted mx-auto mb-3 opacity-60" />
            <h3 className="font-bold text-content-primary text-base sm:text-lg">
              Belum Ada Jadwal Ujian
            </h3>
            <p className="text-xs sm:text-sm text-content-secondary mt-1 max-w-md mx-auto">
              {courses.length === 0
                ? "Tambahkan mata kuliah terlebih dahulu sebelum menjadwalkan ujian."
                : "Klik tombol Tambah Jadwal Ujian untuk mencatat jadwal UTS, UAS, atau kuis Anda."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Section 1: Chronological Upcoming Exams Countdown */}
            <section className="space-y-3.5" aria-label="Evaluasi Mendatang">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-accent shrink-0" />
                  <h2 className="text-base font-bold text-content-primary tracking-tight">
                    Evaluasi Mendatang
                  </h2>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-0.5 rounded-md bg-accent-muted text-accent border border-line-subtle">
                  {upcomingExams.length} Jadwal
                </span>
              </div>

              {upcomingExams.length === 0 ? (
                <div className="rounded-2xl p-7 text-center bg-surface-elevated border border-line shadow-2xs">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-content-primary">
                    Tidak Ada Ujian Aktif Mendatang
                  </p>
                  <p className="text-xs text-content-secondary mt-0.5">
                    Seluruh jadwal evaluasi yang tercatat telah selesai dilaksanakan.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingExams.map((u) => {
                    const daysLeft = getDaysDifference(u.tanggal);
                    const isToday = daysLeft === 0;
                    const isSoon = daysLeft > 0 && daysLeft <= 3;

                    return (
                      <div
                        key={u.id}
                        className={`rounded-2xl p-4 sm:p-5 bg-surface-elevated border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs ${
                          isToday
                            ? "border-rose-400 dark:border-rose-600"
                            : isSoon
                            ? "border-amber-300 dark:border-amber-700/70"
                            : "border-line hover:border-line-strong"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                          {/* Left Tabular Countdown Block */}
                          <div
                            className={`sm:w-28 shrink-0 py-3 px-3 rounded-xl border text-center ${
                              isToday
                                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300"
                                : isSoon
                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300"
                                : "bg-surface border-line-subtle text-content-primary"
                            }`}
                          >
                            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-75">
                              {u.jenisUjian}
                            </span>
                            <p className="font-mono tabular-nums text-lg sm:text-xl font-black mt-0.5">
                              {isToday ? "Hari Ini" : `H-${daysLeft}`}
                            </p>
                            <span className="block text-[10px] font-mono tabular-nums opacity-75 mt-0.5">
                              {daysLeft === 0 ? "Berlangsung" : `${daysLeft} hari lagi`}
                            </span>
                          </div>

                          {/* Center Exam Identity & Metadata */}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                                {u.jenisUjian}
                              </span>
                              <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight truncate">
                                {u.jadwal?.namaMatkul}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-secondary font-mono tabular-nums">
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-content-muted shrink-0" />
                                <span className="text-content-primary font-medium">
                                  {formatIndonesianDate(u.tanggal)}
                                </span>
                              </span>

                              {u.waktuMulai && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
                                  <span>
                                    {u.waktuMulai}
                                    {u.waktuSelesai ? ` – ${u.waktuSelesai}` : ""}
                                  </span>
                                </span>
                              )}

                              {u.ruangan && (
                                <span className="inline-flex items-center gap-1.5 font-sans">
                                  <MapPin className="w-3.5 h-3.5 text-content-muted shrink-0" />
                                  <span className="font-medium text-content-primary">
                                    {u.ruangan}
                                  </span>
                                </span>
                              )}
                            </div>

                            {u.catatan && (
                              <div className="pt-1 flex items-start gap-1.5 text-xs text-content-secondary">
                                <FileText className="w-3.5 h-3.5 text-content-muted shrink-0 mt-0.5" />
                                <span>
                                  <strong className="text-content-primary">Materi/Catatan:</strong>{" "}
                                  {u.catatan}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Action Controls */}
                        <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/50">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            disabled={deletingId !== null}
                            className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface border border-transparent hover:border-line transition-colors disabled:opacity-50"
                            title="Edit Ujian"
                            aria-label="Edit Ujian"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={deletingId !== null}
                            aria-busy={deletingId === u.id}
                            className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:border-rose-900 transition-colors disabled:opacity-50"
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
                  })}
                </div>
              )}
            </section>

            {/* Section 2: Completed / Past Exams Archive Ledger */}
            {pastExams.length > 0 && (
              <section className="space-y-3" aria-label="Riwayat Ujian Selesai">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-content-muted">
                    Riwayat Evaluasi Selesai ({pastExams.length})
                  </h2>
                </div>

                <div className="bg-surface-elevated border border-line rounded-2xl divide-y divide-line overflow-hidden opacity-80">
                  {pastExams.map((u) => (
                    <div
                      key={u.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/40 transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface text-content-secondary border border-line-subtle">
                          {u.jenisUjian}
                        </span>
                        <span className="font-bold text-sm text-content-primary truncate">
                          {u.jadwal?.namaMatkul}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-content-muted">
                          · {formatIndonesianDate(u.tanggal)}
                        </span>
                        {u.ruangan && (
                          <span className="text-xs text-content-muted">
                            · {u.ruangan}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <span className="text-[11px] font-medium text-content-muted mr-2">
                          Selesai
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          disabled={deletingId !== null}
                          className="p-1.5 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface transition-colors"
                          title="Edit Ujian"
                          aria-label="Edit Ujian"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          disabled={deletingId !== null}
                          className="p-1.5 rounded-lg text-content-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Hapus Ujian"
                          aria-label="Hapus Ujian"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono tabular-nums transition-colors"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono tabular-nums transition-colors"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono tabular-nums transition-colors"
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

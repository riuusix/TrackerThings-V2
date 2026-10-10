"use client";

import { useState, useTransition } from "react";
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

interface UjianClientProps {
  username: string;
  userEmail: string;
  initialExams: Array<UjianItem & { jadwal?: { namaMatkul: string } }>;
  courses: Array<{ id: number; namaMatkul: string }>;
}

const JENIS_UJIAN_OPTIONS = ["UTS", "UAS", "Kuis", "Responsi", "Praktikum"];

export function UjianClient({
  username,
  userEmail,
  initialExams,
  courses,
}: UjianClientProps) {
  const [exams, setExams] = useState(initialExams);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<(UjianItem & { jadwal?: { namaMatkul: string } }) | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    if (!confirm("Hapus jadwal ujian ini?")) return;
    const res = await deleteUjianAction(exam.id);
    if (res.success) {
      setExams(exams.filter((e) => e.id !== exam.id));
    } else {
      alert(res.error || "Gagal menghapus jadwal ujian.");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let res;
      if (examToEdit) {
        formData.set("id", examToEdit.id.toString());
        res = await updateUjianAction(formData);
      } else {
        res = await createUjianAction(formData);
      }

      if (res.success) {
        setIsModalOpen(false);
        window.location.reload();
      } else {
        setError(res.error || "Gagal menyimpan jadwal ujian.");
      }
    });
  };

  const formatForDateInput = (d?: Date | string) => {
    if (!d) return "";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    return dateObj.toISOString().slice(0, 10);
  };

  return (
    <div className="min-h-screen pb-16">
      <Navbar username={username} userEmail={userEmail} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                Jadwal Evaluasi
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Jadwal Ujian Semester
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Persiapkan Ujian Tengah Semester (UTS), UAS, dan kuis akademik Anda.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            disabled={courses.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal Ujian</span>
          </button>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.length === 0 ? (
            <div className="col-span-full glass-card rounded-2xl p-12 text-center">
              <GraduationCap className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">
                Belum Ada Jadwal Ujian
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
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
                  className={`glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-xl transition-all duration-200 border ${
                    isPast
                      ? "opacity-60 border-slate-200 dark:border-slate-800"
                      : isToday
                      ? "border-rose-400 dark:border-rose-800 shadow-rose-500/10"
                      : "border-white/60 dark:border-white/10"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        {u.jenisUjian}
                      </span>

                      {isPast ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Selesai
                        </span>
                      ) : isToday ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500 text-white animate-pulse">
                          Hari Ini!
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {daysLeft} hari lagi
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-3">
                      {u.jadwal?.namaMatkul}
                    </h3>

                    <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{formatIndonesianDate(u.tanggal)}</span>
                      </div>

                      {u.waktuMulai && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
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
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 mt-2">
                          <strong>Materi/Catatan:</strong> {u.catatan}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Ujian"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Hapus Ujian"
                    >
                      <Trash2 className="w-4 h-4" />
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Mata Kuliah <span className="text-rose-500">*</span>
            </label>
            <select
              name="id_jadwal"
              required
              defaultValue={examToEdit?.idJadwal || courses[0]?.id || ""}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Jenis Ujian <span className="text-rose-500">*</span>
              </label>
              <select
                name="jenis_ujian"
                required
                defaultValue={examToEdit?.jenisUjian || "UTS"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              >
                {JENIS_UJIAN_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Tanggal Ujian <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="tanggal"
                required
                defaultValue={formatForDateInput(examToEdit?.tanggal)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Waktu Mulai
              </label>
              <input
                type="time"
                name="waktu_mulai"
                defaultValue={examToEdit?.waktuMulai || "08:00"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Waktu Selesai
              </label>
              <input
                type="time"
                name="waktu_selesai"
                defaultValue={examToEdit?.waktuSelesai || "10:00"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Ruangan / Platform
            </label>
            <input
              type="text"
              name="ruangan"
              defaultValue={examToEdit?.ruangan || ""}
              placeholder="Contoh: Lab Komputer A / Online E-Learning"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Catatan / Materi Ujian
            </label>
            <textarea
              name="catatan"
              rows={2}
              defaultValue={examToEdit?.catatan || ""}
              placeholder="Bab 1 sampai Bab 5, bawa kalkulator..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{examToEdit ? "Simpan Perubahan" : "Simpan Jadwal"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

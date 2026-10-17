"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Modal } from "@/components/Modal";
import { ImportScheduleModal } from "@/components/ImportScheduleModal";
import { JadwalItem } from "@/types";
import {
  createJadwalAction,
  updateJadwalAction,
  deleteJadwalAction,
} from "@/app/actions/jadwal";
import {
  BookOpen,
  Plus,
  Search,
  Clock,
  MapPin,
  UserCheck,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface MatakuliahClientProps {
  username: string;
  userEmail: string;
  initialCourses: JadwalItem[];
}

const HARI_OPTIONS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const KATEGORI_OPTIONS = ["Wajib", "Pilihan", "Praktikum", "Umum"];

export function MatakuliahClient({
  username,
  userEmail,
  initialCourses,
}: MatakuliahClientProps) {
  const router = useRouter();
  const [courses, setCourses] = useState<JadwalItem[]>(initialCourses);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<JadwalItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    setCourses(initialCourses);
  }, [initialCourses]);

  const filteredCourses = courses.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.namaMatkul.toLowerCase().includes(term) ||
      (c.dosen && c.dosen.toLowerCase().includes(term)) ||
      c.hari.toLowerCase().includes(term)
    );
  });

  const handleOpenAdd = () => {
    setCourseToEdit(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (course: JadwalItem) => {
    setCourseToEdit(course);
    setError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (course: JadwalItem) => {
    if (deletingId !== null) return;
    if (!confirm(`Hapus mata kuliah "${course.namaMatkul}" beserta jadwalnya?`)) return;
    setDeletingId(course.id);
    try {
      const res = await deleteJadwalAction(course.id);
      if (res.success) {
        setCourses(courses.filter((c) => c.id !== course.id));
        showSuccess(`Mata kuliah "${course.namaMatkul}" berhasil dihapus.`);
        router.refresh();
      } else {
        const friendly = classifyApiError(res.error, "Gagal menghapus mata kuliah.");
        showError(friendly);
      }
    } catch (err) {
      const friendly = classifyApiError(err, "Gagal memproses penghapusan mata kuliah.");
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
        if (courseToEdit) {
          formData.set("id", courseToEdit.id.toString());
          res = await updateJadwalAction(formData);
        } else {
          res = await createJadwalAction(formData);
        }

        if (res.success) {
          showSuccess(
            courseToEdit
              ? "Mata kuliah berhasil diperbarui!"
              : "Mata kuliah baru berhasil ditambahkan!"
          );
          setIsModalOpen(false);
          router.refresh();
        } else {
          const friendly = classifyApiError(res.error, "Gagal menyimpan mata kuliah.");
          setError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal memproses mata kuliah.");
        setError(friendly);
        showError(friendly);
      }
    });
  };

  return (
    <div className="min-h-screen pb-16">
      <Navbar username={username} userEmail={userEmail} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Manajemen KRS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Daftar Mata Kuliah
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Kelola daftar mata kuliah, dosen pengampu, hari, dan jam tatap muka Anda.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Impor (Foto / PDF)</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mata Kuliah</span>
            </button>
          </div>
        </div>

        {/* Search & Quick Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama mata kuliah, dosen, atau hari..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Total: <strong>{courses.length}</strong> Mata Kuliah
            </span>
            <span>•</span>
            <span>
              Menampilkan: <strong>{filteredCourses.length}</strong>
            </span>
          </div>
        </div>

        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.length === 0 ? (
            <div className="col-span-full glass-card rounded-2xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">
                Tidak Ada Mata Kuliah Ditemukan
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                {searchTerm
                  ? `Tidak ada hasil yang sesuai dengan kata kunci "${searchTerm}".`
                  : "Mulai tambahkan mata kuliah pertama Anda dengan menekan tombol Tambah Mata Kuliah."}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                >
                  Bersihkan Pencarian
                </button>
              )}
            </div>
          ) : (
            filteredCourses.map((c) => (
              <div
                key={c.id}
                className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-xl transition-all duration-200 border border-white/60 dark:border-white/10 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50">
                      {c.hari}
                    </span>

                    {c.kategori && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {c.kategori}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-3">
                    {c.namaMatkul}
                  </h3>

                  <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>
                        {c.waktuMulai} - {c.waktuSelesai}
                      </span>
                    </div>

                    {c.lokasi && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="truncate">{c.lokasi}</span>
                      </div>
                    )}

                    {c.dosen && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{c.dosen}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleOpenEdit(c)}
                    disabled={deletingId !== null}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    title="Edit Mata Kuliah"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={deletingId !== null}
                    aria-busy={deletingId === c.id}
                    className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50"
                    title="Hapus Mata Kuliah"
                  >
                    {deletingId === c.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add / Edit Course Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={courseToEdit ? "Edit Mata Kuliah" : "Tambah Mata Kuliah Baru"}
        description="Masukkan informasi detail jadwal perkuliahan."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nama Mata Kuliah <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="nama_matkul"
              required
              defaultValue={courseToEdit?.namaMatkul || ""}
              placeholder="Contoh: Pemrograman Web Lanjut"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Dosen Pengampu
            </label>
            <input
              type="text"
              name="dosen"
              defaultValue={courseToEdit?.dosen || ""}
              placeholder="Nama dosen beserta gelar"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Hari Kuliah <span className="text-rose-500">*</span>
              </label>
              <select
                name="hari"
                required
                defaultValue={courseToEdit?.hari || "Senin"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              >
                {HARI_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Kategori
              </label>
              <select
                name="kategori"
                defaultValue={courseToEdit?.kategori || "Wajib"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              >
                {KATEGORI_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Waktu Mulai <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                name="waktu_mulai"
                required
                defaultValue={courseToEdit?.waktuMulai || "08:00"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Waktu Selesai <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                name="waktu_selesai"
                required
                defaultValue={courseToEdit?.waktuSelesai || "09:40"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Ruangan / Lokasi
            </label>
            <input
              type="text"
              name="lokasi"
              defaultValue={courseToEdit?.lokasi || ""}
              placeholder="Contoh: Gedung C Ruang 304"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[170px] rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{courseToEdit ? "Simpan Perubahan" : "Tambah Mata Kuliah"}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ImportScheduleModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

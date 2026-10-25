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
  FileUp,
  Calendar,
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface MatakuliahClientProps {
  username: string;
  userEmail: string;
  profilePictureUrl?: string | null;
  initialCourses: JadwalItem[];
}

const HARI_OPTIONS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const KATEGORI_OPTIONS = ["Wajib", "Pilihan", "Praktikum", "Umum"];

export function MatakuliahClient({
  username,
  userEmail,
  profilePictureUrl,
  initialCourses,
}: MatakuliahClientProps) {
  const router = useRouter();
  const [courses, setCourses] = useState<JadwalItem[]>(initialCourses);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("Semua");
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
    const matchesSearch =
      c.namaMatkul.toLowerCase().includes(term) ||
      (c.dosen && c.dosen.toLowerCase().includes(term)) ||
      c.hari.toLowerCase().includes(term) ||
      (c.lokasi && c.lokasi.toLowerCase().includes(term));
    const matchesDay =
      selectedDayFilter === "Semua" ||
      c.hari.toLowerCase() === selectedDayFilter.toLowerCase();
    return matchesSearch && matchesDay;
  });

  // Group filtered courses by academic day in canonical Monday-Sunday order
  const groupedByDay = HARI_OPTIONS.map((hari) => {
    const items = filteredCourses
      .filter((c) => c.hari.toLowerCase() === hari.toLowerCase())
      .sort((a, b) => a.waktuMulai.localeCompare(b.waktuMulai));
    return { hari, items };
  }).filter((group) => group.items.length > 0);

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
    <div className="min-h-screen bg-canvas text-content-primary pb-20">
      <Navbar
        username={username}
        userEmail={userEmail}
        profilePictureUrl={profilePictureUrl}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 space-y-6">
        {/* Editorial Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-xs text-content-secondary font-medium">
              <span className="text-accent font-semibold">Direktori Akademik</span>
              <span className="text-content-muted">·</span>
              <span className="font-mono tabular-nums text-content-muted">
                {courses.length} Mata Kuliah Terdaftar
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
              Daftar Mata Kuliah
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary mt-1">
              Kelola direktori mata kuliah mingguan, dosen pengampu, ruang kelas, dan jam tatap muka Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-content-primary bg-surface-elevated hover:bg-surface border border-line shadow-2xs transition-all duration-200 active:scale-95"
            >
              <FileUp className="w-4 h-4 text-accent" />
              <span>Impor (Foto / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mata Kuliah</span>
            </button>
          </div>
        </header>

        {/* Search & Day Filter Bar */}
        <div className="bg-surface-elevated border border-line rounded-2xl p-4 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-content-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari mata kuliah, dosen, ruangan, atau hari..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-xs sm:text-sm transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-content-secondary">
              <span>
                Total: <strong className="text-content-primary">{courses.length}</strong>
              </span>
              <span className="text-content-muted">·</span>
              <span>
                Ditampilkan: <strong className="text-accent">{filteredCourses.length}</strong>
              </span>
            </div>
          </div>

          {/* Day Filter Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {["Semua", ...HARI_OPTIONS].map((day) => {
              const isSelected = selectedDayFilter === day;
              const dayCount =
                day === "Semua"
                  ? courses.length
                  : courses.filter((c) => c.hari.toLowerCase() === day.toLowerCase()).length;

              if (day !== "Semua" && dayCount === 0 && selectedDayFilter !== day) {
                return null;
              }

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDayFilter(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-accent text-accent-text shadow-2xs"
                      : "bg-surface text-content-secondary hover:text-content-primary border border-line-subtle"
                  }`}
                >
                  <span>{day === "Semua" ? "Semua Hari" : day}</span>
                  <span
                    className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                      isSelected
                        ? "bg-accent-text/20 text-accent-text"
                        : "bg-surface-elevated text-content-muted"
                    }`}
                  >
                    {dayCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day-Grouped Editorial Course Ledger */}
        {groupedByDay.length === 0 ? (
          <div className="bg-surface-elevated border border-line rounded-2xl p-12 text-center shadow-2xs">
            <BookOpen className="w-10 h-10 text-content-muted mx-auto mb-3 opacity-60" />
            <h3 className="font-bold text-content-primary text-base sm:text-lg">
              Tidak Ada Mata Kuliah Ditemukan
            </h3>
            <p className="text-xs sm:text-sm text-content-secondary mt-1 max-w-md mx-auto">
              {searchTerm || selectedDayFilter !== "Semua"
                ? "Tidak ada mata kuliah yang sesuai dengan filter pencarian saat ini."
                : "Mulai tambahkan mata kuliah pertama Anda atau impor langsung dari dokumen KRS / jadwal."}
            </p>
            {(searchTerm || selectedDayFilter !== "Semua") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDayFilter("Semua");
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-accent-muted text-accent border border-line-subtle hover:bg-accent hover:text-accent-text transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByDay.map(({ hari, items }) => (
              <section
                key={hari}
                aria-label={`Jadwal Hari ${hari}`}
                className="bg-surface-elevated border border-line rounded-2xl shadow-2xs overflow-hidden"
              >
                {/* Day Group Header */}
                <div className="px-5 py-3.5 bg-surface/60 border-b border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent shrink-0" />
                    <h2 className="text-sm sm:text-base font-bold text-content-primary tracking-tight">
                      {hari}
                    </h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-0.5 rounded-md bg-surface-elevated text-content-secondary border border-line-subtle">
                    {items.length} Mata Kuliah
                  </span>
                </div>

                {/* Hairline-Divided Course Rows */}
                <div className="divide-y divide-line">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 sm:px-5 sm:py-4 hover:bg-surface/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 min-w-0 flex-1">
                        {/* Left Monospace Time Rail */}
                        <div className="sm:w-36 shrink-0 flex items-center gap-1.5 font-mono tabular-nums text-xs sm:text-sm font-bold text-content-primary">
                          <Clock className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span>{c.waktuMulai}</span>
                          <span className="text-content-muted font-normal">–</span>
                          <span className="text-content-secondary font-semibold">
                            {c.waktuSelesai}
                          </span>
                        </div>

                        {/* Center Course Identity & Details */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-content-primary group-hover:text-accent transition-colors truncate">
                              {c.namaMatkul}
                            </h3>
                            {c.kategori && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-accent-muted text-accent border border-line-subtle">
                                {c.kategori}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-secondary">
                            {c.lokasi && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-content-muted shrink-0" />
                                <span className="font-medium text-content-primary">
                                  {c.lokasi}
                                </span>
                              </span>
                            )}
                            {c.dosen && (
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <UserCheck className="w-3.5 h-3.5 text-content-muted shrink-0" />
                                <span className="truncate">{c.dosen}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/50">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          disabled={deletingId !== null}
                          className="p-2 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface border border-transparent hover:border-line transition-colors disabled:opacity-50"
                          title="Edit Mata Kuliah"
                          aria-label="Edit Mata Kuliah"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={deletingId !== null}
                          aria-busy={deletingId === c.id}
                          className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:border-rose-900 transition-colors disabled:opacity-50"
                          title="Hapus Mata Kuliah"
                          aria-label="Hapus Mata Kuliah"
                        >
                          {deletingId === c.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
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
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Nama Mata Kuliah <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="nama_matkul"
              required
              defaultValue={courseToEdit?.namaMatkul || ""}
              placeholder="Contoh: Pemrograman Web Lanjut"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Dosen Pengampu
            </label>
            <input
              type="text"
              name="dosen"
              defaultValue={courseToEdit?.dosen || ""}
              placeholder="Nama dosen beserta gelar"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Hari Kuliah <span className="text-rose-500">*</span>
              </label>
              <select
                name="hari"
                required
                defaultValue={courseToEdit?.hari || "Senin"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
              >
                {HARI_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Kategori
              </label>
              <select
                name="kategori"
                defaultValue={courseToEdit?.kategori || "Wajib"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
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
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Waktu Mulai <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                name="waktu_mulai"
                required
                defaultValue={courseToEdit?.waktuMulai || "08:00"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono tabular-nums transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
                Waktu Selesai <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                name="waktu_selesai"
                required
                defaultValue={courseToEdit?.waktuSelesai || "09:40"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm font-mono tabular-nums transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase tracking-wider mb-1">
              Ruangan / Lokasi
            </label>
            <input
              type="text"
              name="lokasi"
              defaultValue={courseToEdit?.lokasi || ""}
              placeholder="Contoh: Gedung C Ruang 304"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
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
              className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[170px] rounded-xl text-sm font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-50"
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

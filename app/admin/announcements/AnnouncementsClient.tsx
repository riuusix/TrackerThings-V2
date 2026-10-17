"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Trash2,
  FileText,
  Eye,
  Archive,
  Search,
  Users,
} from "lucide-react";

interface Announcement {
  id: number;
  judul: string;
  isi: string;
  kategori: string;
  target: string;
  tanggal: string;
  status: "Aktif" | "Arsip";
  penulis: string;
}

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    judul: "Jadwal Evaluasi Tengah Semester (UTS) Semester Ganjil 2026/2027",
    isi: "Seluruh mahasiswa diharapkan memeriksa jadwal ujian di menu Jadwal Ujian dan memastikan kartu ujian telah dicetak sebelum sesi dimulai.",
    kategori: "Ujian",
    target: "Semua Mahasiswa",
    tanggal: "2026-10-08",
    status: "Aktif",
    penulis: "Biro Administrasi Akademik",
  },
  {
    id: 2,
    judul: "Batas Akhir Penyesuaian Kelas & Permohonan Kelas Pengganti",
    isi: "Mahasiswa yang memiliki bentrok jadwal kuliah diwajibkan mengajukan sesi kelas pengganti maksimal tanggal 15 Oktober 2026.",
    kategori: "Akademik",
    target: "Semua Mahasiswa",
    tanggal: "2026-10-05",
    status: "Aktif",
    penulis: "Koordinator Kurikulum",
  },
  {
    id: 3,
    judul: "Pemeliharaan Server Database Akademik",
    isi: "Sistem tracker dan portal mahasiswa akan mengalami pemeliharaan rutin pada hari Minggu pukul 01:00 - 04:00 WIB.",
    kategori: "Sistem",
    target: "Semua Pengguna",
    tanggal: "2026-09-28",
    status: "Arsip",
    penulis: "IT Support Center",
  },
];

const INITIAL_LOGS = [
  { id: 1, action: "Admin login sukses dari IP 192.168.1.10", waktu: "10 Okt 2026, 04:15 WIB", tipe: "Auth" },
  { id: 2, action: "Pembaruan master jadwal kuliah Semester Ganjil", waktu: "09 Okt 2026, 21:30 WIB", tipe: "Jadwal" },
  { id: 3, action: "Sinkronisasi data Supabase database selesai", waktu: "09 Okt 2026, 18:00 WIB", tipe: "Database" },
  { id: 4, action: "Pembersihan token sesi kedaluwarsa berhasil", waktu: "08 Okt 2026, 00:00 WIB", tipe: "Security" },
];

interface AnnouncementsClientProps {
  initialAnnouncements?: Announcement[];
  initialLogs?: { id: string; action: string; waktu: string; tipe: string }[];
  currentUsername: string;
  currentUserEmail: string;
  role: string;
}

export function AnnouncementsClient({
  initialAnnouncements,
  initialLogs,
  currentUsername,
  currentUserEmail,
  role,
}: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements || INITIAL_ANNOUNCEMENTS);
  const [logs] = useState(initialLogs || INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New announcement form state
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [kategori, setKategori] = useState("Akademik");
  const [target, setTarget] = useState("Semua Mahasiswa");

  const filtered = announcements.filter(
    (a) =>
      a.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.kategori.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !isi.trim()) return;

    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: judul,
          content: isi,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Gagal menerbitkan pengumuman.");
      }

      const created = data.data;
      const newItem: Announcement = {
        id: created.id,
        judul: created.title,
        isi: created.content,
        kategori,
        target,
        tanggal: new Date().toISOString().slice(0, 10),
        status: created.isActive ? "Aktif" : "Arsip",
        penulis: currentUsername,
      };

      setAnnouncements([newItem, ...announcements]);
      setIsModalOpen(false);
      setJudul("");
      setIsi("");
      setFeedback("Pengumuman resmi baru berhasil dipublikasikan ke seluruh mahasiswa!");
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleToggleStatus = async (id: number) => {
    const target = announcements.find((a) => a.id === id);
    if (!target) return;
    const newIsActive = target.status !== "Aktif";

    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newIsActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal mengubah status pengumuman.");
      }

      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: newIsActive ? "Aktif" : "Arsip" } : a
        )
      );
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Hapus pengumuman "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Gagal menghapus pengumuman.");
      }

      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setFeedback("Pengumuman telah dihapus.");
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 pb-20">
      {/* Navigation Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            <Link href="/admin" className="hover:text-purple-400 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200">Kelola Pengumuman</span>
          </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Megaphone className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span>Kelola Pengumuman Kampus</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Publikasikan pengumuman akademik resmi yang akan muncul di beranda seluruh mahasiswa.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Pengumuman</span>
            </button>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {feedback && (
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in-50 duration-200">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul pengumuman..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filtered.length} Pengumuman Terdaftar
          </span>
        </div>

        {/* Modern Announcements Table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Judul Pengumuman</th>
                  <th className="px-5 py-3.5">Kategori</th>
                  <th className="px-5 py-3.5">Target Sasaran</th>
                  <th className="px-5 py-3.5">Tanggal Terbit</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      Belum ada pengumuman yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4 max-w-sm">
                        <div className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                          {item.judul}
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {item.isi}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                          Oleh: {item.penulis}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                          {item.kategori}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                        {item.target}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.tanggal}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                            item.status === "Aktif"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item.id)}
                            title={item.status === "Aktif" ? "Arsipkan Pengumuman" : "Aktifkan Kembali"}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.judul)}
                            title="Hapus Pengumuman"
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Audit Logs Section */}
        <div id="logs" className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Log Aktivitas Sistem (Admin Logs)
            </h3>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm p-4 divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {log.tipe}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{log.action}</span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">{log.waktu}</span>
              </div>
            ))}
          </div>
        </div>

      {/* Modal Buat Pengumuman Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="w-full max-w-lg rounded-3xl p-6 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              Buat Pengumuman Kampus Baru
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Siarkan informasi penting untuk jadwal akademik atau sistem portal mahasiswa.
            </p>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Judul Pengumuman
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jadwal Ujian Akhir Semester"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Akademik">Akademik</option>
                    <option value="Ujian">Ujian</option>
                    <option value="Libur">Libur</option>
                    <option value="Sistem">Sistem</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Target Sasaran
                  </label>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Semua Mahasiswa">Semua Mahasiswa</option>
                    <option value="Angkatan 2024">Angkatan 2024</option>
                    <option value="Semua Pengguna">Semua Pengguna</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Konten / Isi Pengumuman
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tuliskan detail pengumuman secara rinci..."
                  value={isi}
                  onChange={(e) => setIsi(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                >
                  Publikasikan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

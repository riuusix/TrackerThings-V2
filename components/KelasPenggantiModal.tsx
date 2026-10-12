"use client";

import { useState, useTransition } from "react";
import { Modal } from "./Modal";
import { createKelasPenggantiAction } from "@/app/actions/kelasPengganti";
import { Loader2 } from "lucide-react";
import { useToast } from "./ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface KelasPenggantiModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Array<{ id: number; namaMatkul: string }>;
}

export function KelasPenggantiModal({
  isOpen,
  onClose,
  courses,
}: KelasPenggantiModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const res = await createKelasPenggantiAction(formData);
        if (res.success) {
          showSuccess("Kelas pengganti berhasil dijadwalkan!");
          onClose();
        } else {
          const friendly = classifyApiError(res.error, "Gagal menambahkan kelas pengganti.");
          setError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal memproses kelas pengganti.");
        setError(friendly);
        showError(friendly);
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Kelas Pengganti"
      description="Jadwalkan sesi kuliah pengganti agar tidak tertinggal materi perkuliahan."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Mata Kuliah
          </label>
          <select
            name="id_jadwal"
            required
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="dark:bg-slate-800">
                {c.namaMatkul}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Tanggal Kelas Pengganti
          </label>
          <input
            type="date"
            name="tanggal"
            required
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Waktu Mulai
            </label>
            <input
              type="time"
              name="waktu_mulai"
              required
              defaultValue="08:00"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Waktu Selesai
            </label>
            <input
              type="time"
              name="waktu_selesai"
              required
              defaultValue="09:40"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Lokasi / Ruangan (Opsional)
          </label>
          <input
            type="text"
            name="lokasi"
            placeholder="Contoh: Lab Komputer 2 atau Zoom"
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            name="catatan"
            rows={2}
            placeholder="Materi pengganti minggu lalu..."
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[210px] rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 active:scale-95"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Tambah Kelas Pengganti</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

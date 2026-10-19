"use client";

import { useState, useTransition } from "react";
import { Modal } from "./Modal";
import { TugasItem } from "@/types";
import { createTugasAction, updateTugasAction } from "@/app/actions/tugas";
import { Loader2 } from "lucide-react";
import { useToast } from "./ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: TugasItem | null;
  courses: Array<{ id: number; namaMatkul: string }>;
}

export function TaskModal({ isOpen, onClose, taskToEdit, courses }: TaskModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const formatForInput = (d?: Date | string) => {
    if (!d) return "";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    return dateObj.toISOString().slice(0, 16);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        let res;
        if (taskToEdit) {
          formData.set("id_tugas", taskToEdit.id.toString());
          res = await updateTugasAction(formData);
        } else {
          res = await createTugasAction(formData);
        }

        if (res.success) {
          showSuccess(taskToEdit ? "Tugas berhasil diperbarui!" : "Tugas baru berhasil ditambahkan!");
          onClose();
        } else {
          const friendly = classifyApiError(res.error, "Gagal menyimpan tugas.");
          setError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal memproses data tugas.");
        setError(friendly);
        showError(friendly);
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? "Edit Tugas Mahasiswa" : "Tambah Tugas Baru"}
      description="Catat detail tugas, prioritas, dan tenggat waktu pengumpulan."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-content-primary uppercase tracking-wider mb-1.5">
            Nama Tugas
          </label>
          <input
            type="text"
            name="nama_tugas"
            defaultValue={taskToEdit?.namaTugas || ""}
            required
            placeholder="Contoh: Makalah Sistem Terdistribusi"
            className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent text-content-primary placeholder:text-content-muted text-sm transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-content-primary uppercase tracking-wider mb-1.5">
            Mata Kuliah
          </label>
          <select
            name="id_jadwal"
            defaultValue={taskToEdit?.idJadwal || courses[0]?.id || ""}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent text-content-primary text-sm"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id} className="bg-surface-elevated text-content-primary">
                {course.namaMatkul}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-content-primary uppercase tracking-wider mb-1.5">
              Prioritas
            </label>
            <select
              name="prioritas"
              defaultValue={taskToEdit?.prioritas || "Sedang"}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent text-content-primary text-sm"
            >
              <option value="Tinggi" className="bg-surface-elevated text-content-primary">Tinggi</option>
              <option value="Sedang" className="bg-surface-elevated text-content-primary">Sedang</option>
              <option value="Rendah" className="bg-surface-elevated text-content-primary">Rendah</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-content-primary uppercase tracking-wider mb-1.5">
              Jenis Tugas
            </label>
            <select
              name="jenis"
              defaultValue={taskToEdit?.jenis || "Individu"}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent text-content-primary text-sm"
            >
              <option value="Individu" className="bg-surface-elevated text-content-primary">Individu</option>
              <option value="Kelompok" className="bg-surface-elevated text-content-primary">Kelompok</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-content-primary uppercase tracking-wider mb-1.5">
            Deadline / Tenggat Waktu
          </label>
          <input
            type="datetime-local"
            name="deadline"
            defaultValue={formatForInput(taskToEdit?.deadline)}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent text-content-primary text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-content-secondary hover:text-content-primary hover:bg-surface transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="flex items-center justify-center gap-2 px-5 py-2.5 min-w-[150px] rounded-xl text-sm font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all disabled:opacity-50 active:scale-95"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>{taskToEdit ? "Simpan Perubahan" : "Tambah Tugas"}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

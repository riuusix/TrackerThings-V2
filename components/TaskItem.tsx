"use client";

import { useState, useTransition } from "react";
import { TugasItem } from "@/types";
import { formatIndonesianDate, getDaysDifference } from "@/lib/utils";
import { updateTugasProgressAction, deleteTugasAction } from "@/app/actions/tugas";
import {
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useToast } from "./ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface TaskItemProps {
  task: TugasItem;
  onEdit: (task: TugasItem) => void;
}

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const [progress, setProgress] = useState<number>(task.progress);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const { showSuccess, showError } = useToast();

  const daysLeft = getDaysDifference(task.deadline);
  const isUrgent = daysLeft <= 1 && task.status !== "Selesai";
  const isPast = daysLeft < 0 && task.status !== "Selesai";

  const handleProgressChange = (newVal: number) => {
    if (isPending || isDeleting) return;
    setProgress(newVal);
    startTransition(async () => {
      try {
        const res = await updateTugasProgressAction(task.id, newVal);
        if (!res.success) {
          showError(classifyApiError(res.error, "Gagal memperbarui progress tugas."));
        }
      } catch (err) {
        showError(classifyApiError(err, "Gagal memperbarui progress tugas."));
      }
    });
  };

  const handleMarkComplete = () => {
    if (isPending || isDeleting) return;
    setProgress(100);
    startTransition(async () => {
      try {
        const res = await updateTugasProgressAction(task.id, 100);
        if (res.success) {
          showSuccess(`Tugas "${task.namaTugas}" selesai!`);
        } else {
          showError(classifyApiError(res.error, "Gagal menyelesaikan tugas."));
        }
      } catch (err) {
        showError(classifyApiError(err, "Gagal menyelesaikan tugas."));
      }
    });
  };

  const handleDelete = async () => {
    if (isDeleting || isPending) return;
    if (!confirm(`Hapus tugas "${task.namaTugas}"?`)) return;
    setIsDeleting(true);
    try {
      const res = await deleteTugasAction(task.id);
      if (res.success) {
        showSuccess(`Tugas "${task.namaTugas}" berhasil dihapus.`);
      } else {
        showError(classifyApiError(res.error, "Gagal menghapus tugas."));
      }
    } catch (err) {
      showError(classifyApiError(err, "Gagal memproses penghapusan tugas."));
    } finally {
      setIsDeleting(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p.toLowerCase()) {
      case "tinggi":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40";
      case "sedang":
        return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40";
      default:
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40";
    }
  };

  return (
    <div
      className={`group relative rounded-2xl p-5 sm:p-6 bg-surface-elevated border border-line shadow-xs transition-all duration-200 hover:border-line-strong ${
        task.status === "Selesai"
          ? "opacity-60 bg-surface/40 border-line-subtle"
          : isUrgent
          ? "border-rose-300 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/10"
          : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${getPriorityBadge(
                task.prioritas
              )}`}
            >
              {task.prioritas}
            </span>

            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-surface text-content-secondary border border-line-subtle">
              {task.jenis}
            </span>

            {task.jadwal?.namaMatkul && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-accent-muted text-accent border border-line-subtle truncate max-w-[220px]">
                {task.jadwal.namaMatkul}
              </span>
            )}
          </div>

          <h4
            className={`text-base sm:text-lg font-bold tracking-tight transition-colors ${
              task.status === "Selesai"
                ? "line-through text-content-muted"
                : "text-content-primary group-hover:text-accent"
            }`}
          >
            {task.namaTugas}
          </h4>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          {task.status !== "Selesai" && (
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={isPending || isDeleting}
              aria-busy={isPending}
              title="Tandai Selesai"
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(task)}
            disabled={isPending || isDeleting}
            title="Edit Tugas"
            className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-content-secondary hover:text-content-primary border border-line transition-all active:scale-95 disabled:opacity-50"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isPending}
            aria-busy={isDeleting}
            title="Hapus Tugas"
            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-all disabled:opacity-50 active:scale-95"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Deadline Info */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-content-secondary mb-3.5">
        <Calendar className="w-4 h-4 text-content-muted" />
        <span>Deadline: {formatIndonesianDate(task.deadline)}</span>
        {isPast ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            Terlewat
          </span>
        ) : isUrgent ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            {daysLeft === 0 ? "Hari Ini!" : "Besok!"}
          </span>
        ) : null}
      </div>

      {/* Interactive Progress Slider */}
      <div className="space-y-1.5 pt-2.5 border-t border-line">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-content-secondary flex items-center gap-1.5 font-medium">
            Progress Pengerjaan
            {isPending && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
          </span>
          <span className="text-accent tracking-wide font-bold">{progress}%</span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-accent transition-all"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { TugasItem } from "@/types";
import { formatIndonesianDate, getDaysDifference } from "@/lib/utils";
import { updateTugasProgressAction, deleteTugasAction } from "@/app/actions/tugas";
import {
  Calendar,
  Edit2,
  Trash2,
  Check,
  Loader2,
  Clock,
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
  const isCompleted = task.status === "Selesai" || progress >= 100;
  const isUrgent = daysLeft <= 1 && !isCompleted;
  const isPast = daysLeft < 0 && !isCompleted;

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

  const handleToggleComplete = () => {
    if (isPending || isDeleting) return;
    const nextProgress = isCompleted ? 0 : 100;
    setProgress(nextProgress);
    startTransition(async () => {
      try {
        const res = await updateTugasProgressAction(task.id, nextProgress);
        if (res.success) {
          if (nextProgress === 100) {
            showSuccess(`Tugas "${task.namaTugas}" selesai!`);
          } else {
            showSuccess(`Tugas "${task.namaTugas}" dibuka kembali.`);
          }
        } else {
          showError(classifyApiError(res.error, "Gagal memperbarui status tugas."));
        }
      } catch (err) {
        showError(classifyApiError(err, "Gagal memperbarui status tugas."));
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

  const getPriorityDot = (p?: string | null) => {
    switch ((p || "").toLowerCase()) {
      case "tinggi":
        return {
          dot: "bg-rose-500",
          text: "text-rose-600 dark:text-rose-400",
          label: "Tinggi",
        };
      case "sedang":
        return {
          dot: "bg-amber-500",
          text: "text-amber-600 dark:text-amber-400",
          label: "Sedang",
        };
      default:
        return {
          dot: "bg-emerald-500",
          text: "text-emerald-600 dark:text-emerald-400",
          label: "Rendah",
        };
    }
  };

  const priority = getPriorityDot(task.prioritas);

  return (
    <div
      className={`group relative rounded-2xl p-4 sm:p-5 bg-surface-elevated border transition-all duration-200 ${
        isCompleted
          ? "opacity-65 bg-surface/50 border-line-subtle"
          : isUrgent
          ? "border-rose-300 dark:border-rose-800/60 shadow-2xs hover:border-rose-400"
          : "border-line shadow-2xs hover:border-line-strong hover:shadow-xs"
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Left Completion Ring / Checkbox */}
        <button
          type="button"
          onClick={handleToggleComplete}
          disabled={isPending || isDeleting}
          aria-label={isCompleted ? "Tandai belum selesai" : "Tandai selesai"}
          className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-200 ${
            isCompleted
              ? "bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500 shadow-xs"
              : "border-line-strong hover:border-accent hover:bg-accent-muted/40 text-transparent hover:text-accent"
          } disabled:opacity-50`}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          ) : isCompleted ? (
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <Check className="w-3.5 h-3.5 stroke-[2.5] opacity-0 group-hover:opacity-60" />
          )}
        </button>

        {/* Center: Title & Metadata Hierarchy */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4
                className={`text-base font-semibold tracking-tight transition-colors leading-snug ${
                  isCompleted
                    ? "line-through text-content-muted"
                    : "text-content-primary group-hover:text-accent"
                }`}
              >
                {task.namaTugas}
              </h4>

              {/* Scannable Metadata Line (Course · Due Date · Priority) */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-content-secondary">
                {task.jadwal?.namaMatkul && (
                  <span className="font-medium text-accent truncate max-w-[220px]">
                    {task.jadwal.namaMatkul}
                  </span>
                )}

                {task.jadwal?.namaMatkul && (
                  <span className="text-content-muted">·</span>
                )}

                <div className="flex items-center gap-1.5 font-mono tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-content-muted" />
                  <span>{formatIndonesianDate(task.deadline)}</span>
                </div>

                {isPast ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                    Terlewat
                  </span>
                ) : isUrgent ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    {daysLeft === 0 ? "Hari Ini" : "Besok"}
                  </span>
                ) : null}

                <span className="text-content-muted">·</span>

                {/* Restrained Priority Indicator: Color Dot + Label */}
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                  <span className={priority.text}>{priority.label}</span>
                </div>

                {task.jenis && (
                  <>
                    <span className="text-content-muted">·</span>
                    <span className="text-content-muted">{task.jenis}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right Action Icons (Edit & Delete) */}
            <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onEdit(task)}
                disabled={isPending || isDeleting}
                title="Edit Tugas"
                aria-label="Edit Tugas"
                className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface border border-transparent hover:border-line transition-all active:scale-95 disabled:opacity-50"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isPending}
                aria-busy={isDeleting}
                title="Hapus Tugas"
                aria-label="Hapus Tugas"
                className="p-1.5 rounded-lg text-content-secondary hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/40 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Interactive Progress Bar */}
          <div className="mt-3 pt-2.5 border-t border-line/60">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-content-muted font-medium flex items-center gap-1.5">
                Progress
                {isPending && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
              </span>
              <span className="font-mono tabular-nums font-bold text-accent">{progress}%</span>
            </div>

            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                aria-label={`Progress tugas ${task.namaTugas}`}
                onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-accent transition-all"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

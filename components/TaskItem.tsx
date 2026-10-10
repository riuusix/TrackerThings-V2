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

interface TaskItemProps {
  task: TugasItem;
  onEdit: (task: TugasItem) => void;
}

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const [progress, setProgress] = useState<number>(task.progress);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const daysLeft = getDaysDifference(task.deadline);
  const isUrgent = daysLeft <= 1 && task.status !== "Selesai";
  const isPast = daysLeft < 0 && task.status !== "Selesai";

  const handleProgressChange = (newVal: number) => {
    setProgress(newVal);
    startTransition(async () => {
      await updateTugasProgressAction(task.id, newVal);
    });
  };

  const handleMarkComplete = () => {
    setProgress(100);
    startTransition(async () => {
      await updateTugasProgressAction(task.id, 100);
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus tugas "${task.namaTugas}"?`)) return;
    setIsDeleting(true);
    await deleteTugasAction(task.id);
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
      className={`group relative rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md dark:hover:border-slate-700 ${
        task.status === "Selesai"
          ? "opacity-60 bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60"
          : isUrgent
          ? "border-rose-200/90 dark:border-rose-800/60 bg-gradient-to-r from-rose-50/30 dark:from-rose-950/20 to-white dark:to-slate-900/60"
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

            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
              {task.jenis}
            </span>

            {task.jadwal?.namaMatkul && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 truncate max-w-[220px]">
                {task.jadwal.namaMatkul}
              </span>
            )}
          </div>

          <h4
            className={`text-base sm:text-lg font-bold tracking-tight transition-colors ${
              task.status === "Selesai"
                ? "line-through text-slate-400 dark:text-slate-600"
                : "text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
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
              disabled={isPending}
              title="Tandai Selesai"
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(task)}
            title="Edit Tugas"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Hapus Tugas"
            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-all disabled:opacity-50 active:scale-95"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Deadline Info */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3.5">
        <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
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
      <div className="space-y-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
            Progress Pengerjaan
            {isPending && <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />}
          </span>
          <span className="text-blue-600 dark:text-blue-400 tracking-wide font-bold">{progress}%</span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500 hover:accent-blue-700 transition-all"
          />
        </div>
      </div>
    </div>
  );
}

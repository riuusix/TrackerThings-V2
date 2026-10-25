"use client";

import { useState } from "react";
import { TugasItem } from "@/types";
import { TaskItem } from "./TaskItem";
import { ListTodo, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface TaskListProps {
  urgentTasks: TugasItem[];
  completedTasks: TugasItem[];
  onEditTask: (task: TugasItem) => void;
}

export function TaskList({
  urgentTasks,
  completedTasks,
  onEditTask,
}: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent-muted border border-line-subtle flex items-center justify-center text-accent shadow-2xs">
            <ListTodo className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight">
              Tugas Akademik
            </h3>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-elevated border border-line text-content-secondary shadow-2xs">
          {urgentTasks.length} Aktif
        </span>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {urgentTasks.length === 0 ? (
          <div className="rounded-2xl p-7 sm:p-8 text-center bg-surface-elevated border border-line shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-2.5 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-content-primary text-sm sm:text-base">
              Semua Tugas Selesai
            </h4>
            <p className="text-xs text-content-secondary mt-1 max-w-xs mx-auto">
              Tidak ada tugas akademik aktif saat ini. Waktu yang tepat untuk istirahat atau mengulang materi.
            </p>
          </div>
        ) : (
          urgentTasks.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={onEditTask} />
          ))
        )}
      </div>

      {/* Completed Tasks Toggle & List */}
      {completedTasks.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-surface/60 hover:bg-surface border border-line text-xs font-semibold text-content-secondary hover:text-content-primary transition-all duration-150"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Tugas Selesai ({completedTasks.length})</span>
            </div>
            {showCompleted ? (
              <ChevronUp className="w-3.5 h-3.5 text-content-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-content-muted" />
            )}
          </button>

          {showCompleted && (
            <div className="space-y-2.5 mt-3 animate-in fade-in-50 duration-200">
              {completedTasks.map((task) => (
                <TaskItem key={task.id} task={task} onEdit={onEditTask} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

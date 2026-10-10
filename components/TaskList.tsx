"use client";

import { useState } from "react";
import { TugasItem } from "@/types";
import { TaskItem } from "./TaskItem";
import { ListTodo, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

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
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
            <ListTodo className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Tugas Mendesak
          </h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
          {urgentTasks.length} Belum Selesai
        </span>
      </div>

      {/* Lightweight Fast Tasks List */}
      <div className="space-y-3.5">
        {urgentTasks.length === 0 ? (
          <div className="rounded-2xl p-8 sm:p-10 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-3 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              Semua Tugas Selesai! 🎉
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Tidak ada tugas yang menunggu saat ini. Nikmati waktu luang atau pelajari materi perkuliahan selanjutnya!
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
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Tugas Selesai ({completedTasks.length})</span>
            </div>
            {showCompleted ? (
              <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )}
          </button>

          {showCompleted && (
            <div className="space-y-3.5 mt-3.5 animate-in fade-in-50 duration-200">
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

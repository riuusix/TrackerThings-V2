"use client";

import { useState } from "react";
import {
  TugasItem,
  UjianItem,
  JadwalGabunganItem,
  NotificationItem,
} from "@/types";
import { Navbar } from "@/components/Navbar";
import { ScheduleList } from "@/components/ScheduleList";
import { TaskList } from "@/components/TaskList";
import { TaskModal } from "@/components/TaskModal";
import { KelasPenggantiModal } from "@/components/KelasPenggantiModal";
import { formatIndonesianDate, getDaysDifference } from "@/lib/utils";
import {
  Calendar,
  Clock,
  Plus,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  MapPin,
} from "lucide-react";

interface DashboardClientProps {
  username: string;
  userEmail: string;
  role?: string;
  courses: Array<{ id: number; namaMatkul: string }>;
  schedulesByDay: Record<string, JadwalGabunganItem[]>;
  initialDay: string;
  upcomingExam: (UjianItem & { jadwal?: { namaMatkul: string } }) | null;
  urgentTasks: TugasItem[];
  completedTasks: TugasItem[];
  notifications: NotificationItem[];
}

export function DashboardClient({
  username,
  userEmail,
  role = "user",
  courses,
  schedulesByDay,
  initialDay,
  upcomingExam,
  urgentTasks,
  completedTasks,
  notifications,
}: DashboardClientProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isPenggantiModalOpen, setIsPenggantiModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TugasItem | null>(null);

  const handleOpenAddTask = () => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: TugasItem) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 pb-20 overflow-x-hidden">
      {/* Navbar with Role Prop */}
      <Navbar
        username={username}
        userEmail={userEmail}
        role={role}
        notifications={notifications}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Clean Academic Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                Semester Aktif
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Tahun Akademik 2026/2027
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Tracker
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-transparent bg-clip-text">
                Things
              </span>
              <span className="text-slate-400 dark:text-slate-500 font-light text-2xl sm:text-3xl"> — Halo, </span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {username}
              </span>
              ! 👋
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl font-normal">
              Pantau jadwal kuliah harian, target tugas akademik, dan persiapan jadwal ujian semester Anda secara efisien.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAddTask}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all duration-200 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tugas</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPenggantiModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Kelas Pengganti</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout - Fully Focused on Academic Features */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Schedules & Upcoming Exam Widget (7 cols) */}
          <div className="lg:col-span-7 space-y-7">
            {/* Schedule List with Active Tab Blue Pill */}
            <ScheduleList
              schedulesByDay={schedulesByDay}
              initialDay={initialDay}
            />

            {/* Upcoming Exam Card Widget */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  Ujian Terdekat
                </h3>
              </div>

              {upcomingExam ? (
                <div className="group relative rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md dark:hover:border-slate-700">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                          {upcomingExam.jenisUjian}
                        </span>
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {(() => {
                            const diff = getDaysDifference(upcomingExam.tanggal);
                            if (diff === 0) return "Hari Ini!";
                            if (diff < 0) return "Selesai";
                            return `${diff} hari lagi`;
                          })()}
                        </span>
                      </div>

                      <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {upcomingExam.jadwal?.namaMatkul}
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {formatIndonesianDate(upcomingExam.tanggal)}
                      </span>
                    </div>

                    {upcomingExam.waktuMulai && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {upcomingExam.waktuMulai}
                          {upcomingExam.waktuSelesai ? ` - ${upcomingExam.waktuSelesai}` : ""}
                        </span>
                      </div>
                    )}

                    {upcomingExam.ruangan && (
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        <span className="text-slate-600 dark:text-slate-300">
                          Ruangan: {upcomingExam.ruangan}
                        </span>
                      </div>
                    )}

                    {upcomingExam.catatan && (
                      <div className="sm:col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-200">Catatan:</strong>{" "}
                        {upcomingExam.catatan}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-6 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Tidak Ada Ujian Mendatang
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Semua jadwal evaluasi telah terlaksana atau belum ada jadwal ujian aktif.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Tasks (5 cols) */}
          <div className="lg:col-span-5">
            <TaskList
              urgentTasks={urgentTasks}
              completedTasks={completedTasks}
              onEditTask={handleOpenEditTask}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        courses={courses}
      />

      <KelasPenggantiModal
        isOpen={isPenggantiModalOpen}
        onClose={() => setIsPenggantiModalOpen(false)}
        courses={courses}
      />
    </div>
  );
}

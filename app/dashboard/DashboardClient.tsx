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
import { AcademicBriefingBanner } from "@/components/AcademicBriefingBanner";
import type { AcademicIntelligenceSummary } from "@/lib/intelligence/academicInsights";
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
  profilePictureUrl?: string | null;
  courses: Array<{ id: number; namaMatkul: string }>;
  schedulesByDay: Record<string, JadwalGabunganItem[]>;
  initialDay: string;
  upcomingExam: (UjianItem & { jadwal?: { namaMatkul: string } }) | null;
  urgentTasks: TugasItem[];
  completedTasks: TugasItem[];
  notifications: NotificationItem[];
  academicSummary?: AcademicIntelligenceSummary;
}

export function DashboardClient({
  username,
  userEmail,
  role = "user",
  profilePictureUrl,
  courses,
  schedulesByDay,
  initialDay,
  upcomingExam,
  urgentTasks,
  completedTasks,
  notifications,
  academicSummary,
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
    <div className="relative min-h-screen bg-canvas text-content-primary transition-colors duration-200 pb-20 overflow-x-hidden">
      {/* Navbar with Role & Profile Picture */}
      <Navbar
        username={username}
        userEmail={userEmail}
        role={role}
        profilePictureUrl={profilePictureUrl}
        notifications={notifications}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Clean Academic Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-3 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-accent-muted text-accent border border-line-subtle">
                Semester Aktif
              </span>
              <span className="text-xs text-content-secondary font-medium">
                Tahun Akademik 2026/2027
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-content-primary">
              Tracker<span className="text-accent font-extrabold">Things</span>
              <span className="text-content-muted font-light text-2xl sm:text-3xl"> — Halo, </span>
              <span className="text-accent font-bold">
                {username}
              </span>
              !
            </h1>

            <p className="text-sm text-content-secondary mt-1.5 max-w-2xl font-normal">
              Pantau jadwal kuliah harian, target tugas akademik, dan persiapan jadwal ujian semester Anda secara efisien.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAddTask}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tugas</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPenggantiModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm text-content-primary bg-surface-elevated hover:bg-surface border border-line shadow-xs transition-all duration-200 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-accent" />
              <span>Kelas Pengganti</span>
            </button>
          </div>
        </div>

        {/* Academic Intelligence Daily Briefing Banner */}
        {academicSummary && (
          <AcademicBriefingBanner summary={academicSummary} />
        )}

        {/* 2-Column Responsive Layout - Fully Focused on Academic Features */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Schedules (7 cols) */}
          <div className="lg:col-span-7 space-y-7">
            {/* Schedule List with Active Tab Soft Blue Pill */}
            <ScheduleList
              schedulesByDay={schedulesByDay}
              initialDay={initialDay}
            />
          </div>

          {/* Right Column: Upcoming Exam Widget & Tasks (5 cols) */}
          <div className="lg:col-span-5 space-y-7">
            {/* Upcoming Exam Card Widget */}
            {upcomingExam && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 px-1">
                  <div className="w-8 h-8 rounded-xl bg-accent-muted border border-line-subtle flex items-center justify-center text-accent shadow-xs">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-content-primary tracking-tight">
                    Ujian Terdekat
                  </h3>
                </div>

                <div className="group relative rounded-2xl p-5 sm:p-6 bg-surface-elevated border border-line shadow-xs transition-all duration-200 hover:border-line-strong">
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

                      <h4 className="text-xl font-bold text-content-primary tracking-tight group-hover:text-accent transition-colors">
                        {upcomingExam.jadwal?.namaMatkul}
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-line text-xs sm:text-sm text-content-secondary">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-content-muted" />
                      <span className="text-content-primary font-medium">
                        {formatIndonesianDate(upcomingExam.tanggal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-content-muted" />
                      <span className="text-content-primary font-medium">
                        {upcomingExam.waktuMulai} - {upcomingExam.waktuSelesai} WIB
                      </span>
                    </div>

                    {upcomingExam.ruangan && (
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <MapPin className="w-4 h-4 text-content-muted" />
                        <span className="text-content-secondary">
                          Ruang {upcomingExam.ruangan}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Task List (Pending & Completed) */}
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

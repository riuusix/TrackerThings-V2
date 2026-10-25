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
  CalendarPlus,
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

  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-7">
        {/* Editorial Academic Greeting & Context Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs text-content-secondary font-medium">
              <span className="text-accent font-semibold font-mono tabular-nums">
                {todayFormatted}
              </span>
              <span className="text-content-muted">·</span>
              <span className="text-content-secondary font-medium">
                Semester Aktif 2026/2027
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-content-primary">
              Selamat Datang, <span className="text-accent">{username}</span>
            </h1>

            <p className="text-xs sm:text-sm text-content-secondary mt-1 font-normal">
              Ringkasan jadwal kuliah, persiapan ujian, dan prioritas tugas akademik Anda.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddTask}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tugas</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPenggantiModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm text-content-primary bg-surface-elevated hover:bg-surface border border-line shadow-2xs transition-all duration-200 active:scale-95"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-accent" />
              <span>Kelas Pengganti</span>
            </button>
          </div>
        </header>

        {/* Academic Intelligence Daily Briefing Banner */}
        {academicSummary && (
          <AcademicBriefingBanner summary={academicSummary} />
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Left Column: Schedules Timeline (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <ScheduleList
              schedulesByDay={schedulesByDay}
              initialDay={initialDay}
            />
          </div>

          {/* Right Column: Upcoming Exam Widget & Tasks (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Upcoming Exam Editorial Countdown Callout */}
            {upcomingExam && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-line/60">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-accent shrink-0" />
                    <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight">
                      Ujian Terdekat
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                    {upcomingExam.jenisUjian}
                  </span>
                </div>

                <div className="group relative rounded-2xl p-4 sm:p-5 bg-surface-elevated border border-line shadow-2xs transition-all duration-200 hover:border-line-strong">
                  <div className="flex items-center gap-4">
                    {/* Tabular Countdown Block */}
                    <div className="shrink-0 w-20 sm:w-24 py-2.5 px-2 rounded-xl bg-surface border border-line-subtle text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-content-muted">
                        Tenggat
                      </span>
                      <p className="font-mono tabular-nums text-sm sm:text-base font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                        {(() => {
                          const diff = getDaysDifference(upcomingExam.tanggal);
                          if (diff === 0) return "Hari Ini";
                          if (diff < 0) return "Selesai";
                          return `H-${diff}`;
                        })()}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-base sm:text-lg font-bold text-content-primary tracking-tight group-hover:text-accent transition-colors leading-snug truncate">
                        {upcomingExam.jadwal?.namaMatkul}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-content-secondary font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-content-muted shrink-0" />
                          <span className="text-content-primary font-medium">
                            {formatIndonesianDate(upcomingExam.tanggal)}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-content-muted shrink-0" />
                          <span>
                            {upcomingExam.waktuMulai} – {upcomingExam.waktuSelesai} WIB
                          </span>
                        </span>
                      </div>

                      {upcomingExam.ruangan && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-content-secondary">
                          <MapPin className="w-3.5 h-3.5 text-content-muted shrink-0" />
                          <span>Ruang {upcomingExam.ruangan}</span>
                        </div>
                      )}
                    </div>
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

"use client";

import {
  BookOpen,
  Clock,
  GraduationCap,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
} from "lucide-react";
import type { AcademicIntelligenceSummary } from "@/lib/intelligence/academicInsights";

interface AcademicBriefingBannerProps {
  summary: AcademicIntelligenceSummary;
}

export function AcademicBriefingBanner({ summary }: AcademicBriefingBannerProps) {
  const briefing = summary.briefing;
  const conflicts = summary.conflicts || [];

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "urgent":
        return {
          label: "Perhatian Diperlukan",
          className:
            "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/40",
          dotColor: "bg-rose-500",
        };
      case "heavy":
        return {
          label: "Hari Padat",
          className:
            "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
          dotColor: "bg-amber-500",
        };
      case "moderate":
        return {
          label: "Beban Moderat",
          className: "bg-accent-muted text-accent border-line-subtle",
          dotColor: "bg-accent",
        };
      default:
        return {
          label: "Jadwal Tenang",
          className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
          dotColor: "bg-emerald-500",
        };
    }
  };

  const badge = getStatusBadge(briefing?.status);

  return (
    <section
      aria-label="Ringkasan Akademik Hari Ini"
      className="relative rounded-2xl bg-surface-elevated border border-line shadow-2xs overflow-hidden"
    >
      {/* Subtle Soft-Blue Left Accent Rail */}
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent" />

      {/* Top Narrative Strip */}
      <div className="p-5 sm:px-6 sm:py-5 pl-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Ringkasan Akademik Hari Ini
            </span>
            {briefing && (
              <span className="text-xs font-mono tabular-nums text-content-muted">
                · {briefing.dayName}, {briefing.date}
              </span>
            )}
          </div>

          {briefing && (
            <p className="text-base sm:text-lg font-bold text-content-primary leading-snug tracking-tight">
              {briefing.headline}
            </p>
          )}
        </div>

        <div
          className={`self-start lg:self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border shrink-0 ${badge.className}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Hairline-Divided Metric Strip (Eliminating Card-Inside-Card Nesting) */}
      {briefing && (
        <div className="border-t border-line bg-surface/40 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line pl-1">
          {/* Today's Classes */}
          <div className="px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                Jadwal Kuliah
              </span>
              <BookOpen className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-content-primary tracking-tight">
              {briefing.todayClassesCount}{" "}
              <span className="text-xs font-sans font-semibold text-content-secondary">
                Kelas
              </span>
            </div>
            <div className="text-[11px] font-mono tabular-nums text-content-muted mt-0.5">
              {briefing.todayTotalSks} SKS hari ini
            </div>
          </div>

          {/* Overdue Tasks */}
          <div
            className={`px-4 py-3.5 sm:px-5 ${
              briefing.overdueTasksCount > 0
                ? "bg-rose-50/40 dark:bg-rose-950/20"
                : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  briefing.overdueTasksCount > 0
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-content-muted"
                }`}
              >
                Tugas Terlewat
              </span>
              {briefing.overdueTasksCount > 0 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight ${
                briefing.overdueTasksCount > 0
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-content-primary"
              }`}
            >
              {briefing.overdueTasksCount}{" "}
              <span className="text-xs font-sans font-semibold text-content-secondary">
                Tugas
              </span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              {briefing.overdueTasksCount > 0
                ? "Perlu segera ditinjau"
                : "Semua terkendali"}
            </div>
          </div>

          {/* Due Today Tasks */}
          <div className="px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                Tenggat Hari Ini
              </span>
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-content-primary tracking-tight">
              {briefing.dueTodayTasksCount}{" "}
              <span className="text-xs font-sans font-semibold text-content-secondary">
                Tugas
              </span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              {briefing.dueTodayTasksCount > 0
                ? "Batas akhir 23:59"
                : "Tidak ada batas akhir"}
            </div>
          </div>

          {/* Upcoming Exams (7 Days) */}
          <div className="px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                Ujian Mendatang
              </span>
              <GraduationCap className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-content-primary tracking-tight">
              {briefing.upcomingExamsCount}{" "}
              <span className="text-xs font-sans font-semibold text-content-secondary">
                Ujian
              </span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              Dalam 7 hari ke depan
            </div>
          </div>
        </div>
      )}

      {/* Schedule Conflicts Alert Banner */}
      {conflicts.length > 0 && (
        <div className="px-6 py-3.5 bg-rose-50 dark:bg-rose-950/30 border-t border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200 text-xs sm:text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>Peringatan Bentrok Jadwal Kuliah ({conflicts.length})</span>
          </div>
          <ul className="space-y-1 pl-6 list-disc text-xs text-rose-700/90 dark:text-rose-300/90">
            {conflicts.map((c) => (
              <li key={c.id}>
                <strong>{c.day}:</strong> {c.item1.title} ({c.item1.time}) bertabrakan dengan {c.item2.title} ({c.item2.time}).
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

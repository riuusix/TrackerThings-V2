"use client";

import {
  Sparkles,
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
          className:
            "bg-accent-muted text-accent border-line-subtle",
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
    <div className="relative rounded-2xl p-5 sm:p-6 bg-surface-elevated border border-line shadow-2xs space-y-4 overflow-hidden">
      {/* Subtle Soft-Blue Left Accent Rail */}
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent/60" />

      {/* Top Meta & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pl-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-muted border border-line-subtle flex items-center justify-center text-accent">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
            Ringkasan Akademik Hari Ini
          </span>
          {briefing && (
            <span className="hidden sm:inline text-xs text-content-muted font-normal">
              • {briefing.dayName}, {briefing.date}
            </span>
          )}
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${badge.className}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Editorial Narrative Headline */}
      {briefing && (
        <div className="pl-1">
          <p className="text-base sm:text-lg font-bold text-content-primary leading-snug tracking-tight">
            {briefing.headline}
          </p>
        </div>
      )}

      {/* Scannable Metric Counters Grid */}
      {briefing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 pl-1">
          {/* Today's Classes */}
          <div className="p-3 rounded-xl bg-surface/70 border border-line-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-content-secondary font-medium">Jadwal Kuliah</span>
              <BookOpen className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-content-primary tracking-tight">
              {briefing.todayClassesCount} <span className="text-xs font-semibold text-content-muted">Kelas</span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              {briefing.todayTotalSks} SKS hari ini
            </div>
          </div>

          {/* Overdue Tasks */}
          <div
            className={`p-3 rounded-xl border ${
              briefing.overdueTasksCount > 0
                ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                : "bg-surface/70 border-line-subtle"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-xs font-medium ${
                  briefing.overdueTasksCount > 0 ? "text-rose-700 dark:text-rose-300" : "text-content-secondary"
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
              className={`text-xl sm:text-2xl font-black tracking-tight ${
                briefing.overdueTasksCount > 0
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-content-primary"
              }`}
            >
              {briefing.overdueTasksCount} <span className="text-xs font-semibold text-content-muted">Tugas</span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              {briefing.overdueTasksCount > 0 ? "Perlu segera ditinjau" : "Semua terkendali"}
            </div>
          </div>

          {/* Due Today Tasks */}
          <div className="p-3 rounded-xl bg-surface/70 border border-line-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-content-secondary font-medium">Tenggat Hari Ini</span>
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-content-primary tracking-tight">
              {briefing.dueTodayTasksCount} <span className="text-xs font-semibold text-content-muted">Tugas</span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              {briefing.dueTodayTasksCount > 0 ? "Batas akhir 23:59" : "Tidak ada batas akhir"}
            </div>
          </div>

          {/* Upcoming Exams (7 Days) */}
          <div className="p-3 rounded-xl bg-surface/70 border border-line-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-content-secondary font-medium">Ujian Mendatang</span>
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-content-primary tracking-tight">
              {briefing.upcomingExamsCount} <span className="text-xs font-semibold text-content-muted">Ujian</span>
            </div>
            <div className="text-[11px] text-content-muted mt-0.5">
              Dalam 7 hari ke depan
            </div>
          </div>
        </div>
      )}

      {/* Schedule Conflicts Alert Banner */}
      {conflicts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200 text-xs sm:text-sm space-y-1.5 animate-in fade-in-50 duration-200 ml-1">
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
    </div>
  );
}

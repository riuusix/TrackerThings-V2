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
    <div className="rounded-2xl p-5 sm:p-6 bg-surface-elevated border border-line shadow-xs space-y-4">
      {/* Header Row: Label & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-muted border border-line-subtle flex items-center justify-center text-accent">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
            Ringkasan Akademik Hari Ini
          </span>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Main Narrative Headline */}
      {briefing && (
        <p className="text-sm sm:text-base font-semibold text-content-primary leading-relaxed">
          {briefing.headline}
        </p>
      )}

      {/* Key Metric Chips */}
      {briefing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Classes */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface border border-line-subtle">
            <BookOpen className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-content-primary truncate">
                {briefing.todayClassesCount} Kuliah
              </div>
              <div className="text-[11px] text-content-muted">
                {briefing.todayTotalSks} SKS
              </div>
            </div>
          </div>

          {/* Overdue Tasks */}
          <div
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
              briefing.overdueTasksCount > 0
                ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                : "bg-surface border-line-subtle"
            }`}
          >
            {briefing.overdueTasksCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div
                className={`text-xs font-bold truncate ${
                  briefing.overdueTasksCount > 0
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-content-primary"
                }`}
              >
                {briefing.overdueTasksCount} Terlewat
              </div>
              <div className="text-[11px] text-content-muted">Tenggat Lewat</div>
            </div>
          </div>

          {/* Due Today Tasks */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface border border-line-subtle">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-content-primary truncate">
                {briefing.dueTodayTasksCount} Hari Ini
              </div>
              <div className="text-[11px] text-content-muted">Tenggat Tugas</div>
            </div>
          </div>

          {/* Upcoming Exams (7 days) */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface border border-line-subtle">
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-content-primary truncate">
                {briefing.upcomingExamsCount} Ujian
              </div>
              <div className="text-[11px] text-content-muted">Dalam 7 Hari</div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Conflicts Alert Banner */}
      {conflicts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200 text-xs sm:text-sm space-y-1.5 animate-in fade-in-50 duration-200">
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

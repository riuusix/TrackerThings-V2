/**
 * Deterministic Academic Intelligence Engine (Milestone M1)
 *
 * Domain foundation for academic insights (overdue, due_today, due_tomorrow, upcoming).
 * Fully pure and rule-based:
 * - Requires explicit referenceDate ("YYYY-MM-DD") and IANA timezone.
 * - Zero reliance on ambient system clock (no unparameterized new Date()).
 * - Zero database mutations, zero LLM dependencies, zero external network calls.
 * - 100% deterministic, explainable, and idempotent.
 */

// ============================================================================
// 1. Types & Data Models
// ============================================================================

export type InsightCategory = "overdue" | "due_today" | "due_tomorrow" | "upcoming";

export type InsightPriority = "urgent" | "high" | "medium" | "low";

export type AcademicItemType = "tugas" | "ujian";

export interface AcademicItem {
  id: number | string;
  type: AcademicItemType;
  title: string;
  courseName?: string | null;
  /**
   * Calendar date of the deadline or exam.
   * Accepts "YYYY-MM-DD" string, ISO datetime string, or Date instance (@db.Date UTC midnight).
   */
  date: string | Date;
  /**
   * Optional specific time ("HH:mm").
   */
  time?: string | null;
  /**
   * Status of the item, e.g. "Belum Dikerjakan", "Sedang Dikerjakan", "Selesai".
   * Completed items ("Selesai") are filtered out from actionable insights.
   */
  status?: string | null;
  /**
   * Priority of the item, e.g. "Tinggi", "Sedang", "Rendah".
   */
  priority?: "Tinggi" | "Sedang" | "Rendah" | string | null;
}

export interface AcademicInsight {
  id: string;
  itemId: number | string;
  itemType: AcademicItemType;
  title: string;
  courseName: string | null;
  category: InsightCategory;
  priority: InsightPriority;
  /**
   * Numeric score used for deterministic, stable sorting.
   * Higher score = higher ranking.
   */
  priorityScore: number;
  /**
   * Calendar days difference relative to referenceDate (target - reference).
   * < 0 for overdue, 0 for today, 1 for tomorrow, >= 2 for upcoming.
   */
  daysDifference: number;
  targetDate: string;
  referenceDate: string;
  timezone: string;
  reason: string;
  actionRecommendation?: string;
}

export interface AcademicIntelligenceContext {
  /**
   * Calendar reference date in strict "YYYY-MM-DD" format.
   * Evaluated explicitly without relying on ambient system clock.
   */
  referenceDate: string;
  /**
   * Valid IANA timezone string (e.g. "Asia/Jakarta", "UTC", "America/New_York").
   */
  timezone: string;
  /**
   * Maximum calendar days ahead to consider for 'upcoming' category.
   * Defaults to 7 days if omitted.
   */
  upcomingWindowDays?: number;
}

export interface AcademicIntelligenceSummary {
  referenceDate: string;
  timezone: string;
  upcomingWindowDays: number;
  totalItemsEvaluated: number;
  totalInsightsGenerated: number;
  countsByCategory: {
    overdue: number;
    due_today: number;
    due_tomorrow: number;
    upcoming: number;
  };
  insights: AcademicInsight[];
}

// ============================================================================
// 2. Pure Date Context & Timezone Utilities
// ============================================================================

const INDONESIAN_MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function isValidCalendarValues(year: number, month: number, day: number): boolean {
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const testUtc = new Date(Date.UTC(year, month - 1, day));
  return (
    testUtc.getUTCFullYear() === year &&
    testUtc.getUTCMonth() === month - 1 &&
    testUtc.getUTCDate() === day
  );
}

export function validateReferenceDate(
  dateInput: unknown
): { valid: true; date: string } | { valid: false; error: string } {
  if (typeof dateInput !== "string") {
    return {
      valid: false,
      error: `referenceDate must be a string, received ${typeof dateInput}.`,
    };
  }

  const trimmed = dateInput.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return {
      valid: false,
      error: `referenceDate "${dateInput}" is invalid. Expected strict "YYYY-MM-DD" format.`,
    };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (!isValidCalendarValues(year, month, day)) {
    return {
      valid: false,
      error: `referenceDate "${dateInput}" does not exist in the Gregorian calendar.`,
    };
  }

  return { valid: true, date: trimmed };
}

export function validateTimezone(
  timezoneInput: unknown
): { valid: true; timezone: string } | { valid: false; error: string } {
  if (typeof timezoneInput !== "string" || !timezoneInput.trim()) {
    return {
      valid: false,
      error: `timezone must be a non-empty string, received ${typeof timezoneInput}.`,
    };
  }

  const trimmed = timezoneInput.trim();
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return { valid: true, timezone: trimmed };
  } catch {
    return {
      valid: false,
      error: `Invalid IANA timezone: "${timezoneInput}". Example valid zones: "Asia/Jakarta", "UTC", "America/New_York".`,
    };
  }
}

export function formatIndonesianCalendarDate(calendarDateStr: string): string {
  const match = calendarDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return calendarDateStr;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  const monthName = INDONESIAN_MONTH_NAMES[m - 1] || "";
  return `${d} ${monthName} ${y}`.trim();
}

export function extractCalendarDate(
  dateInput: string | Date | null | undefined,
  timezone: string
): string | null {
  if (!dateInput) return null;

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;

    // Direct calendar date "YYYY-MM-DD"
    const directMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (directMatch) {
      const y = parseInt(directMatch[1], 10);
      const m = parseInt(directMatch[2], 10);
      const d = parseInt(directMatch[3], 10);
      return isValidCalendarValues(y, m, d) ? trimmed : null;
    }

    // Prisma @db.Date string "YYYY-MM-DDT00:00:00.000Z"
    const prismaMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)?$/);
    if (prismaMatch) {
      const y = parseInt(prismaMatch[1], 10);
      const m = parseInt(prismaMatch[2], 10);
      const d = parseInt(prismaMatch[3], 10);
      const dateStr = `${prismaMatch[1]}-${prismaMatch[2]}-${prismaMatch[3]}`;
      return isValidCalendarValues(y, m, d) ? dateStr : null;
    }

    // Absolute datetime string with non-zero time: resolve in specified timezone
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;

    return extractDateInTimezone(parsed, timezone);
  }

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;

    // Prisma @db.Date instance (UTC midnight)
    if (
      dateInput.getUTCHours() === 0 &&
      dateInput.getUTCMinutes() === 0 &&
      dateInput.getUTCSeconds() === 0 &&
      dateInput.getUTCMilliseconds() === 0
    ) {
      const y = dateInput.getUTCFullYear();
      const m = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dateInput.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    return extractDateInTimezone(dateInput, timezone);
  }

  return null;
}

function extractDateInTimezone(date: Date, timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) return null;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  } catch {
    return null;
  }
}

export function calculateCalendarDaysDifference(
  targetDateStr: string,
  referenceDateStr: string
): number {
  const [ty, tm, td] = targetDateStr.split("-").map(Number);
  const [ry, rm, rd] = referenceDateStr.split("-").map(Number);
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const refUtc = Date.UTC(ry, rm - 1, rd);
  return Math.round((targetUtc - refUtc) / 86400000);
}

// ============================================================================
// 3. Deterministic Evaluation Engine
// ============================================================================

const CATEGORY_WEIGHT: Record<InsightCategory, number> = {
  overdue: 4000,
  due_today: 3000,
  due_tomorrow: 2000,
  upcoming: 1000,
};

const PRIORITY_WEIGHT: Record<string, number> = {
  tinggi: 300,
  urgent: 300,
  sedang: 200,
  high: 200,
  rendah: 100,
  medium: 100,
  low: 50,
};

function normalizePriorityWeight(p?: string | null): number {
  if (!p) return 150;
  const key = p.trim().toLowerCase();
  return PRIORITY_WEIGHT[key] ?? 150;
}

function resolveInsightPriority(
  category: InsightCategory,
  itemPriority?: string | null
): InsightPriority {
  const isHighUrgencyItem =
    itemPriority?.trim().toLowerCase() === "tinggi" ||
    itemPriority?.trim().toLowerCase() === "urgent";

  switch (category) {
    case "overdue":
      return "urgent";
    case "due_today":
      return isHighUrgencyItem ? "urgent" : "high";
    case "due_tomorrow":
      return isHighUrgencyItem ? "high" : "medium";
    case "upcoming":
      return isHighUrgencyItem ? "medium" : "low";
  }
}

function buildExplainableReason(
  item: AcademicItem,
  category: InsightCategory,
  daysDiff: number,
  formattedDate: string
): { reason: string; actionRecommendation: string } {
  const typeLabel = item.type === "ujian" ? "Ujian" : "Tugas";
  const courseSuffix = item.courseName ? ` untuk mata kuliah ${item.courseName}` : "";

  switch (category) {
    case "overdue": {
      const daysAgo = Math.abs(daysDiff);
      const dayText = daysAgo === 1 ? "1 hari" : `${daysAgo} hari`;
      return {
        reason: `${typeLabel} "${item.title}"${courseSuffix} telah melewati batas waktu ${dayText} yang lalu (tenggat: ${formattedDate}).`,
        actionRecommendation:
          item.type === "ujian"
            ? "Pastikan kehadiran dan nilai ujian telah tercatat dengan benar."
            : "Prioritaskan penyelesaian segera dan koordinasikan dengan dosen pengampu.",
      };
    }
    case "due_today":
      return {
        reason: `${typeLabel} "${item.title}"${courseSuffix} jatuh tempo hari ini (${formattedDate}).`,
        actionRecommendation:
          item.type === "ujian"
            ? "Periksa kembali ruangan dan perlengkapan sebelum ujian dimulai."
            : "Selesaikan dan kumpulkan tugas hari ini sebelum sistem ditutup.",
      };
    case "due_tomorrow":
      return {
        reason: `${typeLabel} "${item.title}"${courseSuffix} jatuh tempo besok (${formattedDate}).`,
        actionRecommendation:
          item.type === "ujian"
            ? "Tinjau kembali ringkasan materi dan pastikan istirahat yang cukup malam ini."
            : "Finalisasi tugas hari ini agar tidak terburu-buru saat batas waktu berakhir.",
      };
    case "upcoming":
      return {
        reason: `${typeLabel} "${item.title}"${courseSuffix} akan jatuh tempo dalam ${daysDiff} hari (${formattedDate}).`,
        actionRecommendation:
          item.type === "ujian"
            ? "Pelajari kisi-kisi dan susun jadwal belajar terencana."
            : "Mulai cicil pengerjaan tugas secara bertahap agar tidak menumpuk.",
      };
  }
}

export function evaluateAcademicItem(
  item: AcademicItem,
  context: AcademicIntelligenceContext
): AcademicInsight | null {
  if (!item || !item.id || !item.title) return null;

  // Filter out completed tasks
  if (item.type === "tugas" && item.status?.trim().toLowerCase() === "selesai") {
    return null;
  }

  // Extract pure calendar target date
  const targetDateStr = extractCalendarDate(item.date, context.timezone);
  if (!targetDateStr) return null;

  // Calculate calendar days difference (target - reference)
  const daysDiff = calculateCalendarDaysDifference(targetDateStr, context.referenceDate);
  const upcomingWindow = context.upcomingWindowDays ?? 7;

  // Resolve category based on explicit rules
  let category: InsightCategory;
  if (daysDiff < 0) {
    category = "overdue";
  } else if (daysDiff === 0) {
    category = "due_today";
  } else if (daysDiff === 1) {
    category = "due_tomorrow";
  } else if (daysDiff <= upcomingWindow) {
    category = "upcoming";
  } else {
    // Outside upcoming window
    return null;
  }

  const priority = resolveInsightPriority(category, item.priority);
  const categoryWeight = CATEGORY_WEIGHT[category];
  const priorityWeight = normalizePriorityWeight(item.priority);

  let distanceScore = 0;
  if (category === "overdue") {
    distanceScore = Math.min(Math.abs(daysDiff), 99);
  } else if (category === "upcoming") {
    distanceScore = Math.max(0, 100 - daysDiff);
  }

  const priorityScore = categoryWeight + priorityWeight + distanceScore;
  const formattedDate = formatIndonesianCalendarDate(targetDateStr);
  const { reason, actionRecommendation } = buildExplainableReason(
    item,
    category,
    daysDiff,
    formattedDate
  );

  return {
    id: `insight-${item.type}-${item.id}-${category}`,
    itemId: item.id,
    itemType: item.type,
    title: item.title,
    courseName: item.courseName || null,
    category,
    priority,
    priorityScore,
    daysDifference: daysDiff,
    targetDate: targetDateStr,
    referenceDate: context.referenceDate,
    timezone: context.timezone,
    reason,
    actionRecommendation,
  };
}

export function compareAcademicInsights(a: AcademicInsight, b: AcademicInsight): number {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }
  if (a.targetDate !== b.targetDate) {
    return a.targetDate.localeCompare(b.targetDate);
  }
  const titleCompare = a.title.localeCompare(b.title);
  if (titleCompare !== 0) {
    return titleCompare;
  }
  return String(a.itemId).localeCompare(String(b.itemId));
}

export function evaluateAcademicInsights(
  items: AcademicItem[],
  context: AcademicIntelligenceContext
): AcademicIntelligenceSummary {
  const dateValidation = validateReferenceDate(context?.referenceDate);
  if (!dateValidation.valid) {
    throw new Error(`[AcademicIntelligence] ${dateValidation.error}`);
  }

  const tzValidation = validateTimezone(context?.timezone);
  if (!tzValidation.valid) {
    throw new Error(`[AcademicIntelligence] ${tzValidation.error}`);
  }

  const normalizedContext: AcademicIntelligenceContext = {
    referenceDate: dateValidation.date,
    timezone: tzValidation.timezone,
    upcomingWindowDays: context.upcomingWindowDays ?? 7,
  };

  const safeItems = Array.isArray(items) ? items : [];
  const insights: AcademicInsight[] = [];
  const counts = {
    overdue: 0,
    due_today: 0,
    due_tomorrow: 0,
    upcoming: 0,
  };

  for (const item of safeItems) {
    const insight = evaluateAcademicItem(item, normalizedContext);
    if (insight) {
      insights.push(insight);
      counts[insight.category]++;
    }
  }

  insights.sort(compareAcademicInsights);

  return {
    referenceDate: normalizedContext.referenceDate,
    timezone: normalizedContext.timezone,
    upcomingWindowDays: normalizedContext.upcomingWindowDays!,
    totalItemsEvaluated: safeItems.length,
    totalInsightsGenerated: insights.length,
    countsByCategory: counts,
    insights,
  };
}


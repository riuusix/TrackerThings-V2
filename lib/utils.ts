import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIndonesianDate(dateInput: Date | string): string {
  if (!dateInput) return "";

  // Tanggal kalender (YYYY-MM-DD) tidak memiliki zona waktu.
  // Gunakan UTC anchor agar representasi kalender tidak bergeser saat diformat di browser dengan timezone lokal apa pun.
  let y: number, m: number, d: number;
  if (typeof dateInput === "string") {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      y = parseInt(match[1], 10);
      m = parseInt(match[2], 10);
      d = parseInt(match[3], 10);
    } else {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) return "";
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  } else if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "";
    y = dateInput.getUTCFullYear();
    m = dateInput.getUTCMonth() + 1;
    d = dateInput.getUTCDate();
  } else {
    return "";
  }

  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(utcDate);
}

const INDONESIAN_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

/**
 * Mendapatkan nama hari dalam bahasa Indonesia untuk tanggal kalender murni (@db.Date).
 * Tidak terpengaruh pergeseran zona waktu lokal perangkat/server karena dijangkarkan pada tanggal kalender UTC.
 */
export function getCalendarDayName(dateInput: Date | string): string {
  if (!dateInput) return "";

  let y: number, m: number, d: number;
  if (typeof dateInput === "string") {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      y = parseInt(match[1], 10);
      m = parseInt(match[2], 10);
      d = parseInt(match[3], 10);
    } else {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) return "";
      return INDONESIAN_DAY_NAMES[parsed.getDay()];
    }
  } else if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "";
    y = dateInput.getUTCFullYear();
    m = dateInput.getUTCMonth() + 1;
    d = dateInput.getUTCDate();
  } else {
    return "";
  }

  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return INDONESIAN_DAY_NAMES[utcDate.getUTCDay()];
}

/**
 * Mengonversi tanggal kalender ke format string "YYYY-MM-DD" yang aman untuk input HTML <input type="date">
 * atau payload API tanpa pergeseran zona waktu.
 */
export function formatCalendarDateInput(dateInput?: Date | string | null): string {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "";
    const y = dateInput.getUTCFullYear();
    const m = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dateInput.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

/**
 * Memformat timestamp absolut (seperti createdAt / profileUpdatedAt / audit log)
 * ke format tanggal & waktu lokal pengguna.
 * Menggunakan zona waktu perangkat/browser lokal pengguna secara dinamis (TIDAK di-hardcode).
 */
export function formatIndonesianDateTime(dateInput: Date | string): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Menghitung selisih hari kalender antara hari ini (berdasarkan kalender lokal perangkat pengguna)
 * dengan tanggal target kalender (YYYY-MM-DD).
 * Tidak terpengaruh pergeseran jam atau offset UTC.
 */
export function getDaysDifference(targetDate: Date | string): number {
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let targetYear: number, targetMonth: number, targetDay: number;
  if (typeof targetDate === "string") {
    const match = targetDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      targetYear = parseInt(match[1], 10);
      targetMonth = parseInt(match[2], 10) - 1;
      targetDay = parseInt(match[3], 10);
    } else {
      const d = new Date(targetDate);
      targetYear = d.getFullYear();
      targetMonth = d.getMonth();
      targetDay = d.getDate();
    }
  } else {
    targetYear = targetDate.getUTCFullYear();
    targetMonth = targetDate.getUTCMonth();
    targetDay = targetDate.getUTCDate();
  }

  const targetLocal = new Date(targetYear, targetMonth, targetDay);
  const diffMs = targetLocal.getTime() - todayLocal.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function sanitizeRedirectPath(path?: string | null, fallback = "/dashboard"): string {
  if (!path || typeof path !== "string") return fallback;
  const trimmed = path.trim();

  // Must begin with a single slash and cannot start with // or /\
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Reject newlines, CR, tabs
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  // Check URL decoding for encoded backslashes (%5c, %5C), encoded slashes (%2f, %2F), or control chars
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // Malformed URI encoding
    return fallback;
  }

  // After decoding, must not contain backslashes or protocol-relative slashes
  if (decoded.includes("\\") || decoded.startsWith("//")) {
    return fallback;
  }

  // Reject schemes like javascript:, data:, vbscript: in both encoded and decoded forms
  if (
    /^(?:\/+)?[a-zA-Z0-9+.-]+:/.test(decoded.slice(1)) ||
    /^(?:\/+)?[a-zA-Z0-9+.-]+:/.test(trimmed.slice(1))
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");

    // Origin must strictly be localhost (no host spoofing)
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }

    // Normalize pathname: remove trailing slashes for comparison
    const normalizedPath = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const disallowedAuthPaths = ["/login", "/register", "/recovery"];

    // Prevent exact match or subpath matches of auth routes to avoid redirect loops
    if (disallowedAuthPaths.some((p) => normalizedPath === p || normalizedPath.startsWith(p + "/"))) {
      return fallback;
    }

    // Return strictly pathname and search params (strips hash, credentials, etc.)
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}

/**
 * Mengonversi string waktu "HH:mm" atau "HH:mm:ss" menjadi objek Date dummy (1970-01-01T[time]Z)
 * yang kompatibel dengan kolom PostgreSQL 'time without time zone' (@db.Time di Prisma).
 */
export function parseTimeToDate(timeStr?: string | null): Date | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = match[1].padStart(2, "0");
  const m = match[2];
  const s = match[3] || "00";
  const d = new Date(`1970-01-01T${h}:${m}:${s}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Mengonversi objek Date dari kolom PostgreSQL 'time without time zone' kembali menjadi string "HH:mm".
 */
export function formatTimeFromDate(dateInput?: Date | string | null, fallback = "00:00"): string {
  if (!dateInput) return fallback;
  if (typeof dateInput === "string") {
    // Jika sudah string "HH:mm" atau "HH:mm:ss"
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dateInput.trim())) {
      const parts = dateInput.trim().split(":");
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
  }
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return fallback;
  // Gunakan UTC hours dan minutes karena anchor dummy 1970-01-01 memakai UTC
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Mengonversi input tanggal kalender (YYYY-MM-DD, string datetime, atau objek Date)
 * menjadi objek Date UTC midnight (YYYY-MM-DDT00:00:00.000Z) yang kompatibel dengan
 * kolom PostgreSQL 'date' (@db.Date di Prisma).
 *
 * PENTING: Tanggal kalender (deadline tugas, tanggal ujian, tanggal kelas pengganti)
 * TIDAK memiliki zona waktu. 2026-10-13 adalah 2026-10-13 di seluruh dunia.
 * Fungsi ini mengekstrak komponen kalender (YYYY, MM, DD) secara langsung tanpa
 * mengasumsikan atau meng-hardcode zona waktu tertentu (seperti WIB / Asia/Jakarta).
 */
export function parseDateOnly(dateStr?: string | Date | null): Date {
  if (!dateStr) return new Date();

  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return new Date();
    return new Date(Date.UTC(dateStr.getUTCFullYear(), dateStr.getUTCMonth(), dateStr.getUTCDate()));
  }

  const trimmed = String(dateStr).trim();
  if (!trimmed) return new Date();

  // Ekstrak komponen tahun, bulan, tanggal (YYYY-MM-DD)
  // Mendukung format kalender murni "YYYY-MM-DD", datetime "YYYY-MM-DDTHH:mm",
  // serta format ISO dengan offset "YYYY-MM-DDT...".
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return new Date(Date.UTC(y, m - 1, d));
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? new Date() : d;
}

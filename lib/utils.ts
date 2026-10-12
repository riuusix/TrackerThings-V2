import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIndonesianDate(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatIndonesianDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getDaysDifference(targetDate: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
  const parts = trimmed.split(":");
  const h = (parts[0] || "00").padStart(2, "0");
  const m = (parts[1] || "00").padStart(2, "0");
  const s = (parts[2] || "00").padStart(2, "0");
  return new Date(`1970-01-01T${h}:${m}:${s}Z`);
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
 * Mengonversi string tanggal YYYY-MM-DD menjadi objek Date yang valid untuk kolom PostgreSQL 'date' (@db.Date).
 */
export function parseDateOnly(dateStr?: string | Date | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return new Date();
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? new Date() : d;
}

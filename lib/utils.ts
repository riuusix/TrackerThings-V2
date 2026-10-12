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

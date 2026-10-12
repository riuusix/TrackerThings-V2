/**
 * Shared Semantic Feedback Vocabulary & Error Classifier
 * Standardized across Web (Next.js) & Native iOS (SwiftUI)
 */

export type FeedbackSeverity = "info" | "success" | "warning" | "error";

export interface FeedbackMessage {
  id: string;
  title?: string;
  message: string;
  severity: FeedbackSeverity;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

/**
 * Maps HTTP status codes, server error codes, or technical exceptions
 * to clear, actionable Indonesian messages.
 * Never leaks database details, Prisma codes, SQL, or internal stack traces.
 */
export function classifyApiError(error: unknown, fallbackMessage = "Terjadi kesalahan saat memproses permintaan."): string {
  if (!error) return fallbackMessage;

  // If already a human-friendly string
  if (typeof error === "string") {
    const lower = error.toLowerCase();
    // Filter out Prisma/SQL keywords if any leaked
    if (
      lower.includes("prisma") ||
      lower.includes("p20") ||
      lower.includes("postgresql") ||
      lower.includes("syntax error") ||
      lower.includes("column")
    ) {
      return "Layanan basis data sedang mengalami gangguan. Silakan coba sesaat lagi.";
    }
    return error;
  }

  // Handle Response / fetch errors
  if (typeof error === "object") {
    const errObj = error as Record<string, any>;

    // Network & Abort errors
    if (errObj.name === "AbortError" || errObj.code === "ECONNABORTED") {
      return "Waktu tunggu permintaan habis. Periksa koneksi internet Anda.";
    }
    if (
      errObj.message === "Failed to fetch" ||
      errObj.code === "ENOTFOUND" ||
      errObj.code === "ECONNREFUSED" ||
      errObj.cause?.code === "ECONNREFUSED"
    ) {
      return "Gagal terhubung ke server. Pastikan perangkat Anda terhubung ke internet.";
    }

    // Handle Standard ApiResponse payload
    if (errObj.message && typeof errObj.message === "string") {
      const msg = errObj.message;
      const lower = msg.toLowerCase();
      if (
        lower.includes("prismaclient") ||
        lower.includes("p20") ||
        lower.includes("08p01") ||
        lower.includes("column") ||
        lower.includes("syntax error")
      ) {
        return "Layanan data sedang mengalami gangguan. Silakan coba lagi.";
      }
      return msg;
    }

    if (errObj.error && typeof errObj.error === "string") {
      const msg = errObj.error;
      const lower = msg.toLowerCase();
      if (
        lower.includes("prismaclient") ||
        lower.includes("p20") ||
        lower.includes("08p01") ||
        lower.includes("column")
      ) {
        return "Layanan data sedang mengalami gangguan. Silakan coba lagi.";
      }
      return msg;
    }

    // Status code matching
    const status = errObj.status || errObj.statusCode || errObj.code;
    if (status) {
      switch (Number(status)) {
        case 400:
          return "Permintaan tidak valid. Mohon periksa kembali data yang Anda masukkan.";
        case 401:
          return "Sesi login Anda telah berakhir. Silakan masuk kembali.";
        case 403:
          return "Anda tidak memiliki izin untuk mengakses atau mengubah data ini.";
        case 404:
          return "Data yang Anda cari tidak ditemukan atau telah dihapus.";
        case 409:
          return "Terjadi konflik data. Data serupa mungkin sudah tersimpan.";
        case 422:
          return "Format data yang dikirim tidak sesuai dengan persyaratan.";
        case 429:
          return "Terlalu banyak permintaan. Mohon tunggu beberapa saat sebelum mencoba lagi.";
        case 500:
        case 502:
        case 503:
          return "Server sedang mengalami kendala. Mohon coba beberapa saat lagi.";
        default:
          break;
      }
    }

    // Network & Abort errors
    if (errObj.name === "AbortError" || errObj.code === "ECONNABORTED") {
      return "Waktu tunggu permintaan habis. Periksa koneksi internet Anda.";
    }
    if (errObj.message === "Failed to fetch" || errObj.code === "ENOTFOUND" || errObj.code === "ECONNREFUSED") {
      return "Gagal terhubung ke server. Pastikan perangkat Anda terhubung ke internet.";
    }
  }

  return fallbackMessage;
}

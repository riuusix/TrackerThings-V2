import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  getVisionProvider,
  checkUserVisionRateLimit,
  getVisionProviderConfig,
} from "@/lib/visionProvider";
import {
  mergeVisionWithOcrSchedule,
  type ParsedScheduleItem,
  detectScheduleLayout,
} from "@/lib/scheduleParser";
import { getUserScheduleMappings } from "@/lib/scheduleCorrections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Authentication
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return apiError("Permintaan multipart tidak valid.", 400);
    }

    // 3. User Consent Verification (CRITICAL: Phase C requirement)
    // Never silently transmit user images without explicit user consent!
    const consent = formData.get("userConsent");
    if (consent !== "true" && consent !== "1") {
      return apiError(
        "Persetujuan pemrosesan vision eksternal diperlukan sebelum gambar dikirim ke provider AI.",
        400,
        "CONSENT_REQUIRED"
      );
    }

    // 4. Rate Limiting per User
    const rateLimit = checkUserVisionRateLimit(String(session.userId));
    if (!rateLimit.allowed) {
      return apiError(
        `Batas panggilan vision tercapai. Harap tunggu ${rateLimit.retryAfterSeconds} detik sebelum mencoba lagi.`,
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    // 5. File Validation
    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError("File dokumen jadwal wajib disertakan untuk vision fallback.", 400);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return apiError("Ukuran file melebihi batas 10MB.", 400);
    }

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return apiError("Format file tidak didukung. Vision fallback mendukung gambar (PNG, JPG, WebP) dan dokumen PDF.", 400);
    }

    // 6. Check Provider Availability
    const provider = getVisionProvider();
    if (!provider.isAvailable()) {
      return apiError(
        "Layanan Vision AI saat ini belum dikonfigurasi pada server (GEMINI_API_KEY belum disetel). Anda dapat melanjutkan dengan pengeditan manual.",
        503,
        "VISION_UNAVAILABLE"
      );
    }

    // 7. Parse optional existing local OCR items sent by client to enable Phase E merge
    let localItems: ParsedScheduleItem[] = [];
    const localItemsJson = formData.get("localItems");
    if (typeof localItemsJson === "string" && localItemsJson.trim().length > 0) {
      try {
        const parsed = JSON.parse(localItemsJson);
        if (Array.isArray(parsed)) {
          localItems = parsed;
        }
      } catch {
        // Ignore malformed JSON
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 8. Call Vision Provider
    const visionResult = await provider.extractSchedule(buffer, mimeType);

    // 9. Fetch user existing courses and saved mappings in parallel
    const [existingCourses, userMappings] = await Promise.all([
      prisma.jadwal.findMany({
        where: { userId: session.userId },
        select: {
          id: true,
          namaMatkul: true,
          hari: true,
          waktuMulai: true,
          waktuSelesai: true,
        },
      }),
      getUserScheduleMappings(session.userId),
    ]);

    // 10. Merge Vision Output with Local OCR Evidence (Phase E)
    const detectedLayout = detectScheduleLayout({ text: "" });
    const mergedItems = mergeVisionWithOcrSchedule(
      localItems,
      visionResult.rows,
      existingCourses,
      userMappings,
      detectedLayout.kind
    );

    const requiresReview = mergedItems.some((item) => item.needsReview);
    const highConfidenceCount = mergedItems.filter(
      (item) => item.recognitionStatus === "high_confidence" || item.recognitionStatus === "confirmed_assisted"
    ).length;
    const needsReviewCount = mergedItems.filter((item) => item.needsReview).length;
    const qualityStatus =
      mergedItems.length === 0 ? "empty" : requiresReview ? "needs_review" : "sufficient";
    const warnings = Array.from(
      new Set(mergedItems.flatMap((item) => item.warnings || []))
    );

    // Operational non-sensitive metrics only (no raw image, no keys, no personal info logged)
    const providerConfig = getVisionProviderConfig();

    return apiSuccess(
      `Ekstraksi vision berhasil diproses oleh provider ${visionResult.provider}. Ditemukan ${mergedItems.length} mata kuliah.`,
      {
        engineUsed: "gemini_vision",
        engine_used: "gemini_vision",
        processingStage: "vision_fallback",
        processing_stage: "vision_fallback",
        qualityStatus,
        quality_status: qualityStatus,
        warnings,
        visionFallbackEligible: false,
        vision_fallback_eligible: false,
        items: mergedItems,
        total: mergedItems.length,
        requires_review: requiresReview,
        layout: detectedLayout,
        recognition_summary: {
          high_confidence_count: highConfidenceCount,
          needs_review_count: needsReviewCount,
        },
        vision_meta: {
          provider: visionResult.provider,
          model: visionResult.model,
          duration_ms: visionResult.durationMs,
          configured_model: providerConfig.modelId,
          usage: visionResult.usage,
        },
        user_mappings: userMappings,
      },
      200
    );
  } catch (err: any) {
    const rawMsg = err?.message || String(err || "");
    // Redact any API keys, query strings, or base64 data from server logs
    const sanitizedMsg = rawMsg
      .replace(/key=[a-zA-Z0-9_\-\.]+/gi, "key=[REDACTED]")
      .replace(/AIza[a-zA-Z0-9_\-]+/gi, "[REDACTED]");

    console.error("POST /api/jadwal/import/vision error:", sanitizedMsg);

    const lower = sanitizedMsg.toLowerCase();
    let status = 500;
    let userMsg = sanitizedMsg;

    if (lower.includes("batas waktu") || lower.includes("timeout") || lower.includes("aborted")) {
      status = 504;
      userMsg = "Waktu pemrosesan model vision melebihi batas (timeout). Silakan coba lagi atau gunakan model dengan latensi lebih rendah.";
    } else if (lower.includes("429") || lower.includes("kuota") || lower.includes("batas panggilan")) {
      status = 429;
      userMsg = "Batas panggilan API vision tercapai. Harap tunggu beberapa saat sebelum mencoba lagi.";
    } else if (lower.includes("401") || lower.includes("403") || lower.includes("otorisasi")) {
      status = 401;
      userMsg = "Otorisasi API vision gagal. Periksa konfigurasi GEMINI_API_KEY pada server.";
    } else if (lower.includes("404") || lower.includes("tidak ditemukan")) {
      status = 502;
      userMsg = sanitizedMsg;
    } else if (lower.includes("503") || lower.includes("unavailable") || lower.includes("demand") || lower.includes("lonjakan")) {
      status = 503;
      userMsg = "Layanan model vision Google sedang mengalami lonjakan beban sementara. Harap coba lagi dalam beberapa saat.";
    }

    return apiError(userMsg, status);
  }
}


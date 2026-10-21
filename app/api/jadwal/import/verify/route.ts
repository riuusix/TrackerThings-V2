import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  getVisionProvider,
  checkUserVisionRateLimit,
  getVisionProviderConfig,
  analyzeImageQuality,
  type VerifiedScheduleItem,
} from "@/lib/visionProvider";
import { normalizeHari, normalizeTime } from "@/lib/scheduleParser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];

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

    // 3. User Consent Verification (Critical Privacy Guard)
    const consent = formData.get("userConsent");
    if (consent !== "true" && consent !== "1") {
      return apiError(
        "Persetujuan verifikasi AI diperlukan sebelum dokumen dikirim ke provider visual eksternal.",
        400,
        "CONSENT_REQUIRED"
      );
    }

    // 4. Rate Limiting per User
    const rateLimit = checkUserVisionRateLimit(String(session.userId));
    if (!rateLimit.allowed) {
      return apiError(
        `Batas panggilan verifikasi AI tercapai. Harap tunggu ${rateLimit.retryAfterSeconds} detik sebelum mencoba lagi.`,
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    // 5. File Validation
    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError("File dokumen jadwal asli wajib disertakan untuk verifikasi visual.", 400);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return apiError("Ukuran file melebihi batas 10MB.", 400);
    }

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return apiError(
        "Format file tidak didukung. Verifikasi AI mendukung gambar (PNG, JPG, WebP) dan dokumen PDF.",
        400
      );
    }

    // 6. Candidate Items Validation
    const rawItemsJson = formData.get("items");
    let candidateItems: any[] = [];
    if (typeof rawItemsJson === "string" && rawItemsJson.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawItemsJson);
        if (Array.isArray(parsed)) {
          candidateItems = parsed;
        }
      } catch {
        return apiError("Format JSON candidate items tidak valid.", 400);
      }
    }

    if (candidateItems.length === 0) {
      return apiError("Tidak ada baris jadwal kandidat yang diberikan untuk diverifikasi.", 400);
    }

    // 7. Check Provider Availability
    const provider = getVisionProvider();
    if (!provider.isAvailable()) {
      return apiError(
        "Layanan Verifikasi AI saat ini belum dikonfigurasi pada server (GEMINI_API_KEY belum disetel).",
        503,
        "VISION_UNAVAILABLE"
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 8. Deterministic Image Quality Diagnostic
    const imageQuality = analyzeImageQuality(buffer, mimeType);

    // 9. Call Vision Provider Verification
    const verificationResult = await provider.verifySchedule(buffer, mimeType, candidateItems);

    // 10. Fetch user existing courses in parallel to separate schedule conflicts from OCR errors
    const existingCourses = await prisma.jadwal.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        namaMatkul: true,
        hari: true,
        waktuMulai: true,
        waktuSelesai: true,
      },
    });

    const formatDbTime = (d: Date | string) => {
      if (typeof d === "string") return d;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    };

    const detectedConflicts: Array<{
      itemId: string;
      conflictingWithId: number;
      conflictingCourseName: string;
      reason: string;
    }> = [];

    for (const item of candidateItems) {
      const iHari = item.hari ? normalizeHari(item.hari) : null;
      const iStart = item.waktuMulai ? normalizeTime(item.waktuMulai) : null;
      const iEnd = item.waktuSelesai ? normalizeTime(item.waktuSelesai) : null;

      if (!iHari || !iStart || !iEnd) continue;

      for (const ec of existingCourses) {
        if (ec.hari.toLowerCase() === iHari.toLowerCase()) {
          const ecStart = formatDbTime(ec.waktuMulai);
          const ecEnd = formatDbTime(ec.waktuSelesai);
          // Check time overlap: (startA < endB) and (endA > startB)
          if (iStart < ecEnd && iEnd > ecStart) {
            detectedConflicts.push({
              itemId: String(item.id || ""),
              conflictingWithId: ec.id,
              conflictingCourseName: ec.namaMatkul,
              reason: `Bentrok jadwal dengan mata kuliah '${ec.namaMatkul}' (${ec.hari}, ${ecStart} - ${ecEnd})`,
            });
          }
        }
      }
    }

    const providerConfig = getVisionProviderConfig();

    return apiSuccess(
      `Verifikasi AI selesai (${verificationResult.summary.confirmedCount} dikonfirmasi, ${verificationResult.summary.correctedCount} koreksi diusulkan).`,
      {
        verified_items: verificationResult.verifiedItems,
        proposed_added_rows: verificationResult.proposedAddedRows || [],
        proposed_removed_rows: verificationResult.proposedRemovedRows || [],
        diff: verificationResult.diff,
        summary: verificationResult.summary,
        image_quality: imageQuality,
        schedule_conflicts: detectedConflicts,
        meta: {
          provider: verificationResult.provider,
          model: verificationResult.model,
          duration_ms: verificationResult.durationMs,
          configured_model: providerConfig.modelId,
          usage: verificationResult.usage,
        },
      },
      200
    );
  } catch (err: any) {
    const rawMsg = err?.message || String(err || "");
    const sanitizedMsg = rawMsg
      .replace(/key=[a-zA-Z0-9_\-\.]+/gi, "key=[REDACTED]")
      .replace(/AIza[a-zA-Z0-9_\-]+/gi, "[REDACTED]");

    console.error("POST /api/jadwal/import/verify error:", sanitizedMsg);

    const lower = sanitizedMsg.toLowerCase();
    let status = 500;
    let userMsg = sanitizedMsg;

    if (lower.includes("batas waktu") || lower.includes("timeout") || lower.includes("aborted")) {
      status = 504;
      userMsg =
        "Waktu pemrosesan verifikasi vision melebihi batas (timeout). Silakan coba lagi dengan gambar yang lebih ringkas.";
    } else if (lower.includes("429") || lower.includes("kuota") || lower.includes("batas panggilan")) {
      status = 429;
      userMsg = "Batas panggilan API vision tercapai. Harap tunggu beberapa saat sebelum mencoba lagi.";
    } else if (lower.includes("401") || lower.includes("403") || lower.includes("otorisasi")) {
      status = 401;
      userMsg = "Otorisasi API vision gagal. Periksa konfigurasi GEMINI_API_KEY pada server.";
    } else if (lower.includes("503") || lower.includes("unavailable") || lower.includes("demand")) {
      status = 503;
      userMsg = "Layanan model vision Google sedang mengalami lonjakan beban sementara. Harap coba lagi beberapa saat.";
    }

    return apiError(userMsg, status);
  }
}

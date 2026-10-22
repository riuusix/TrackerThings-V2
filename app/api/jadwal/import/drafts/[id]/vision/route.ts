import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  getScheduleDraft,
  updateScheduleDraft,
} from "@/lib/scheduleDraftStore";
import {
  getVisionProvider,
  checkUserVisionRateLimit,
  getVisionProviderConfig,
} from "@/lib/visionProvider";
import {
  mergeVisionWithOcrSchedule,
  detectScheduleLayout,
} from "@/lib/scheduleParser";
import { getUserScheduleMappings } from "@/lib/scheduleCorrections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const { id: draftId } = await params;
    const draft = await getScheduleDraft(session.userId, draftId);

    if (!draft) {
      return apiError("Draf jadwal tidak ditemukan atau telah kedaluwarsa.", 404);
    }

    const formData = await req.formData().catch(() => null);
    const bodyJson = !formData ? await req.json().catch(() => null) : null;

    // Check user consent (Phase C requirement)
    const consent = formData
      ? formData.get("userConsent")
      : bodyJson?.userConsent;

    if (consent !== true && consent !== "true" && consent !== "1" && consent !== 1) {
      return apiError(
        "Persetujuan pemrosesan vision eksternal diperlukan sebelum gambar dikirim ke provider AI.",
        400,
        "CONSENT_REQUIRED"
      );
    }

    // Rate limiting per user
    const rateLimit = checkUserVisionRateLimit(String(session.userId));
    if (!rateLimit.allowed) {
      return apiError(
        `Batas panggilan vision tercapai. Harap tunggu ${rateLimit.retryAfterSeconds} detik sebelum mencoba lagi.`,
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    // Check provider availability
    const provider = getVisionProvider();
    if (!provider.isAvailable()) {
      return apiError(
        "Layanan Vision AI saat ini belum dikonfigurasi pada server (GEMINI_API_KEY belum disetel).",
        503,
        "VISION_UNAVAILABLE"
      );
    }

    // Retrieve file buffer: either from draft.sourceFileBase64 or from uploaded file in formData
    let buffer: Buffer | null = null;
    let mimeType = draft.mimeType;

    const uploadedFile = formData?.get("file") as File | null;
    if (uploadedFile) {
      const ab = await uploadedFile.arrayBuffer();
      buffer = Buffer.from(ab);
      mimeType = uploadedFile.type || mimeType;
    } else if (draft.sourceFileBase64) {
      buffer = Buffer.from(draft.sourceFileBase64, "base64");
    }

    if (!buffer) {
      return apiError(
        "Dokumen sumber tidak tersedia di server untuk re-analisis otomatis. Silakan sertakan file dokumen jadwal.",
        400,
        "FILE_REQUIRED"
      );
    }

    // Call Vision Provider
    const visionResult = await provider.extractSchedule(buffer, mimeType);

    // Fetch user courses & mappings
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

    // Merge Vision Output with Draft items
    const detectedLayout = detectScheduleLayout({ text: "" });
    const mergedItems = mergeVisionWithOcrSchedule(
      draft.items,
      visionResult.rows,
      existingCourses,
      userMappings,
      detectedLayout.kind
    );

    const requiresReview = mergedItems.some((item) => item.needsReview);
    const warnings = Array.from(
      new Set(mergedItems.flatMap((item) => item.warnings || []))
    );

    // Update draft with merged items
    const updatedDraft = await updateScheduleDraft({
      userId: session.userId,
      draftId,
      items: mergedItems as any,
    });

    updatedDraft.warnings = warnings;
    updatedDraft.visionFallbackEligible = false;
    updatedDraft.engineUsed = "gemini_vision";
    updatedDraft.processingStage = "vision_fallback";

    return apiSuccess(
      `Re-analisis Vision AI berhasil diproses oleh provider ${visionResult.provider}. Ditemukan ${mergedItems.length} mata kuliah.`,
      {
        draft: updatedDraft,
        vision_meta: {
          provider: visionResult.provider,
          model: visionResult.model,
          duration_ms: visionResult.durationMs,
          usage: visionResult.usage,
        },
      }
    );
  } catch (err: any) {
    console.error("POST /api/jadwal/import/drafts/[id]/vision error:", err);
    return apiError(err.message || "Gagal menjalankan re-analisis Vision AI.", 500);
  }
}

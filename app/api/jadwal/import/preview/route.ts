import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  extractTextFromPdf,
  extractOcrFromImage,
  parseTsvToWords,
  recognizeScheduleData,
  type ParsedScheduleItem,
  type OcrWord,
} from "@/lib/scheduleParser";
import { getUserScheduleMappings } from "@/lib/scheduleCorrections";
import {
  AcademicHybridRouter,
  bridgeCanonicalToLegacyItem,
  type CanonicalAcademicExtractionResult,
  type HybridRoutingDecision,
} from "@/lib/intelligence/academicEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return apiError("Permintaan multipart tidak valid.", 400);
    }

    let extractedText = "";
    let extractedWords: OcrWord[] = [];
    let fileName = "jadwal_import";
    let extractionSource: "client_ocr" | "pdf_stream" | "server_ocr" = "server_ocr";
    let ocrDurationMs = 0;

    // Check if client provided pre-extracted text & spatial words/TSV (from Browser OCR worker)
    const rawTextParam = formData.get("rawText");
    const ocrTsvParam = formData.get("ocrTsv");
    const ocrWordsParam = formData.get("ocrWords");
    const clientFileName = formData.get("fileName");
    if (typeof clientFileName === "string" && clientFileName.trim().length > 0) {
      fileName = clientFileName.trim();
    }

    if (typeof ocrWordsParam === "string" && ocrWordsParam.trim().length > 0) {
      try {
        const parsedWords = JSON.parse(ocrWordsParam);
        if (Array.isArray(parsedWords)) {
          extractedWords = parsedWords;
        }
      } catch {
        // Ignore malformed JSON
      }
    }

    if (extractedWords.length === 0 && typeof ocrTsvParam === "string" && ocrTsvParam.trim().length > 0) {
      extractedWords = parseTsvToWords(ocrTsvParam);
    }

    if (typeof rawTextParam === "string") {
      extractedText = rawTextParam.trim();
      extractionSource = "client_ocr";
    } else {
      // Process uploaded file (PDF or Image fallback)
      const file = formData.get("file") as File | null;
      if (!file) {
        return apiError("File dokumen PDF atau gambar jadwal wajib diunggah.", 400);
      }

      fileName = file.name;

      if (file.size > MAX_FILE_SIZE) {
        return apiError("Ukuran file melebihi batas maksimal 10MB.", 400);
      }

      let mimeType = file.type.toLowerCase();
      if (!mimeType || mimeType === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "pdf") mimeType = "application/pdf";
        else if (ext === "png") mimeType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
        else if (ext === "webp") mimeType = "image/webp";
      }

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return apiError(
          "Format file tidak didukung. Harap unggah dokumen PDF atau gambar (PNG, JPG, WebP).",
          400,
          "UNSUPPORTED_FORMAT",
          { supported_formats: ALLOWED_MIME_TYPES }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const ocrStartTime = Date.now();
      try {
        if (mimeType === "application/pdf") {
          extractedText = await extractTextFromPdf(buffer);
          extractionSource = "pdf_stream";
        } else {
          const ocrResult = await extractOcrFromImage(buffer);
          extractedText = ocrResult.text;
          extractedWords = ocrResult.words;
          extractionSource = "server_ocr";
        }
      } catch (extractErr: any) {
        ocrDurationMs = Date.now() - ocrStartTime;
        const errMsg = extractErr?.message || "";
        if (errMsg.includes("sedang memproses")) {
          return apiError("Server OCR sedang sibuk. Silakan coba kembali dalam beberapa detik.", 429, "OCR_BUSY");
        }
        if (errMsg.includes("timeout") || errMsg.includes("batas waktu")) {
          return apiError(
            "Waktu pemrosesan gambar melebihi batas waktu. Disarankan menggunakan file PDF atau gambar beresolusi lebih ringkas.",
            504,
            "EXTRACTION_TIMEOUT"
          );
        }
        if (errMsg.includes("PDF_PASSWORD_PROTECTED")) {
          console.warn(`[ImportPreview] PDF password-protected (duration: ${ocrDurationMs}ms, size: ${file.size})`);
          return apiError(
            "Dokumen PDF diproteksi oleh kata sandi (password). Harap unggah dokumen yang tidak terkunci.",
            422,
            "PDF_PASSWORD_PROTECTED",
            { file_type: "pdf" }
          );
        }

        console.error(`[ImportPreview] Extraction failure (mime: ${mimeType}, size: ${file.size}, duration: ${ocrDurationMs}ms):`, errMsg);
        return apiError(
          "Gagal memproses file jadwal. Pastikan gambar/PDF jelas dan tidak rusak.",
          422,
          "CORRUPTED_DOCUMENT",
          {
            file_type: mimeType === "application/pdf" ? "pdf" : "image",
            vision_fallback_eligible: mimeType !== "application/pdf",
          }
        );
      }
      ocrDurationMs = Date.now() - ocrStartTime;
    }

    if ((!extractedText || extractedText.trim().length === 0) && extractedWords.length === 0) {
      if (extractionSource === "pdf_stream") {
        console.warn(`[ImportPreview] Scanned PDF with no digital text (duration: ${ocrDurationMs}ms)`);
        return apiError(
          "Tidak dapat mengekstrak teks dari file PDF yang diunggah. Dokumen tampaknya merupakan hasil scan/gambar tanpa lapisan teks digital. Silakan unggah tangkapan layar (screenshot) atau foto dokumen dalam format gambar (PNG/JPG) agar dapat dibaca oleh OCR atau dianalisis oleh Vision AI.",
          422,
          "SCANNED_PDF_NO_TEXT",
          {
            file_type: "pdf",
            recovery_action: "CONVERT_TO_IMAGE",
            vision_fallback_eligible: false,
          }
        );
      }

      console.warn(`[ImportPreview] Empty OCR extraction on image (duration: ${ocrDurationMs}ms)`);
      return apiError(
        "OCR lokal tidak berhasil mengenali teks pada gambar jadwal. Gambar mungkin beresolusi rendah atau memiliki kontras redup. Anda dapat mencoba bantuan Vision AI untuk membaca jadwal.",
        422,
        "EMPTY_OCR_IMAGE",
        {
          file_type: "image",
          recovery_action: "TRY_VISION_AI",
          vision_fallback_eligible: true,
        }
      );
    }

    // Ambil jadwal eksisting user dan kamus koreksi pribadi user secara paralel
    const dbStartTime = Date.now();
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
    const dbDurationMs = Date.now() - dbStartTime;

    const hybridRouter = new AcademicHybridRouter();
    let hybridExtraction: {
      result: CanonicalAcademicExtractionResult;
      decision: HybridRoutingDecision;
    } | null = null;

    if (extractedText && extractedText.trim().length > 0) {
      try {
        hybridExtraction = await hybridRouter.routeAndExtract({
          buffer: Buffer.from(extractedText, "utf8"),
          mimeType: "text/plain",
          fileName,
          preExtractedText: extractedText,
        });
      } catch (err) {
        console.warn("[ImportPreview] Hybrid extraction warning:", err);
      }
    }

    const recognition = recognizeScheduleData(
      { text: extractedText, words: extractedWords },
      existingCourses,
      userMappings
    );

    let parsedItems: (ParsedScheduleItem | ReturnType<typeof bridgeCanonicalToLegacyItem>)[] = recognition.items;
    let effectiveDocumentType = "class_schedule";
    let processingMode = "legacy_local_ocr";

    if (hybridExtraction && hybridExtraction.result.items.length > 0) {
      effectiveDocumentType = hybridExtraction.decision.documentType;
      // If legacy recognition produced 0 items or is deemed insufficient, OR if hybrid extraction detected non-class_schedule (e.g. exam, krs, replacement)
      const preferHybrid =
        parsedItems.length === 0 ||
        Boolean(recognition.insufficientForProduction) ||
        effectiveDocumentType !== "class_schedule" ||
        hybridExtraction.result.items.length > parsedItems.length;

      if (preferHybrid) {
        parsedItems = hybridExtraction.result.items.map(bridgeCanonicalToLegacyItem);
        processingMode = hybridExtraction.decision.processingMode;
      }
    }

    const requiresReview = parsedItems.length === 0 || parsedItems.some((item) => item.needsReview);
    const highConfidenceCount = parsedItems.filter(
      (item) => item.recognitionStatus === "high_confidence" || item.recognitionStatus === "confirmed_assisted"
    ).length;
    const confirmedAssistedCount = parsedItems.filter(
      (item) => item.recognitionStatus === "confirmed_assisted"
    ).length;
    const needsReviewCount = parsedItems.filter((item) => item.needsReview).length;

    const isInsufficient =
      parsedItems.length === 0 ||
      Boolean(recognition.insufficientForProduction) ||
      parsedItems.some((item: any) => item.needsReview);
    const isImageUpload = extractionSource === "client_ocr" || extractionSource === "server_ocr";
    const visionFallbackEligible = isImageUpload && isInsufficient;

    return apiSuccess(
      parsedItems.length > 0
        ? `Ekstraksi jadwal berhasil. Ditemukan ${parsedItems.length} mata kuliah.`
        : "Jadwal kuliah belum terdeteksi jelas dengan OCR lokal.",
      {
        version: "2.0",
        document_type: effectiveDocumentType,
        processing_mode: processingMode,
        canonical_items: hybridExtraction?.result?.items || [],
        hybrid_decision: hybridExtraction?.decision || null,
        items: parsedItems,
        total: parsedItems.length,
        requires_review: requiresReview,
        layout: recognition.layout,
        insufficient_for_production: isInsufficient,
        insufficiency_reasons: isInsufficient ? (recognition.insufficiencyReasons || []) : [],
        vision_fallback_eligible: visionFallbackEligible,
        recognition_summary: {
          high_confidence_count: highConfidenceCount,
          confirmed_assisted_count: confirmedAssistedCount,
          needs_review_count: needsReviewCount,
        },
        filename: fileName,
        applied_mappings_count: parsedItems.reduce(
          (acc, it) => acc + (it.appliedCorrections?.length || 0),
          0
        ),
        user_mappings: userMappings,
        timing: {
          ocr_duration_ms: ocrDurationMs,
          db_duration_ms: dbDurationMs,
          source: extractionSource,
        },
      },
      200
    );
  } catch (err: any) {
    console.error("POST /api/jadwal/import/preview error:", err);
    return apiError("Gagal memproses dokumen jadwal. Silakan coba kembali.", 500);
  }
}

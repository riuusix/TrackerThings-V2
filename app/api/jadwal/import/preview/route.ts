import { NextRequest, NextResponse } from "next/server";
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
  detectDocumentCategory,
  evaluateExtractionQuality,
  type CanonicalAcademicExtractionResult,
  type HybridEngineUsed,
  type HybridProcessingStage,
  type HybridQualityStatus,
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

type StageEmitter = (stage: HybridProcessingStage, engine: HybridEngineUsed) => void;

async function executePreviewPipeline(
  req: NextRequest,
  emitStage: StageEmitter
): Promise<NextResponse> {
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
  let uploadedFileBuffer: Buffer | null = null;
  let effectiveMimeType = "text/plain";

  // Check if client provided pre-extracted text & spatial words/TSV (from Browser OCR worker or iOS Apple Vision)
  const rawTextParam = formData.get("rawText");
  const ocrTsvParam = formData.get("ocrTsv");
  const ocrWordsParam = formData.get("ocrWords");
  const clientFileName = formData.get("fileName");
  const file = formData.get("file") as File | null;

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

  // Always inspect uploaded file if present so PDF binary buffers and MIME types are preserved
  if (file) {
    fileName = file.name || fileName;

    if (file.size > MAX_FILE_SIZE) {
      return apiError("Ukuran file melebihi batas maksimal 10MB.", 400);
    }

    let mimeType = (file.type || "").toLowerCase();
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = fileName.split(".").pop()?.toLowerCase();
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
    uploadedFileBuffer = Buffer.from(arrayBuffer);
    effectiveMimeType = mimeType;
  }

  const hasClientText = typeof rawTextParam === "string" && rawTextParam.trim().length > 0;

  if (hasClientText && effectiveMimeType !== "application/pdf") {
    emitStage("typescript_initial", "typescript_parser");
    extractedText = rawTextParam.trim();
    extractionSource = "client_ocr";
  } else if (uploadedFileBuffer) {
    const ocrStartTime = Date.now();
    try {
      if (effectiveMimeType === "application/pdf") {
        emitStage("typescript_initial", "typescript_parser");
        extractedText = await extractTextFromPdf(uploadedFileBuffer);
        if (!extractedText && hasClientText) {
          extractedText = rawTextParam.trim();
        }
        extractionSource = "pdf_stream";
      } else {
        emitStage("ocr_extraction", "server_ocr");
        const ocrResult = await extractOcrFromImage(uploadedFileBuffer);
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
        console.warn(`[ImportPreview] PDF password-protected (duration: ${ocrDurationMs}ms)`);
        return apiError(
          "Dokumen PDF diproteksi oleh kata sandi (password). Harap unggah dokumen yang tidak terkunci.",
          422,
          "PDF_PASSWORD_PROTECTED",
          { file_type: "pdf" }
        );
      }

      const isPdf = effectiveMimeType === "application/pdf";
      console.error(`[ImportPreview] Extraction failure (mime: ${effectiveMimeType}, duration: ${ocrDurationMs}ms):`, errMsg);
      return apiError(
        isPdf
          ? "Gagal mengekstrak teks dari file PDF. Dokumen mungkin tidak memiliki lapisan teks digital atau memerlukan pemrosesan visual. Anda dapat mencoba menggunakan bantuan Vision AI atau mengunggah tangkapan layar jadwal."
          : "Gagal memproses file jadwal. Pastikan gambar/PDF jelas dan tidak rusak.",
        422,
        isPdf ? "PDF_EXTRACTION_FAILED" : "CORRUPTED_DOCUMENT",
        {
          file_type: isPdf ? "pdf" : "image",
          engineUsed: isPdf ? "typescript_parser" : "server_ocr",
          engine_used: isPdf ? "typescript_parser" : "server_ocr",
          processingStage: "quality_gate_rejected",
          processing_stage: "quality_gate_rejected",
          qualityStatus: "empty",
          quality_status: "empty",
          warnings: [errMsg || "Gagal mengekstrak teks dari dokumen."],
          visionFallbackEligible: true,
          vision_fallback_eligible: true,
          insufficient_for_production: true,
          recovery_action: "TRY_VISION_AI",
        }
      );
    }
    ocrDurationMs = Date.now() - ocrStartTime;
  } else if (typeof rawTextParam === "string") {
    emitStage("typescript_initial", "typescript_parser");
    extractedText = rawTextParam.trim();
    extractionSource = "client_ocr";
  } else {
    return apiError("File dokumen PDF atau gambar jadwal wajib diunggah.", 400);
  }

  if ((!extractedText || extractedText.trim().length === 0) && extractedWords.length === 0) {
    if (extractionSource === "pdf_stream" || effectiveMimeType === "application/pdf") {
      console.warn(`[ImportPreview] Scanned PDF with no digital text (duration: ${ocrDurationMs}ms)`);
      const warnings = [
        "Dokumen PDF tidak memiliki lapisan teks digital (hasil scan/gambar).",
      ];
      return apiError(
        "Tidak dapat mengekstrak teks dari file PDF yang diunggah. Dokumen tampaknya merupakan hasil scan/gambar tanpa lapisan teks digital. Silakan coba bantuan Vision AI atau unggah foto/screenshot jadwal.",
        422,
        "SCANNED_PDF_NO_TEXT",
        {
          file_type: "pdf",
          engineUsed: "typescript_parser",
          engine_used: "typescript_parser",
          processingStage: "quality_gate_rejected",
          processing_stage: "quality_gate_rejected",
          qualityStatus: "empty",
          quality_status: "empty",
          warnings,
          visionFallbackEligible: true,
          vision_fallback_eligible: true,
          insufficient_for_production: true,
          recovery_action: "TRY_VISION_AI",
        }
      );
    }

    console.warn(`[ImportPreview] Empty OCR extraction on image (duration: ${ocrDurationMs}ms)`);
    const emptyEngine: HybridEngineUsed =
      extractionSource === "server_ocr" ? "server_ocr" : "typescript_parser";
    const warnings = [
      "OCR lokal tidak berhasil mengenali teks pada gambar jadwal.",
    ];
    return apiError(
      "OCR lokal tidak berhasil mengenali teks pada gambar jadwal. Gambar mungkin beresolusi rendah atau memiliki kontras redup. Anda dapat mencoba bantuan Vision AI untuk membaca jadwal.",
      422,
      "EMPTY_OCR_IMAGE",
      {
        file_type: "image",
        engineUsed: emptyEngine,
        engine_used: emptyEngine,
        processingStage: "quality_gate_rejected",
        processing_stage: "quality_gate_rejected",
        qualityStatus: "empty",
        quality_status: "empty",
        warnings,
        visionFallbackEligible: true,
        vision_fallback_eligible: true,
        insufficient_for_production: true,
        recovery_action: "TRY_VISION_AI",
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

  // Stage 1: TypeScript Deterministic Schedule Recognition
  const recognition = recognizeScheduleData(
    { text: extractedText, words: extractedWords },
    existingCourses,
    userMappings
  );

  const initialTsQuality = evaluateExtractionQuality(recognition.items);
  const detectedDocType = detectDocumentCategory(extractedText);
  const isTsAlreadySufficient =
    recognition.items.length > 0 &&
    !recognition.insufficientForProduction &&
    initialTsQuality.isSufficientForProduction &&
    detectedDocType === "class_schedule";

  const hybridRouter = new AcademicHybridRouter();
  let hybridExtraction: {
    result: CanonicalAcademicExtractionResult;
    decision: HybridRoutingDecision;
  } | null = null;

  // Stage 2: Only invoke Hybrid Router (and potentially Python pdfplumber refinement on digital PDFs)
  // when TypeScript extraction is insufficient or document is a specialized non-class_schedule type.
  if (!isTsAlreadySufficient && extractedText && extractedText.trim().length > 0) {
    try {
      hybridExtraction = await hybridRouter.routeAndExtract(
        {
          buffer:
            effectiveMimeType === "application/pdf" && uploadedFileBuffer
              ? uploadedFileBuffer
              : Buffer.from(extractedText, "utf8"),
          mimeType: effectiveMimeType,
          fileName,
          preExtractedText: extractedText,
        },
        {
          onStageChange: (stage, engine) => {
            emitStage(stage, engine);
          },
        }
      );
    } catch (err) {
      console.warn("[ImportPreview] Hybrid extraction warning:", err);
    }
  } else if (isTsAlreadySufficient && extractedText && extractedText.trim().length > 0) {
    // Populate deterministic canonical result without invoking Python
    try {
      const detResult = await hybridRouter.deterministicExtractor.extract({
        buffer: Buffer.from(extractedText, "utf8"),
        mimeType: "text/plain",
        fileName,
        preExtractedText: extractedText,
      });
      const detQuality = hybridRouter.evaluateQuality(detResult);
      hybridExtraction = {
        result: detResult,
        decision: {
          selectedProviderId: hybridRouter.deterministicExtractor.id,
          providerName: hybridRouter.deterministicExtractor.name,
          processingMode: "deterministic",
          engineUsed: extractionSource === "server_ocr" ? "server_ocr" : "typescript_parser",
          processingStage: extractionSource === "server_ocr" ? "ocr_extraction" : "typescript_initial",
          qualityStatus: "sufficient",
          warnings: initialTsQuality.reasons,
          visionFallbackEligible: false,
          reason: "TypeScript schedule parser succeeded with sufficient quality",
          documentType: detectedDocType,
          qualitySignals: detQuality,
        },
      };
    } catch {
      // Ignore optional canonical mirror failure
    }
  }

  let parsedItems: (ParsedScheduleItem | ReturnType<typeof bridgeCanonicalToLegacyItem>)[] = recognition.items;
  let effectiveDocumentType = detectedDocType || "class_schedule";
  let processingMode = "legacy_local_ocr";
  let usedHybridItems = false;

  if (!isTsAlreadySufficient && hybridExtraction && hybridExtraction.result.items.length > 0) {
    effectiveDocumentType = hybridExtraction.decision.documentType;
    const isPythonRefinement = hybridExtraction.decision.processingMode === "self_hosted_model";
    const preferHybrid =
      parsedItems.length === 0 ||
      (isPythonRefinement && hybridExtraction.result.items.length >= parsedItems.length) ||
      effectiveDocumentType !== "class_schedule" ||
      hybridExtraction.result.items.length > parsedItems.length;

    if (preferHybrid) {
      parsedItems = hybridExtraction.result.items.map(bridgeCanonicalToLegacyItem);
      processingMode = hybridExtraction.decision.processingMode;
      usedHybridItems = true;
    }
  }

  const qualityDecision = evaluateExtractionQuality(parsedItems);
  const requiresReview = !qualityDecision.isSufficientForProduction;
  const highConfidenceCount = parsedItems.filter(
    (item) => item.recognitionStatus === "high_confidence" || item.recognitionStatus === "confirmed_assisted"
  ).length;
  const confirmedAssistedCount = parsedItems.filter(
    (item) => item.recognitionStatus === "confirmed_assisted"
  ).length;
  const needsReviewCount = parsedItems.filter((item) => item.needsReview).length;

  const isInsufficient =
    !qualityDecision.isSufficientForProduction ||
    (!usedHybridItems && Boolean(recognition.insufficientForProduction));
  const visionFallbackEligible = isInsufficient;
  const combinedReasons = Array.from(
    new Set([
      ...(!usedHybridItems ? recognition.insufficiencyReasons || [] : []),
      ...qualityDecision.reasons,
    ])
  );

  // Compute canonical hybrid metadata
  let engineUsed: HybridEngineUsed = "typescript_parser";
  let processingStage: HybridProcessingStage = "typescript_initial";

  if (usedHybridItems && processingMode === "self_hosted_model") {
    engineUsed = "python_pdfplumber";
    processingStage = "python_refinement";
  } else if (extractionSource === "server_ocr") {
    engineUsed = "server_ocr";
    processingStage = "ocr_extraction";
  } else {
    engineUsed = "typescript_parser";
    processingStage = "typescript_initial";
  }

  let qualityStatus: HybridQualityStatus = "sufficient";
  if (parsedItems.length === 0) {
    qualityStatus = "empty";
    processingStage = "quality_gate_rejected";
  } else if (!isInsufficient) {
    qualityStatus = "sufficient";
  } else if (qualityDecision.score.validItemsCount > 0 && !qualityDecision.score.hasTimeErrors) {
    qualityStatus = "needs_review";
  } else {
    qualityStatus = "insufficient";
  }

  if (parsedItems.length === 0) {
    const emptyWarnings =
      combinedReasons.length > 0
        ? combinedReasons
        : ["Tidak ada baris jadwal yang berhasil dikenali dengan parser lokal."];

    return apiError(
      "Jadwal kuliah belum terdeteksi dari dokumen ini. Anda dapat mencoba bantuan Vision AI untuk membaca jadwal.",
      422,
      "EMPTY_SCHEDULE_EXTRACTED",
      {
        error_code: "EMPTY_SCHEDULE_EXTRACTED",
        version: "2.0",
        document_type: effectiveDocumentType,
        engineUsed,
        engine_used: engineUsed,
        processingStage: "quality_gate_rejected",
        processing_stage: "quality_gate_rejected",
        qualityStatus: "empty",
        quality_status: "empty",
        warnings: emptyWarnings,
        visionFallbackEligible: true,
        vision_fallback_eligible: true,
        items: [],
        total: 0,
        insufficient_for_production: true,
        recovery_action: "TRY_VISION_AI",
        insufficiency_reasons: emptyWarnings,
      }
    );
  }

  return apiSuccess(
    `Ekstraksi jadwal berhasil. Ditemukan ${parsedItems.length} mata kuliah.`,
    {
      version: "2.0",
      document_type: effectiveDocumentType,
      processing_mode: processingMode,
      engineUsed,
      engine_used: engineUsed,
      processingStage,
      processing_stage: processingStage,
      qualityStatus,
      quality_status: qualityStatus,
      warnings: combinedReasons,
      visionFallbackEligible,
      vision_fallback_eligible: visionFallbackEligible,
      canonical_items: hybridExtraction?.result?.items || [],
      hybrid_decision: hybridExtraction?.decision || null,
      items: parsedItems,
      total: parsedItems.length,
      requires_review: requiresReview,
      layout: recognition.layout,
      insufficient_for_production: isInsufficient,
      insufficiency_reasons: isInsufficient ? combinedReasons : [],
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
}

export async function POST(req: NextRequest) {
  const streamProgress = req.headers.get("x-stream-progress") === "1";

  if (!streamProgress) {
    try {
      return await executePreviewPipeline(req, () => {});
    } catch (err: any) {
      console.error("POST /api/jadwal/import/preview error:", err);
      return apiError("Gagal memproses dokumen jadwal. Silakan coba kembali.", 500);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastStage: string | null = null;
      const emitStage: StageEmitter = (stage, engine) => {
        if (lastStage === stage) return;
        lastStage = stage;
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "stage", stage, engine }) + "\n")
          );
        } catch {
          // Stream may have been closed by client abort
        }
      };

      try {
        const res = await executePreviewPipeline(req, emitStage);
        const body = await res.json().catch(() => ({}));
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "result", status: res.status, body }) + "\n"
          )
        );
      } catch (err: any) {
        console.error("POST /api/jadwal/import/preview stream error:", err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "result",
              status: 500,
              body: {
                status: "error",
                message: "Gagal memproses dokumen jadwal. Silakan coba kembali.",
              },
            }) + "\n"
          )
        );
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

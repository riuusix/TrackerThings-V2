/**
 * TrackerThings V2 — Academic Intelligence Engine (Domain Foundation)
 *
 * Implements:
 * 1. Canonical Academic Contracts & Runtime Validation
 * 2. Provider Lifecycle & Abstraction (separates inference from HTTP handlers)
 * 3. Deterministic Layout-Aware Extractor (multi-university, exam timetables, KRS lists)
 * 4. Self-Hosted Server ML Provider (gated via SELF_HOSTED_ML_URL)
 * 5. External Generative Provider (strictly consent-gated, zero silent fallbacks)
 * 6. Academic Hybrid Router & Policy Decision Engine
 * 7. In-Memory Mock Provider for isolated CI testing
 * 8. Backward-Compatible Bridge to Legacy Web & iOS Models
 */

export interface QualityGateConfig {
  /** Provisional pass rate threshold percent (default: 75, configurable) */
  minPassRatePercent: number;
  /** Minimum required items before qualifying as production ready without review (default: 1) */
  minTotalItems: number;
  /** Maximum allowable ratio of uncertain / review-flagged rows (default: 0.25, configurable) */
  maxUncertainRatio: number;
  /** Minimum acceptable course title length (default: 2) */
  minTitleLength: number;
  /** High confidence threshold (default: 80) */
  highConfidenceThreshold: number;
  /** Medium confidence cutoff (default: 50) */
  mediumConfidenceThreshold: number;
}

export const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  minPassRatePercent: 75,
  minTotalItems: 1,
  maxUncertainRatio: 0.25,
  minTitleLength: 2,
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,
};

export const VALID_INDONESIAN_DAYS = new Set([
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
]);

export interface QualityGateScore {
  totalItems: number;
  validItemsCount: number;
  uncertainItemsCount: number;
  passRatePercent: number;
  hasTimeErrors: boolean;
  hasWeekdayErrors: boolean;
  hasMissingTitleErrors: boolean;
  timeErrorCount: number;
  weekdayErrorCount: number;
  missingTitleCount: number;
}

export interface QualityGateDecision {
  isSufficientForProduction: boolean;
  visionFallbackEligible: boolean;
  score: QualityGateScore;
  reasons: string[];
  recommendation: "accept" | "manual_review" | "offer_vision_fallback";
  warningCategories?: {
    ocrExtractionErrors: string[];
    scheduleConflicts: string[];
    verificationSuggestions: string[];
  };
}

function isValid24hTime(timeStr?: string | null): boolean {
  if (!timeStr) return false;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  return h * 60 + m;
}

export function evaluateExtractionQuality(
  input: { items: any[]; reviewReasons?: string[]; insufficientForPersistence?: boolean } | any[],
  customConfig?: Partial<QualityGateConfig>
): QualityGateDecision {
  const config: QualityGateConfig = { ...DEFAULT_QUALITY_GATE_CONFIG, ...customConfig };
  const items: any[] = Array.isArray(input) ? input : input.items || [];
  const reasons: string[] = [];

  const total = items.length;

  if (total === 0) {
    const emptyReasons =
      !Array.isArray(input) && input.reviewReasons && input.reviewReasons.length > 0
        ? input.reviewReasons
        : ["Tidak ada jadwal kuliah yang berhasil diekstraksi dari dokumen."];

    return {
      isSufficientForProduction: false,
      visionFallbackEligible: true,
      score: {
        totalItems: 0,
        validItemsCount: 0,
        uncertainItemsCount: 0,
        passRatePercent: 0,
        hasTimeErrors: false,
        hasWeekdayErrors: false,
        hasMissingTitleErrors: false,
        timeErrorCount: 0,
        weekdayErrorCount: 0,
        missingTitleCount: 0,
      },
      reasons: emptyReasons,
      recommendation: "offer_vision_fallback",
    };
  }

  let timeErrorCount = 0;
  let weekdayErrorCount = 0;
  let missingTitleCount = 0;
  let uncertainItemsCount = 0;
  let validItemsCount = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const rowNum = idx + 1;
    let itemHasError = false;

    // 1. Title validation
    const title = (it.namaMatkul || it.nama_matkul || "").trim();
    if (!title || title.length < config.minTitleLength) {
      missingTitleCount++;
      itemHasError = true;
      reasons.push(`Baris #${rowNum}: Nama mata kuliah tidak lengkap atau kosong.`);
    }

    // 2. Weekday validation
    const isWeekly = !it.recurrence || it.recurrence === "weekly" || !it.tanggal;
    const day = (it.hari || "").trim();
    if (isWeekly) {
      if (!day || !VALID_INDONESIAN_DAYS.has(day)) {
        weekdayErrorCount++;
        itemHasError = true;
        reasons.push(
          `Baris #${rowNum} (${title || "Tanpa Judul"}): Hari kuliah '${day || "kosong"}' tidak valid.`
        );
      }
    }

    // 3. Time validation
    const start = (it.waktuMulai || it.waktu_mulai || "").trim();
    const end = (it.waktuSelesai || it.waktu_selesai || "").trim();

    const isStartValid = isValid24hTime(start);
    const isEndValid = isValid24hTime(end);

    if (!isStartValid || !isEndValid) {
      timeErrorCount++;
      itemHasError = true;
      reasons.push(
        `Baris #${rowNum} (${title || "Tanpa Judul"}): Format jam kuliah tidak valid (${
          start || "?"
        } - ${end || "?"}).`
      );
    } else {
      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      if (startMin >= endMin) {
        timeErrorCount++;
        itemHasError = true;
        reasons.push(
          `Baris #${rowNum} (${title || "Tanpa Judul"}): Jam mulai (${start}) mendahului atau sama dengan jam selesai (${end}).`
        );
      } else {
        const durationMin = endMin - startMin;
        if (durationMin < 15) {
          timeErrorCount++;
          itemHasError = true;
          reasons.push(
            `Baris #${rowNum} (${title || "Tanpa Judul"}): Durasi kuliah terlalu singkat (< 15 menit).`
          );
        } else if (durationMin > 720) {
          timeErrorCount++;
          itemHasError = true;
          reasons.push(
            `Baris #${rowNum} (${title || "Tanpa Judul"}): Durasi kuliah melebihi batas wajar (> 12 jam).`
          );
        }
      }
    }

    // 4. Field-level confidence checks (when provided by Vision AI or spatial engine)
    const fieldConf = it.fieldConfidence || it.field_confidence;
    let hasLowConfidenceRequiredField = false;
    if (fieldConf && typeof fieldConf === "object") {
      const requiredFields = ["namaMatkul", "hari", "waktuMulai", "waktuSelesai"];
      for (const rf of requiredFields) {
        const fc = fieldConf[rf];
        if (fc) {
          const score = typeof fc.ocrConfidence === "number" ? fc.ocrConfidence : fc.confidence;
          if (typeof score === "number" && score < config.mediumConfidenceThreshold) {
            hasLowConfidenceRequiredField = true;
            reasons.push(
              `Baris #${rowNum} (${title || "Tanpa Judul"}): Bidang '${rf}' memiliki estimasi keyakinan visual rendah (${score}%).`
            );
          }
        }
      }
    }

    // 5. External item warnings (e.g., schedule conflicts, carrier notices)
    if (Array.isArray(it.warnings)) {
      for (const w of it.warnings) {
        if (!reasons.includes(w)) {
          reasons.push(w);
        }
      }
    }

    // 6. Uncertainty & Review Flag
    const isFlaggedForReview = Boolean(
      it.needsReview ||
        it.needs_review ||
        hasLowConfidenceRequiredField ||
        (it.warnings && it.warnings.length > 0)
    );
    if (isFlaggedForReview || itemHasError) {
      uncertainItemsCount++;
    } else {
      validItemsCount++;
    }
  }

  // Categorize reasons
  const ocrExtractionErrors: string[] = [];
  const scheduleConflicts: string[] = [];
  const verificationSuggestions: string[] = [];

  for (const r of reasons) {
    if (r.toLowerCase().includes("bentrok") || r.toLowerCase().includes("duplikat")) {
      scheduleConflicts.push(r);
    } else if (r.toLowerCase().includes("usul") || r.toLowerCase().includes("koreksi")) {
      verificationSuggestions.push(r);
    } else {
      ocrExtractionErrors.push(r);
    }
  }

  const passRatePercent = Math.round((validItemsCount / total) * 100);
  const uncertainRatio = uncertainItemsCount / total;

  const hasTimeErrors = timeErrorCount > 0;
  const hasWeekdayErrors = weekdayErrorCount > 0;
  const hasMissingTitleErrors = missingTitleCount > 0;

  // Strict Decision logic:
  // Invariant: High model confidence must NEVER override invalid dates, impossible times, or missing title.
  const meetsPassRate = passRatePercent >= config.minPassRatePercent;
  const meetsUncertaintyRatio = uncertainRatio <= config.maxUncertainRatio;
  const meetsMinimumItems = total >= config.minTotalItems;
  const hasZeroFatalErrors = !hasTimeErrors && !hasMissingTitleErrors;

  const isSufficientForProduction =
    meetsMinimumItems && meetsPassRate && meetsUncertaintyRatio && hasZeroFatalErrors;

  const visionFallbackEligible = !isSufficientForProduction;

  let recommendation: "accept" | "manual_review" | "offer_vision_fallback";
  if (isSufficientForProduction) {
    recommendation = "accept";
  } else if (total > 0 && validItemsCount > 0 && !hasTimeErrors) {
    recommendation = "manual_review";
  } else {
    recommendation = "offer_vision_fallback";
  }

  return {
    isSufficientForProduction,
    visionFallbackEligible,
    score: {
      totalItems: total,
      validItemsCount,
      uncertainItemsCount,
      passRatePercent,
      hasTimeErrors,
      hasWeekdayErrors,
      hasMissingTitleErrors,
      timeErrorCount,
      weekdayErrorCount,
      missingTitleCount,
    },
    reasons,
    warningCategories: {
      ocrExtractionErrors,
      scheduleConflicts,
      verificationSuggestions,
    },
    recommendation,
  };
}

// ============================================================================
// 1. Canonical Academic Data Contracts
// ============================================================================

export type AcademicDocumentType =
  | "class_schedule"
  | "exam_schedule"
  | "course_registration_krs"
  | "replacement_class"
  | "unknown";

export type AcademicRecurrenceType = "weekly" | "one_time" | "none";

export type FieldValidationLevel = "valid" | "tentative" | "invalid" | "missing";

export interface FieldValidationInfo {
  status: FieldValidationLevel;
  confidenceScore?: number; // Calibrated 0.0 - 1.0 (advisory)
  message?: string;
}

export interface CanonicalAcademicItem {
  /** Deterministic identifier for UI tracking during review */
  id: string;

  /** Full official course name (never fabricated) */
  namaMatkul: string;

  /** Course catalog code (e.g., IF253418), if present */
  kodeMatkul: string | null;

  /** Section or class identifier (e.g., R.01, Reguler-A), if present */
  kelas: string | null;

  /** Day of week in Indonesian (Senin, Selasa, etc.), null if specific date or absent */
  hari: string | null;

  /** Calendar date (YYYY-MM-DD) for specific-date events (exams, replacements), null for weekly */
  tanggal: string | null;

  /** Start time in 24h format (HH:mm), e.g., 08:00 */
  waktuMulai: string | null;

  /** End time in 24h format (HH:mm), e.g., 10:30 */
  waktuSelesai: string | null;

  /** Classroom, laboratory, or online room location */
  lokasi: string | null;

  /** Instructor or lecturer name, if stated */
  dosen: string | null;

  /** Credit units (SKS: 1 - 8), if present */
  sks: number | null;

  /** Academic category (Wajib, Pilihan, etc.) */
  kategori: string | null;

  /** Recurrence classification */
  recurrence: AcademicRecurrenceType;

  /** Review requirement flag */
  needsReview: boolean;

  /** Human-readable warning messages explaining ambiguities */
  warnings: string[];

  /** Field-by-field validation states */
  fieldValidations: Record<string, FieldValidationInfo>;

  /** Source extraction evidence and provenance */
  provenance?: {
    rawTextSnippet?: string;
    pageIndex?: number;
    extractionMethod?: "text_stream" | "ocr_spatial" | "ocr_text" | "ml_inferred";
  };
}

export interface CanonicalAcademicExtractionResult {
  /** Detected document categorization */
  documentType: AcademicDocumentType;

  /** Extracted academic items */
  items: CanonicalAcademicItem[];

  /** Total detected rows */
  totalItems: number;

  /** Number of rows requiring manual review */
  needsReviewCount: number;

  /** True if critical fields are missing or extraction is insufficient for production persistence */
  insufficientForPersistence: boolean;

  /** Reasons why extraction requires review or is insufficient */
  reviewReasons: string[];

  /** Timing and diagnostic metrics (non-sensitive) */
  metrics: {
    durationMs: number;
    extractedCharacterCount: number;
    sourceFormat: "pdf_text" | "scanned_pdf" | "image_png" | "image_jpeg" | "synthetic";
  };
}

// ============================================================================
// 2. Runtime Schema Validators (Pure TypeScript, Zero External Dependencies)
// ============================================================================

const VALID_DAYS = new Set(["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]);

export function isValidIndonesianDay(day: unknown): day is string {
  return typeof day === "string" && VALID_DAYS.has(day.trim());
}

export function isValidTimeString(time: unknown): time is string {
  if (typeof time !== "string") return false;
  const match = time.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match !== null;
}

export function isValidCalendarDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== "string") return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

export function validateCanonicalAcademicItem(
  item: unknown
): { valid: boolean; errors: string[]; validatedItem?: CanonicalAcademicItem } {
  if (!item || typeof item !== "object") {
    return { valid: false, errors: ["Item must be a non-null object"] };
  }

  const raw = item as Record<string, any>;
  const errors: string[] = [];

  // Required: id
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  if (!id) errors.push("Missing or invalid 'id'");

  // Required: namaMatkul
  const namaMatkul = typeof raw.namaMatkul === "string" ? raw.namaMatkul.trim() : "";
  if (!namaMatkul || namaMatkul.length < 2) {
    errors.push("Missing or invalid 'namaMatkul' (minimum 2 characters required)");
  }

  // Recurrence
  const validRecurrences: AcademicRecurrenceType[] = ["weekly", "one_time", "none"];
  const recurrence: AcademicRecurrenceType = validRecurrences.includes(raw.recurrence)
    ? raw.recurrence
    : raw.hari
    ? "weekly"
    : raw.tanggal
    ? "one_time"
    : "none";

  // Day & Date validations
  let hari: string | null = null;
  if (raw.hari !== null && raw.hari !== undefined && raw.hari !== "") {
    if (isValidIndonesianDay(raw.hari)) {
      hari = raw.hari.trim();
    } else {
      errors.push(`Invalid Indonesian weekday name: '${raw.hari}'`);
    }
  }

  let tanggal: string | null = null;
  if (raw.tanggal !== null && raw.tanggal !== undefined && raw.tanggal !== "") {
    if (isValidCalendarDate(raw.tanggal)) {
      tanggal = raw.tanggal.trim();
    } else {
      errors.push(`Invalid calendar date format (expected YYYY-MM-DD): '${raw.tanggal}'`);
    }
  }

  // Time validations
  let waktuMulai: string | null = null;
  if (raw.waktuMulai !== null && raw.waktuMulai !== undefined && raw.waktuMulai !== "") {
    if (isValidTimeString(raw.waktuMulai)) {
      waktuMulai = raw.waktuMulai.trim();
    } else {
      errors.push(`Invalid start time format (expected HH:mm): '${raw.waktuMulai}'`);
    }
  }

  let waktuSelesai: string | null = null;
  if (raw.waktuSelesai !== null && raw.waktuSelesai !== undefined && raw.waktuSelesai !== "") {
    if (isValidTimeString(raw.waktuSelesai)) {
      waktuSelesai = raw.waktuSelesai.trim();
    } else {
      errors.push(`Invalid end time format (expected HH:mm): '${raw.waktuSelesai}'`);
    }
  }

  if (waktuMulai && waktuSelesai && waktuMulai >= waktuSelesai) {
    errors.push(`Start time (${waktuMulai}) must be strictly earlier than end time (${waktuSelesai})`);
  }

  // SKS validation
  let sks: number | null = null;
  if (raw.sks !== null && raw.sks !== undefined && raw.sks !== "") {
    const num = typeof raw.sks === "number" ? raw.sks : parseInt(String(raw.sks), 10);
    if (!isNaN(num) && num >= 1 && num <= 8) {
      sks = num;
    } else {
      errors.push(`Invalid SKS value (must be 1 to 8): '${raw.sks}'`);
    }
  }

  const kodeMatkul = typeof raw.kodeMatkul === "string" && raw.kodeMatkul.trim() ? raw.kodeMatkul.trim() : null;
  const kelas = typeof raw.kelas === "string" && raw.kelas.trim() ? raw.kelas.trim() : null;
  const lokasi = typeof raw.lokasi === "string" && raw.lokasi.trim() ? raw.lokasi.trim() : null;
  const dosen = typeof raw.dosen === "string" && raw.dosen.trim() ? raw.dosen.trim() : null;
  const kategori = typeof raw.kategori === "string" && raw.kategori.trim() ? raw.kategori.trim() : "Wajib";

  const fieldValidations: Record<string, FieldValidationInfo> = raw.fieldValidations && typeof raw.fieldValidations === "object"
    ? raw.fieldValidations
    : {
        namaMatkul: { status: namaMatkul ? "valid" : "invalid" },
        hari: { status: hari ? "valid" : recurrence === "weekly" ? "invalid" : "missing" },
        waktuMulai: { status: waktuMulai ? "valid" : recurrence === "none" ? "missing" : "invalid" },
        waktuSelesai: { status: waktuSelesai ? "valid" : recurrence === "none" ? "missing" : "invalid" },
      };

  const warnings: string[] = Array.isArray(raw.warnings) ? raw.warnings.map(String) : [];
  const needsReview = Boolean(
    raw.needsReview ||
    errors.length > 0 ||
    !namaMatkul ||
    (recurrence === "weekly" && (!hari || !waktuMulai || !waktuSelesai)) ||
    (recurrence === "one_time" && (!tanggal || !waktuMulai))
  );

  const validatedItem: CanonicalAcademicItem = {
    id: id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    namaMatkul,
    kodeMatkul,
    kelas,
    hari,
    tanggal,
    waktuMulai,
    waktuSelesai,
    lokasi,
    dosen,
    sks,
    kategori,
    recurrence,
    needsReview,
    warnings: [...warnings, ...errors],
    fieldValidations,
    provenance: raw.provenance,
  };

  return {
    valid: errors.length === 0,
    errors,
    validatedItem,
  };
}

// ============================================================================
// 3. Provider Abstraction Interface & Lifecycle
// ============================================================================

export interface AcademicDocumentInput {
  /** Raw file binary buffer */
  buffer: Buffer;

  /** File MIME type */
  mimeType: string;

  /** Original filename for heuristic hints */
  fileName: string;

  /** Pre-extracted text if provided by client/pipeline */
  preExtractedText?: string;
}

export interface ExtractionOptions {
  /** Explicit user consent for external or heavy ML processing */
  userConsent?: boolean;

  /** Timeout in milliseconds */
  timeoutMs?: number;

  /** Existing user courses for deduplication/conflict detection */
  existingCourses?: Array<{
    namaMatkul: string;
    hari: string;
    waktuMulai: Date | string;
    waktuSelesai: Date | string;
  }>;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface AcademicExtractionProvider {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable provider title */
  readonly name: string;

  /** Verifies if the provider runtime is ready and operational */
  isAvailable(): Promise<boolean>;

  /** Extracts structured academic records from a document input */
  extract(
    input: AcademicDocumentInput,
    options?: ExtractionOptions
  ): Promise<CanonicalAcademicExtractionResult>;
}

/**
 * Mock Academic Extraction Provider for isolated testing and CI suites.
 */
export class MockAcademicProvider implements AcademicExtractionProvider {
  readonly id = "mock";
  readonly name = "Mock Academic Test Provider";

  private mockResults: Map<string, CanonicalAcademicExtractionResult> = new Map();

  constructor(customMocks?: Record<string, CanonicalAcademicExtractionResult>) {
    if (customMocks) {
      for (const [key, val] of Object.entries(customMocks)) {
        this.mockResults.set(key, val);
      }
    }
  }

  setMockForFile(fileName: string, result: CanonicalAcademicExtractionResult): void {
    this.mockResults.set(fileName, result);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async extract(
    input: AcademicDocumentInput,
    _options?: ExtractionOptions
  ): Promise<CanonicalAcademicExtractionResult> {
    const matched = this.mockResults.get(input.fileName);
    if (matched) {
      return matched;
    }

    return {
      documentType: "class_schedule",
      items: [
        {
          id: "mock_1",
          namaMatkul: "Sistem Terdistribusi",
          kodeMatkul: "IF3201",
          kelas: "R.01",
          hari: "Senin",
          tanggal: null,
          waktuMulai: "08:00",
          waktuSelesai: "10:30",
          lokasi: "Lab RPL",
          dosen: "Dr. Budi Santoso",
          sks: 3,
          kategori: "Wajib",
          recurrence: "weekly",
          needsReview: false,
          warnings: [],
          fieldValidations: {
            namaMatkul: { status: "valid" },
            hari: { status: "valid" },
            waktuMulai: { status: "valid" },
            waktuSelesai: { status: "valid" },
          },
        },
      ],
      totalItems: 1,
      needsReviewCount: 0,
      insufficientForPersistence: false,
      reviewReasons: [],
      metrics: {
        durationMs: 5,
        extractedCharacterCount: 120,
        sourceFormat: "synthetic",
      },
    };
  }
}

/**
 * Self-Hosted Server ML Provider Client.
 * Connects via HTTP/JSON to an internal server-to-server microservice endpoint
 * (e.g. FastAPI / llama.cpp / vLLM) when configured via process.env.SELF_HOSTED_ML_URL.
 * Gracefully unavailable if unconfigured or unreachable.
 */
export class SelfHostedServerProvider implements AcademicExtractionProvider {
  readonly id = "self_hosted_ml";
  readonly name = "Self-Hosted Academic ML Microservice";
  private endpointUrl: string;

  constructor(endpointUrl?: string) {
    this.endpointUrl = endpointUrl || process.env.SELF_HOSTED_ML_URL || "";
  }

  async isAvailable(): Promise<boolean> {
    if (!this.endpointUrl || this.endpointUrl.trim().length === 0) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.endpointUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  async extract(
    input: AcademicDocumentInput,
    options?: ExtractionOptions
  ): Promise<CanonicalAcademicExtractionResult> {
    if (!(await this.isAvailable())) {
      throw new Error("Self-hosted ML microservice is not available or unreachable.");
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs || 25000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        fileName: input.fileName,
        mimeType: input.mimeType,
        text: input.preExtractedText || input.buffer.toString("utf8"),
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const serviceKey =
        process.env.SELF_HOSTED_ML_KEY ||
        process.env.SERVICE_API_KEY ||
        "trackerthings_dev_secret_key_8f7b2c9a1d4e6f3b0a2c5e8d";
      if (serviceKey) {
        headers["Authorization"] = `Bearer ${serviceKey}`;
      }

      const res = await fetch(`${this.endpointUrl}/extract`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal || controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Self-hosted ML returned status ${res.status}`);
      }

      const json = await res.json();
      return json as CanonicalAcademicExtractionResult;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * External Generative Provider Client (e.g. Google Gemini REST).
 * STRICTLY requires explicit user consent (options.userConsent === true).
 * Zero silent fallbacks to external network without user permission.
 */
export class ExternalGenerativeProvider implements AcademicExtractionProvider {
  readonly id = "external_cloud_ai";
  readonly name = "External Generative Vision Provider";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.VISION_API_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async extract(
    _input: AcademicDocumentInput,
    options?: ExtractionOptions
  ): Promise<CanonicalAcademicExtractionResult> {
    if (options?.userConsent !== true) {
      throw new Error("User consent required before calling external generative AI provider.");
    }
    if (!(await this.isAvailable())) {
      throw new Error("External AI provider API key is not configured.");
    }

    // Handled via existing lib/visionProvider.ts when user explicitly triggers AI assist
    throw new Error("External generative provider should be invoked through user-initiated UI flow.");
  }
}

// ============================================================================
// 4. Deterministic Multi-Layout Extractor
// ============================================================================

const HARI_CANONICAL: Record<string, string> = {
  senin: "Senin",
  sen1n: "Senin",
  senln: "Senin",
  snn: "Senin",
  mon: "Senin",
  monday: "Senin",
  selasa: "Selasa",
  se1asa: "Selasa",
  selas4: "Selasa",
  sls: "Selasa",
  tue: "Selasa",
  tuesday: "Selasa",
  rabu: "Rabu",
  r4bu: "Rabu",
  wed: "Rabu",
  wednesday: "Rabu",
  kamis: "Kamis",
  kam1s: "Kamis",
  k4mis: "Kamis",
  kms: "Kamis",
  thu: "Kamis",
  thursday: "Kamis",
  jumat: "Jumat",
  "jum'at": "Jumat",
  jumaat: "Jumat",
  jum4t: "Jumat",
  jmt: "Jumat",
  fri: "Jumat",
  friday: "Jumat",
  sabtu: "Sabtu",
  s4btu: "Sabtu",
  sat: "Sabtu",
  saturday: "Sabtu",
  minggu: "Minggu",
  m1nggu: "Minggu",
  sun: "Minggu",
  sunday: "Minggu",
};

const INDO_MONTHS: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10, oct: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12,
};

export function normalizeIndonesianDay(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9']/g, "");
  return HARI_CANONICAL[clean] || null;
}

export function normalizeTimeString(raw: string): string | null {
  // Handles HH:mm or HH.mm or (HH:mm)
  const match = raw.trim().match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeCourseCode(raw: string): string | null {
  // Corrects common OCR substitutions in course code (e.g. 1F253418 -> IF253418, 0S101 -> CS101)
  let clean = raw.trim().toUpperCase().replace(/\s+/g, "");
  clean = clean.replace(/^1F/, "IF").replace(/^1T/, "IT");
  const match = clean.match(/^[A-Z]{2,4}[-\s]?\d{3,6}$/);
  return match ? clean : null;
}

export function parseDateFromIndonesianText(text: string): string | null {
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const indoWordMatch = text.match(/\b(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})\b/);
  if (indoWordMatch) {
    const day = parseInt(indoWordMatch[1], 10);
    const mStr = indoWordMatch[2].toLowerCase();
    const year = parseInt(indoWordMatch[3], 10);
    const month = INDO_MONTHS[mStr];
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const slashMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10);
    const y = parseInt(slashMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

export function detectDocumentCategory(text: string): AcademicDocumentType {
  const lower = text.toLowerCase();

  const examKeywords = ["jadwal ujian", "uts", "uas", "ujian tengah semester", "ujian akhir semester", "pengawas"];
  const examMatches = examKeywords.filter((k) => lower.includes(k)).length;
  if (examMatches >= 2 || (lower.includes("ujian") && /\b(ruang ujian|sifat ujian)\b/.test(lower))) {
    return "exam_schedule";
  }

  if (lower.includes("kelas pengganti") || lower.includes("kuliah pengganti") || lower.includes("reschedule")) {
    return "replacement_class";
  }

  if (
    (lower.includes("kartu rencana studi") || lower.includes("krs") || lower.includes("daftar mata kuliah")) &&
    !lower.includes("waktu") && !lower.includes("mulai") && !lower.includes("jam")
  ) {
    return "course_registration_krs";
  }

  if (
    lower.includes("jadwal") ||
    lower.includes("siakad") ||
    lower.includes("kuliah") ||
    lower.includes("senin") ||
    lower.includes("selasa") ||
    lower.includes("rabu") ||
    lower.includes("kamis") ||
    lower.includes("jumat")
  ) {
    return "class_schedule";
  }

  return "unknown";
}

export class DeterministicAcademicExtractor implements AcademicExtractionProvider {
  readonly id = "deterministic";
  readonly name = "Deterministic Academic Layout Extractor";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async extract(
    input: AcademicDocumentInput,
    _options?: ExtractionOptions
  ): Promise<CanonicalAcademicExtractionResult> {
    const startTime = Date.now();
    const rawText = input.preExtractedText || input.buffer.toString("utf8");
    const docType = detectDocumentCategory(rawText);

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l));

    const rawItems: CanonicalAcademicItem[] = [];
    let lineIdx = 0;

    for (const line of lines) {
      lineIdx++;

      // Skip document title / header lines without table delimiters
      if (
        /^(jadwal|kartu rencana|fakultas|universitas|daftar|pemberitahuan|semester)/i.test(line) &&
        !line.includes("|") &&
        !line.includes("\t")
      ) {
        continue;
      }

      // Skip table column header lines
      if (
        /^(no|kode|hari|tanggal|mata kuliah|matakuliah|sks|jam|ruang|dosen|waktu)/i.test(line) &&
        (line.includes("|") || line.includes("\t") || line.toLowerCase().includes("sks"))
      ) {
        continue;
      }

      const delimiter = line.includes("|") ? "|" : line.includes("\t") ? "\t" : null;
      let parsedRow: CanonicalAcademicItem | null = null;

      if (delimiter) {
        parsedRow = this.parseDelimitedRow(line, delimiter, lineIdx, docType);
      } else {
        parsedRow = this.parseFreeformRow(line, lineIdx, docType);
      }

      if (parsedRow) {
        const validated = validateCanonicalAcademicItem(parsedRow);
        if (validated.validatedItem) {
          rawItems.push(validated.validatedItem);
        }
      }
    }

    const needsReviewCount = rawItems.filter((i) => i.needsReview).length;
    const insufficient = rawItems.length === 0 || rawItems.every((i) => !i.namaMatkul);

    const reviewReasons: string[] = [];
    if (rawItems.length === 0) {
      reviewReasons.push("Tidak ada baris akademik yang terdeteksi secara deterministik.");
    }
    if (needsReviewCount > 0) {
      reviewReasons.push(`${needsReviewCount} baris memiliki kolom yang membutuhkan peninjauan manual.`);
    }

    return {
      documentType: docType,
      items: rawItems,
      totalItems: rawItems.length,
      needsReviewCount,
      insufficientForPersistence: insufficient,
      reviewReasons,
      metrics: {
        durationMs: Date.now() - startTime,
        extractedCharacterCount: rawText.length,
        sourceFormat: input.mimeType.includes("pdf") ? "pdf_text" : "synthetic",
      },
    };
  }

  private parseDelimitedRow(
    line: string,
    delimiter: string,
    rowIdx: number,
    docType: AcademicDocumentType
  ): CanonicalAcademicItem | null {
    const rawCells = line
      .split(delimiter)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (rawCells.length < 2) return null;

    let hari: string | null = null;
    let tanggal: string | null = null;
    let waktuMulai: string | null = null;
    let waktuSelesai: string | null = null;
    let kodeMatkul: string | null = null;
    let namaMatkul = "";
    let kelas: string | null = null;
    let lokasi: string | null = null;
    let sks: number | null = null;
    let dosen: string | null = null;

    let cellIdx = 0;
    for (const cell of rawCells) {
      // 0. Skip leading sequence number column (e.g. "1", "2", "3" in "No | ...")
      if (cellIdx === 0 && /^\d+$/.test(cell) && rawCells.length >= 4) {
        cellIdx++;
        continue;
      }
      cellIdx++;

      // 1. Day check
      const d = normalizeIndonesianDay(cell);
      if (d && !hari) {
        hari = d;
        continue;
      }

      // 2. Specific date check (for exams/replacements)
      const parsedDate = parseDateFromIndonesianText(cell);
      if (parsedDate && !tanggal) {
        tanggal = parsedDate;
        continue;
      }

      // 3. Time check (handles 08:00 - 10:30, 08:00:00, 08.00-10.30, Sesi 1-2 (08:00 - 09:40))
      const timeRangeMatch = cell.match(/(\d{1,2}[:.]\d{2}(?::\d{2})?)\s*(?:-|–|—|s\/d|sd|sampai|to)\s*(\d{1,2}[:.]\d{2}(?::\d{2})?)/i);
      if (timeRangeMatch) {
        waktuMulai = normalizeTimeString(timeRangeMatch[1]);
        waktuSelesai = normalizeTimeString(timeRangeMatch[2]);
        continue;
      }

      const singleTimeMatch = cell.match(/^(\d{1,2}[:.]\d{2}(?::\d{2})?)$/);
      if (singleTimeMatch) {
        const t = normalizeTimeString(singleTimeMatch[1]);
        if (!waktuMulai) waktuMulai = t;
        else if (!waktuSelesai) waktuSelesai = t;
        continue;
      }

      // 4. Course Code (e.g. IF253418, CS101, TIF-301)
      const normalizedCode = normalizeCourseCode(cell);
      if (normalizedCode && !kodeMatkul) {
        kodeMatkul = normalizedCode;
        continue;
      }

      // 5. Class / Section (e.g. R.01, Kls A, 01)
      const classMatch = cell.match(/^(?:R\.?\d{2}|[A-Z]|\d{2})$/i);
      if (classMatch && !kelas && cell.length <= 4) {
        kelas = cell.toUpperCase();
        continue;
      }

      // 6. SKS (integer 1-8)
      if (/^[1-8]$/.test(cell) && sks === null) {
        sks = parseInt(cell, 10);
        continue;
      }

      // 7. Room / Lokasi (supports multi-word rooms e.g. "Gedung Menara Saidah Lantai 3 R.304")
      if (/\b(?:Lab|Ruang|R\.|Gedung|D\.\d+|L\.\d+|Online|Zoom|Auditorium)\b/i.test(cell) && !lokasi) {
        lokasi = cell;
        continue;
      }

      // 8. Lecturer (contains Gelar: Dr, M.Kom, S.T, Prof)
      if (/\b(?:Dr|Prof|M\.Kom|S\.T|M\.T|S\.Kom|Ph\.D|Ir\.)\b/i.test(cell) && !dosen) {
        dosen = cell;
        continue;
      }

      // 9. Course Name candidate
      if (cell.length >= 3 && !/^\d+$/.test(cell)) {
        if (!namaMatkul) {
          namaMatkul = cell;
        } else if (cell.length > namaMatkul.length && !lokasi) {
          lokasi = namaMatkul;
          namaMatkul = cell;
        }
      }
    }

    if (!namaMatkul) return null;

    const isExam = docType === "exam_schedule" || Boolean(tanggal);
    const recurrence = isExam ? "one_time" : hari ? "weekly" : "none";

    return {
      id: `row_${rowIdx}`,
      namaMatkul,
      kodeMatkul,
      kelas,
      hari,
      tanggal,
      waktuMulai,
      waktuSelesai,
      lokasi,
      dosen,
      sks,
      kategori: "Wajib",
      recurrence,
      needsReview: !namaMatkul || (recurrence === "weekly" && (!hari || !waktuMulai)),
      warnings: [],
      fieldValidations: {
        namaMatkul: { status: namaMatkul ? "valid" : "invalid" },
        hari: { status: hari ? "valid" : "missing" },
        waktuMulai: { status: waktuMulai ? "valid" : "missing" },
        waktuSelesai: { status: waktuSelesai ? "valid" : "missing" },
      },
      provenance: {
        rawTextSnippet: line,
        extractionMethod: "text_stream",
      },
    };
  }

  private parseFreeformRow(
    line: string,
    rowIdx: number,
    docType: AcademicDocumentType
  ): CanonicalAcademicItem | null {
    const tokens = line.split(/\s+/);
    if (tokens.length < 3) return null;

    let hari: string | null = null;
    let waktuMulai: string | null = null;
    let waktuSelesai: string | null = null;
    let kodeMatkul: string | null = null;
    let sks: number | null = null;

    for (const tok of tokens) {
      const d = normalizeIndonesianDay(tok);
      if (d && !hari) hari = d;
      const codeMatch = normalizeCourseCode(tok);
      if (codeMatch && !kodeMatkul) kodeMatkul = codeMatch;
    }

    const timeMatch = line.match(/(\d{1,2}[:.]\d{2})\s*(?:-|–|—|s\/d|sd)\s*(\d{1,2}[:.]\d{2})/i);
    if (timeMatch) {
      waktuMulai = normalizeTimeString(timeMatch[1]);
      waktuSelesai = normalizeTimeString(timeMatch[2]);
    }

    const sksMatch = line.match(/\b([1-8])\s*sks\b/i);
    if (sksMatch) {
      sks = parseInt(sksMatch[1], 10);
    } else {
      const lastTok = tokens[tokens.length - 1];
      if (/^[1-8]$/.test(lastTok)) {
        sks = parseInt(lastTok, 10);
      }
    }

    const parsedDate = parseDateFromIndonesianText(line);

    if (!hari && !parsedDate && !waktuMulai && (!kodeMatkul || !sks)) {
      return null;
    }

    let cleaned = line;
    if (hari) cleaned = cleaned.replace(new RegExp(`\\b${hari}\\b`, "i"), "");
    if (kodeMatkul) cleaned = cleaned.replace(new RegExp(`\\b${kodeMatkul}\\b`, "i"), "");
    if (timeMatch) cleaned = cleaned.replace(timeMatch[0], "");
    if (sks) {
      cleaned = cleaned.replace(new RegExp(`\\b${sks}\\s*sks\\b`, "i"), "");
      cleaned = cleaned.replace(new RegExp(`\\b${sks}\\b\\s*$`), "");
    }
    cleaned = cleaned.replace(/\bsks\b/gi, "");

    const namaMatkul = cleaned.replace(/[^a-zA-Z0-9\s()\-]/g, " ").replace(/\s+/g, " ").trim();
    if (!namaMatkul || namaMatkul.length < 3) return null;

    const isExam = docType === "exam_schedule" || Boolean(parsedDate);
    const recurrence = isExam ? "one_time" : hari ? "weekly" : "none";

    return {
      id: `free_${rowIdx}`,
      namaMatkul,
      kodeMatkul,
      kelas: null,
      hari,
      tanggal: parsedDate,
      waktuMulai,
      waktuSelesai,
      lokasi: null,
      dosen: null,
      sks,
      kategori: "Wajib",
      recurrence,
      needsReview: !hari || !waktuMulai || !waktuSelesai,
      warnings: !waktuMulai ? ["Waktu mulai dan selesai tidak terdeteksi otomatis"] : [],
      fieldValidations: {
        namaMatkul: { status: "valid" },
        hari: { status: hari ? "valid" : "missing" },
        waktuMulai: { status: waktuMulai ? "valid" : "missing" },
        waktuSelesai: { status: waktuSelesai ? "valid" : "missing" },
      },
      provenance: {
        rawTextSnippet: line,
        extractionMethod: "ocr_text",
      },
    };
  }
}

// ============================================================================
// 5. Academic Hybrid Router & Policy Decision Engine
// ============================================================================

export interface RoutingDecision {
  selectedProviderId: string;
  providerName: string;
  processingMode: "deterministic" | "self_hosted_model" | "external_provider" | "local_fallback";
  reason: string;
  documentType: AcademicDocumentType;
  qualitySignals: {
    totalItems: number;
    validItemsCount: number;
    passRatePercent: number;
    ambiguityCount: number;
    hasTimeErrors: boolean;
  };
}

export type HybridRoutingDecision = RoutingDecision;

export class AcademicHybridRouter {
  readonly deterministicExtractor: AcademicExtractionProvider;
  readonly selfHostedProvider?: AcademicExtractionProvider;
  readonly externalProvider?: AcademicExtractionProvider;
  readonly config: QualityGateConfig;

  constructor(options?: {
    deterministicExtractor?: AcademicExtractionProvider;
    selfHostedProvider?: AcademicExtractionProvider;
    externalProvider?: AcademicExtractionProvider;
    config?: Partial<QualityGateConfig>;
  }) {
    this.deterministicExtractor = options?.deterministicExtractor || new DeterministicAcademicExtractor();
    this.selfHostedProvider = options?.selfHostedProvider || new SelfHostedServerProvider();
    this.externalProvider = options?.externalProvider || new ExternalGenerativeProvider();
    this.config = { ...DEFAULT_QUALITY_GATE_CONFIG, ...options?.config };
  }

  evaluateQuality(result: CanonicalAcademicExtractionResult) {
    const decision = evaluateExtractionQuality(result, this.config);
    return {
      totalItems: decision.score.totalItems,
      validItemsCount: decision.score.validItemsCount,
      passRatePercent: decision.score.passRatePercent,
      ambiguityCount: decision.score.uncertainItemsCount,
      hasTimeErrors: decision.score.hasTimeErrors,
      isSufficientForProduction: decision.isSufficientForProduction,
      visionFallbackEligible: decision.visionFallbackEligible,
      reasons: decision.reasons,
    };
  }

  async routeAndExtract(
    input: AcademicDocumentInput,
    options?: ExtractionOptions
  ): Promise<{ result: CanonicalAcademicExtractionResult; decision: RoutingDecision }> {
    // 1. Always evaluate deterministic local extractor first (fast, free, zero network)
    const deterministicResult = await this.deterministicExtractor.extract(input, options);
    const quality = this.evaluateQuality(deterministicResult);

    // High quality deterministic threshold
    if (quality.isSufficientForProduction) {
      return {
        result: deterministicResult,
        decision: {
          selectedProviderId: this.deterministicExtractor.id,
          providerName: this.deterministicExtractor.name,
          processingMode: "deterministic",
          reason: `Deterministic extractor succeeded with high confidence (pass rate: ${quality.passRatePercent}%)`,
          documentType: deterministicResult.documentType,
          qualitySignals: quality,
        },
      };
    }

    // 2. If deterministic extraction was insufficient, check if self-hosted ML microservice is available
    if (this.selfHostedProvider && (await this.selfHostedProvider.isAvailable())) {
      try {
        const mlResult = await this.selfHostedProvider.extract(input, options);
        const mlQuality = this.evaluateQuality(mlResult);
        if (mlQuality.totalItems > 0 && mlQuality.passRatePercent >= quality.passRatePercent) {
          return {
            result: mlResult,
            decision: {
              selectedProviderId: this.selfHostedProvider.id,
              providerName: this.selfHostedProvider.name,
              processingMode: "self_hosted_model",
              reason: "Self-hosted ML microservice resolved ambiguous document layout",
              documentType: mlResult.documentType,
              qualitySignals: mlQuality,
            },
          };
        }
      } catch {
        // Safe fallback: continue to next tier without crashing
      }
    }

    // 3. Fallback & Resilience: Return best deterministic items with review markers
    // Never silently discard records when offline or models are unavailable
    return {
      result: deterministicResult,
      decision: {
        selectedProviderId: this.deterministicExtractor.id,
        providerName: this.deterministicExtractor.name,
        processingMode: "local_fallback",
        reason: quality.totalItems > 0
          ? "Deterministic result returned with review warnings (advanced ML models offline)"
          : "Deterministic extraction found no confident rows; manual review required",
        documentType: deterministicResult.documentType,
        qualitySignals: quality,
      },
    };
  }
}

// ============================================================================
// 6. Backward-Compatible Bridge to Legacy Web & iOS Models
// ============================================================================

/**
 * Bridges a CanonicalAcademicItem into the exact legacy shape expected by
 * Web (ImportScheduleModal.tsx) and iOS (ScheduleImportModels.swift) without breaking changes.
 */
export function bridgeCanonicalToLegacyItem(item: CanonicalAcademicItem): Record<string, any> {
  const fieldConfMap: Record<string, any> = {};
  for (const [fKey, fVal] of Object.entries(item.fieldValidations || {})) {
    fieldConfMap[fKey] = {
      level: fVal.status === "valid" ? "high" : fVal.status === "tentative" ? "medium" : "low",
      source: "header_aligned_ocr",
      needsReview: fVal.status !== "valid",
      reviewReason: fVal.message,
    };
  }

  return {
    id: item.id,
    namaMatkul: item.namaMatkul,
    nama_matkul: item.namaMatkul,
    hari: item.hari || "Senin",
    tanggal: item.tanggal,
    waktuMulai: item.waktuMulai || "08:00",
    waktu_mulai: item.waktuMulai || "08:00",
    waktuSelesai: item.waktuSelesai || "10:00",
    waktu_selesai: item.waktuSelesai || "10:00",
    dosen: item.dosen,
    lokasi: item.lokasi,
    ruang: item.lokasi, // iOS alternative key
    sks: item.sks,
    kodeMatkul: item.kodeMatkul,
    kode_matkul: item.kodeMatkul,
    kelas: item.kelas,
    kategori: item.kategori || "Wajib",
    recurrence: item.recurrence,
    needsReview: item.needsReview,
    needs_review: item.needsReview,
    warnings: item.warnings,
    reviewReasons: item.warnings, // iOS alternative key
    fieldConfidence: fieldConfMap,
    field_confidence: Object.fromEntries(
      Object.entries(fieldConfMap).map(([k, v]) => [k, v.level === "high" ? 0.95 : 0.6])
    ),
    recognitionStatus: item.needsReview ? "needs_review" : "high_confidence",
    recognition_status: item.needsReview ? "needs_review" : "high_confidence",
    rawFields: {
      namaMatkul: item.namaMatkul,
      hari: item.hari || "",
      waktuMulai: item.waktuMulai || "",
      waktuSelesai: item.waktuSelesai || "",
      kodeMatkul: item.kodeMatkul || "",
      sks: item.sks ? String(item.sks) : "",
    },
    provenance: item.provenance,
  };
}

/**
 * Server-only Vision Provider Abstraction for Hybrid Schedule Recognition.
 * Supports configurable providers (Gemini REST API, mock/offline testing provider, custom compatible endpoints).
 * NEVER exposes API keys to client-side bundles, logs, or responses.
 */

export type FieldExtractionStatus = "read" | "uncertain" | "unreadable" | "missing";

export interface VisionFieldDetail<T = string | number | null> {
  rawValue: string | null;
  normalizedValue: T;
  confidence: number; // 0-100 model estimate
  status: FieldExtractionStatus;
  evidence?: string | null;
  warnings?: string[];
}

export type VerificationDecision =
  | "confirmed"
  | "corrected"
  | "uncertain"
  | "unreadable"
  | "missing";

export interface VisionFieldVerification {
  field: string;
  originalValue?: any;
  decision: VerificationDecision;
  proposedValue?: any;
  evidence?: string;
  reason?: string;
  confidence?: number;
}

export interface VerifiedScheduleItem {
  id: string;
  overallStatus: "confirmed" | "has_corrections" | "needs_attention";
  findings: Record<string, VisionFieldVerification>;
}

export interface ProposedAddedRow {
  tempId: string;
  namaMatkul: string;
  hari?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  lokasi?: string;
  kodeMatkul?: string;
  kelas?: string;
  sks?: number;
  dosen?: string;
  visualEvidence: string;
  reason: string;
  confidence: number;
}

export interface ProposedRemovedRow {
  itemId: string;
  reason: string;
  visualEvidence?: string;
  confidence: number;
}

export interface VerificationDiffSummary {
  originalRowCount: number;
  proposedRowCount: number;
  addedRowsCount: number;
  removedRowsCount: number;
  modifiedFieldsCount: number;
  addedRows: ProposedAddedRow[];
  removedRows: ProposedRemovedRow[];
  modifiedFields: Array<{
    itemId: string;
    field: string;
    before: any;
    after: any;
    evidence?: string;
    reason?: string;
    confidence?: number;
  }>;
}

export interface ScheduleVerificationResult {
  provider: string;
  model: string;
  verifiedItems: VerifiedScheduleItem[];
  proposedAddedRows: ProposedAddedRow[];
  proposedRemovedRows: ProposedRemovedRow[];
  diff: VerificationDiffSummary;
  summary: {
    totalChecked: number;
    confirmedCount: number;
    correctedCount: number;
    uncertainCount: number;
    addedRowsCount: number;
    removedRowsCount: number;
  };
  durationMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Validates whether visual evidence is substantive and refers to a physical document location/text.
 * Rejects arbitrary character counts, generic filler phrases, and requires structural/textual citation.
 */
export function isValidVisualEvidence(evidence?: string): { valid: boolean; reason?: string } {
  if (!evidence || typeof evidence !== "string") {
    return { valid: false, reason: "Bukti visual tidak disertakan." };
  }
  const trimmed = evidence.trim();
  if (trimmed.length < 8) {
    return { valid: false, reason: "Bukti visual terlalu singkat atau tidak deskriptif (< 8 karakter)." };
  }

  const lower = trimmed.toLowerCase();

  // Reject generic / boilerplate non-evidence filler
  const genericFillers = [
    "ada di gambar",
    "ada di tabel",
    "row found",
    "found in image",
    "table data",
    "visible in image",
    "baris ada",
    "terlihat jelas",
    "baris terlewat",
    "mata kuliah ada",
    "jadwal ada",
    "terbaca jelas",
  ];
  if (genericFillers.some((filler) => lower === filler || lower === filler + "." || lower.startsWith(filler + " "))) {
    return { valid: false, reason: "Bukti visual hanya berupa klaim umum tanpa rujukan baris/teks spesifik." };
  }

  // Must reference structural location: row, line, column, table region, cell, or coordinates
  const hasStructuralReference =
    /\b(baris|row|line|kolom|col|sel|cell|header|footer|posisi|kotak|koordinat|tabel|quadrant|bawah|atas|tengah)\b/i.test(
      lower
    );

  // Must reference quoted or verbatim textual content from the document
  const hasQuotedTextOrColon =
    /['"“](.+?)['"”]/.test(trimmed) ||
    /:\s*['"]?[a-zA-Z0-9]/.test(trimmed) ||
    /\b(teks|tertulis|tulisan|berbunyi|kata|text|reads|shows)\b/i.test(lower);

  if (!hasStructuralReference && !hasQuotedTextOrColon) {
    return {
      valid: false,
      reason: "Bukti visual harus menyebutkan posisi baris/kolom atau mengutip teks fisik pada dokumen.",
    };
  }

  return { valid: true };
}

export interface VisionScheduleRow {
  hari: string | null;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  kodeMatkul: string | null;
  namaMatkul: string | null;
  kelas: string | null;
  lokasi: string | null;
  sks: number | null;
  dosen: string | null;
  tanggal?: string | null;
  confidenceEstimate?: number | null;
  ambiguousFieldsReason?: string | null;

  // Phase 6 granular per-field details
  fields?: {
    namaMatkul?: VisionFieldDetail<string | null>;
    hari?: VisionFieldDetail<string | null>;
    waktuMulai?: VisionFieldDetail<string | null>;
    waktuSelesai?: VisionFieldDetail<string | null>;
    lokasi?: VisionFieldDetail<string | null>;
    kodeMatkul?: VisionFieldDetail<string | null>;
    kelas?: VisionFieldDetail<string | null>;
    sks?: VisionFieldDetail<number | null>;
    dosen?: VisionFieldDetail<string | null>;
    tanggal?: VisionFieldDetail<string | null>;
  };
  fieldConfidence?: Record<string, number>;
  fieldStatuses?: Record<string, FieldExtractionStatus>;
  rawFields?: Record<string, string>;
  tableLocation?: {
    rowIndex?: number;
    colSpan?: number;
    rowSpan?: number;
    isMergedCell?: boolean;
  };
  verificationFindings?: Record<string, VisionFieldVerification>;
}

export interface VisionExtractionResult {
  provider: string;
  model: string;
  layoutKind?: string;
  rows: VisionScheduleRow[];
  durationMs: number;
  rawResponseSummary?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface VisionProviderConfig {
  providerName: "gemini" | "mock" | "custom";
  apiKey?: string;
  modelId: string;
  endpointUrl?: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface ScheduleVisionProvider {
  name: string;
  isAvailable(): boolean;
  extractSchedule(
    imageBuffer: Buffer,
    mimeType: string,
    options?: { signal?: AbortSignal }
  ): Promise<VisionExtractionResult>;
  verifySchedule(
    imageBuffer: Buffer,
    mimeType: string,
    candidateItems: any[],
    options?: { signal?: AbortSignal }
  ): Promise<ScheduleVerificationResult>;
}

/**
 * Deterministically analyzes image buffer quality metrics (resolution, aspect ratio)
 * to warn against degraded inputs without fabricating or inventing text.
 */
export function analyzeImageQuality(
  buffer: Buffer,
  mimeType: string
): {
  isLowResolution: boolean;
  width?: number;
  height?: number;
  warning?: string;
} {
  let width: number | undefined;
  let height: number | undefined;

  try {
    const normMime = (mimeType || "").toLowerCase();
    if (normMime.includes("png") && buffer.length >= 24) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } else if (normMime.includes("jpeg") || normMime.includes("jpg")) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] === 0xff) {
          const marker = buffer[offset + 1];
          if (marker === 0xc0 || marker === 0xc2) {
            height = buffer.readUInt16BE(offset + 5);
            width = buffer.readUInt16BE(offset + 7);
            break;
          }
          const length = buffer.readUInt16BE(offset + 2);
          offset += 2 + length;
        } else {
          offset++;
        }
      }
    }
  } catch {
    // If dimension parsing fails, continue safely
  }

  const isLowResolution = Boolean(width && height && (width < 400 || height < 300));
  const warning = isLowResolution
    ? `Resolusi gambar terdeteksi rendah (${width}x${height}px). Detail teks tabel kecil mungkin berisiko kurang terbaca.`
    : undefined;

  return { isLowResolution, width, height, warning };
}

// In-memory rate limiting and metrics tracker (non-sensitive metrics only)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const userRateLimits = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 5; // Conservative limit for vision fallback

export function checkUserVisionRateLimit(userId: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = userRateLimits.get(userId);

  if (!bucket || now > bucket.resetAt) {
    userRateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_MINUTE) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  bucket.count++;
  return { allowed: true };
}

export function resetUserVisionRateLimit(userId?: string): void {
  if (userId) {
    userRateLimits.delete(userId);
  } else {
    userRateLimits.clear();
  }
}

/**
 * Returns active vision provider configuration from environment variables.
 * Defaults to 'gemini-3.5-flash-lite' via GEMINI_API_KEY for responsive, reliable interactive web extraction.
 * 'gemini-3.8-flash' can be configured via GEMINI_MODEL_ID for deep enterprise reasoning workloads.
 */
export function getVisionProviderConfig(): VisionProviderConfig {
  const providerName = (process.env.VISION_PROVIDER || "gemini").toLowerCase() as VisionProviderConfig["providerName"];
  const apiKey = process.env.GEMINI_API_KEY || process.env.VISION_API_KEY || "";
  const modelId = process.env.GEMINI_MODEL_ID || process.env.VISION_MODEL_ID || "gemini-3.5-flash-lite";

  // Adaptive timeout: default to 60,000ms (aligned with Vercel maxDuration = 60s)
  // or 85,000ms for deep reasoning models (e.g. gemini-3.8-flash).
  // Guarantee a safe ceiling of at least 60,000ms unless configured higher.
  const defaultTimeout = modelId.includes("3.8") ? 85000 : 60000;
  const envTimeout = process.env.VISION_TIMEOUT_MS ? parseInt(process.env.VISION_TIMEOUT_MS, 10) : NaN;
  const timeoutMs = !isNaN(envTimeout) ? Math.max(60000, envTimeout) : defaultTimeout;
  const maxRetries = parseInt(process.env.VISION_MAX_RETRIES || "1", 10);
  const endpointUrl = process.env.VISION_ENDPOINT_URL;

  return {
    providerName,
    apiKey,
    modelId,
    endpointUrl,
    timeoutMs: isNaN(timeoutMs) ? defaultTimeout : timeoutMs,
    maxRetries: isNaN(maxRetries) ? 1 : maxRetries,
  };
}

/**
 * Strict JSON schema for Structured Outputs with Gemini API (Phase 6).
 * Distinguishes cell-level statuses, raw unnormalized fields, and per-field confidence.
 */
const SCHEDULE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    layout: {
      type: "STRING",
      description: "Detected table format, e.g. unas_8col_table, combined_time_table, simple_schedule_table",
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          hari: {
            type: "STRING",
            description: "Weekday name in Indonesian (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu). Null or empty if not present.",
          },
          waktuMulai: {
            type: "STRING",
            description: "Start time formatted as HH:mm. E.g. 08:00, 09:50. Null or empty if not present.",
          },
          waktuSelesai: {
            type: "STRING",
            description: "End time formatted as HH:mm. E.g. 10:30, 11:30. Null or empty if not present.",
          },
          kodeMatkul: {
            type: "STRING",
            description: "Course code exactly as written (e.g. IF253418). Null if absent.",
          },
          namaMatkul: {
            type: "STRING",
            description: "Full course name. Preserves multi-line text cleanly. Never invent or hallucinate a course name.",
          },
          kelas: {
            type: "STRING",
            description: "Class / section identifier (e.g. R.03, R.01, A). Null if absent.",
          },
          lokasi: {
            type: "STRING",
            description: "Classroom / laboratory name (e.g. D.302 VA, Lab. Data Science). Null if absent.",
          },
          sks: {
            type: "NUMBER",
            description: "Number of credit units (1-8). Null if absent.",
          },
          dosen: {
            type: "STRING",
            description: "Lecturer / instructor name if visible. Null if absent.",
          },
          ambiguousFieldsReason: {
            type: "STRING",
            description: "Brief explanation if any cell text was unclear, ambiguous, or partially obscured.",
          },
          confidenceEstimate: {
            type: "NUMBER",
            description: "Overall visual clarity estimate between 0 and 100 for this row.",
          },
          fieldConfidence: {
            type: "OBJECT",
            description: "Per-field confidence scores (0-100) estimated by the model for each cell",
            properties: {
              namaMatkul: { type: "NUMBER" },
              hari: { type: "NUMBER" },
              waktuMulai: { type: "NUMBER" },
              waktuSelesai: { type: "NUMBER" },
              lokasi: { type: "NUMBER" },
              kodeMatkul: { type: "NUMBER" },
              kelas: { type: "NUMBER" },
              sks: { type: "NUMBER" },
              dosen: { type: "NUMBER" },
            },
          },
          fieldStatuses: {
            type: "OBJECT",
            description: "Per-field extraction status: read, uncertain, unreadable, or missing",
            properties: {
              namaMatkul: { type: "STRING" },
              hari: { type: "STRING" },
              waktuMulai: { type: "STRING" },
              waktuSelesai: { type: "STRING" },
              lokasi: { type: "STRING" },
              kodeMatkul: { type: "STRING" },
              kelas: { type: "STRING" },
              sks: { type: "STRING" },
              dosen: { type: "STRING" },
            },
          },
          rawFields: {
            type: "OBJECT",
            description: "Exact unnormalized raw text as read from each cell before any formatting",
            properties: {
              namaMatkul: { type: "STRING" },
              hari: { type: "STRING" },
              waktuMulai: { type: "STRING" },
              waktuSelesai: { type: "STRING" },
              lokasi: { type: "STRING" },
              kodeMatkul: { type: "STRING" },
              kelas: { type: "STRING" },
              sks: { type: "STRING" },
              dosen: { type: "STRING" },
            },
          },
        },
        required: ["namaMatkul"],
      },
    },
  },
  required: ["items"],
};

const SCHEDULE_EXTRACTION_PROMPT = `
You are an expert academic timetable document extractor.
Examine this university timetable image (or screenshot) with extreme precision. Extract EVERY visible schedule row into the specified structured JSON format.

CRITICAL INSTRUCTIONS:
1. SYSTEMATIC TABLE SCANNING: Read the table row by row and column by column. Detect the header row and map each cell to its exact column property.
2. MERGED CELLS & REPEATED HEADERS: If a day cell (e.g., "Senin") or room cell is merged across multiple rows or serves as a group header for several classes underneath it, apply that day/room to each applicable course row. Do not drop or miss subsequent rows.
3. PRESERVE ALL ROWS: Do not silently omit a course row simply because a room, lecturer, or time is missing or hard to read. Return the row with whatever fields are visible.
4. CELL STATUSES & RAW FIELDS:
   - "read": The cell is clearly visible and legibly recognized.
   - "uncertain": The text is ambiguous, partially occluded, or digits/letters could be confused (e.g. 0 vs O, 1 vs I, 8 vs B).
   - "unreadable": The cell contains print or handwriting that is too degraded, blurred, or cut off to decipher.
   - "missing": The cell is genuinely empty / blank on the document.
   Record the exact unformatted characters in rawFields.
5. NEVER INVENT OR HALLUCINATE: If a field is not present or cannot be read, leave it null or empty string. NEVER fabricate a course name, time, or day.
6. TIME NORMALIZATION: Separate combined time cells (e.g., "08:00 - 10:30", "08.00 s/d 10.30") into HH:mm waktuMulai ("08:00") and waktuSelesai ("10:30"). If a time has OCR confusion (e.g. "09:5O" with letter O), normalize it to "09:50" in waktuMulai while keeping "09:5O" in rawFields.
7. MULTI-LINE TEXT: If course names, room names, or lecturer names wrap across multiple lines within a single cell, concatenate them with a single space.
8. PER-FIELD CONFIDENCE: Estimate an uncalibrated confidence score (0-100) for each field individually based on visual contrast, resolution, and legibility.
`.trim();

/**
 * Strict JSON schema for Second-Pass Verification with Gemini API.
 * Phase 6.1: Enforces correction-first behavior, strictly prevents hallucinated additions,
 * supports evidence-backed missed rows and proposed removals of false positives.
 */
const VERIFY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verifiedItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: {
            type: "STRING",
            description: "ID of the schedule item being verified (must match candidate item id)",
          },
          overallStatus: {
            type: "STRING",
            description: "Overall verification status: confirmed, has_corrections, or needs_attention",
          },
          findings: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                field: {
                  type: "STRING",
                  description: "Field name: namaMatkul, hari, waktuMulai, waktuSelesai, lokasi, sks, kodeMatkul, kelas, dosen",
                },
                decision: {
                  type: "STRING",
                  description: "Verification decision: confirmed, corrected, uncertain, unreadable, or missing",
                },
                proposedValue: {
                  type: "STRING",
                  description: "Proposed corrected value ONLY if decision is 'corrected'. Otherwise MUST be null or empty string.",
                },
                evidence: {
                  type: "STRING",
                  description: "Mandatory visual proof from the image supporting this decision (e.g. 'Kolom Ruang baris 3 tertulis D.302')",
                },
                reason: {
                  type: "STRING",
                  description: "Human-readable explanation of why this was confirmed, corrected, or flagged",
                },
                confidence: {
                  type: "NUMBER",
                  description: "Confidence in this verification decision between 0 and 100",
                },
              },
              required: ["field", "decision"],
            },
          },
        },
        required: ["id", "findings"],
      },
    },
    missedRows: {
      type: "ARRAY",
      description: "ONLY rows from the timetable image that were completely omitted from candidate items. MUST contain direct visualEvidence citing row/text.",
      items: {
        type: "OBJECT",
        properties: {
          namaMatkul: { type: "STRING" },
          hari: { type: "STRING" },
          waktuMulai: { type: "STRING" },
          waktuSelesai: { type: "STRING" },
          lokasi: { type: "STRING" },
          kodeMatkul: { type: "STRING" },
          kelas: { type: "STRING" },
          sks: { type: "NUMBER" },
          dosen: { type: "STRING" },
          visualEvidence: {
            type: "STRING",
            description: "Direct visual proof from the image that this physical timetable row exists and was missed",
          },
          reason: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["namaMatkul", "visualEvidence", "reason"],
      },
    },
    proposedRemovals: {
      type: "ARRAY",
      description: "Candidate items that do NOT correspond to any real course row in the image (e.g. noise, duplicate rows, or table headers)",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          reason: { type: "STRING" },
          visualEvidence: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["id", "reason"],
      },
    },
  },
  required: ["verifiedItems"],
};

const SCHEDULE_VERIFICATION_PROMPT = `
You are an expert academic timetable verification specialist.
You are given:
1. The original university timetable image.
2. A list of candidate schedule items previously extracted or edited by the user.

CORE VERIFICATION PRINCIPLES (PHASE 6.1):
1. CORRECTION FIRST (NO OVER-GENERATION):
   - Your primary mission is to verify and correct existing candidate items by their exact 'id'.
   - Evaluate every candidate field: namaMatkul, hari, waktuMulai, waktuSelesai, lokasi, sks, dosen, kodeMatkul, kelas.
   - If a candidate field is empty or missing (e.g. kodeMatkul: "") but clearly visible in the document table, propose decision: "corrected" with the proposedValue from the image and cite evidence.
   - Do NOT replace candidate items with an entirely new schedule list.
2. NEVER INVENT VALUES FOR BLANK OR UNREADABLE CELLS:
   - If a cell is blank in the source document (e.g. online class without physical room, or no lecturer name printed), mark decision: "missing". NEVER invent or fabricate placeholders like "Online", "TBA", or dummy names.
   - If a cell is physically blurry, degraded, or unreadable, mark decision: "unreadable" or "uncertain". NEVER guess numbers, course codes, or times.
3. SOURCE ROW & CELL EVIDENCE:
   - Every correction MUST provide 'evidence' citing the visual row and column location in the document (e.g., "Kolom Ruang baris 3 menunjukkan teks 'D.302 VA'").
4. MISSED ROWS REQUIRE DIRECT VISUAL EVIDENCE:
   - NEVER add a new schedule record without direct visual evidence that an actual timetable row was missed.
   - If and only if a distinct physical timetable row is clearly visible in the image but completely absent from the candidate items, populate 'missedRows' with mandatory 'visualEvidence' citing the verbatim row text and position.
   - If unsure or ambiguous, DO NOT add a row.
5. PROPOSED REMOVALS:
   - If a candidate item is a false positive (e.g. a table header row or page footer misread as a class), report its 'id' in 'proposedRemovals' with reason and visualEvidence.
6. INSUFFICIENT EVIDENCE:
   - If the visual evidence is insufficient or confidence is below 75%, keep the original candidate value and mark decision: "uncertain" rather than making an unverified change.
7. ACCURATE FIELDS:
   - If the candidate value correctly matches what is visible in the document, mark decision: "confirmed". Do NOT mark a field as 'corrected' if the candidate value is already identical to the value in the document.
`.trim();

/**
 * Gemini REST API Vision Provider implementation (no heavy external SDK required).
 */
export class GeminiVisionProvider implements ScheduleVisionProvider {
  name = "gemini";
  private config: VisionProviderConfig;

  constructor(config?: Partial<VisionProviderConfig>) {
    this.config = { ...getVisionProviderConfig(), ...config };
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  async extractSchedule(
    imageBuffer: Buffer,
    mimeType: string,
    options?: { signal?: AbortSignal }
  ): Promise<VisionExtractionResult> {
    if (!this.isAvailable()) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi pada server. Fitur vision fallback belum aktif.");
    }

    const t0 = Date.now();
    const base64Data = imageBuffer.toString("base64");
    const model = this.config.modelId || "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(this.config.apiKey!)}`;

    let normalizedMime = (mimeType || "image/jpeg").toLowerCase();
    if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: base64Data,
              },
            },
            {
              text: SCHEDULE_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEDULE_RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    };

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= this.config.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const combinedSignal = options?.signal
          ? anySignal([options.signal, controller.signal])
          : controller.signal;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const status = res.status;
          let errorDetail = "";
          try {
            const errJson = await res.json();
            errorDetail = errJson?.error?.message || "";
          } catch {
            errorDetail = await res.text().catch(() => "");
          }

          if (status === 429) {
            throw new Error("Kuota API vision Gemini sedang mencapai batas (HTTP 429). Silakan coba lagi beberapa saat.");
          }
          if (status === 401 || status === 403) {
            throw new Error("Otorisasi API vision gagal (Invalid GEMINI_API_KEY).");
          }
          if (status === 404) {
            throw new Error(`Model vision '${model}' tidak ditemukan atau tidak tersedia (HTTP 404). Periksa konfigurasi GEMINI_MODEL_ID.`);
          }
          throw new Error(`Provider vision mengembalikan error HTTP ${status}: ${errorDetail.slice(0, 150)}`);
        }

        const data = await res.json();
        const durationMs = Date.now() - t0;
        const candidate = data?.candidates?.[0];
        const contentText = candidate?.content?.parts?.[0]?.text;

        if (!contentText) {
          throw new Error("Respons provider vision kosong atau tidak memuat bagian teks.");
        }

        let parsedJson: any;
        try {
          parsedJson = JSON.parse(contentText);
        } catch {
          throw new Error("Format keluaran JSON provider vision tidak valid.");
        }

        const rawItems = Array.isArray(parsedJson?.items) ? parsedJson.items : [];
        const rows: VisionScheduleRow[] = rawItems.map((it: any) => ({
          hari: typeof it.hari === "string" && it.hari.trim() ? it.hari.trim() : null,
          waktuMulai: typeof it.waktuMulai === "string" && it.waktuMulai.trim() ? it.waktuMulai.trim() : null,
          waktuSelesai: typeof it.waktuSelesai === "string" && it.waktuSelesai.trim() ? it.waktuSelesai.trim() : null,
          kodeMatkul: typeof it.kodeMatkul === "string" && it.kodeMatkul.trim() ? it.kodeMatkul.trim() : null,
          namaMatkul: typeof it.namaMatkul === "string" && it.namaMatkul.trim() ? it.namaMatkul.trim() : null,
          kelas: typeof it.kelas === "string" && it.kelas.trim() ? it.kelas.trim() : null,
          lokasi: typeof it.lokasi === "string" && it.lokasi.trim() ? it.lokasi.trim() : null,
          sks: typeof it.sks === "number" && !isNaN(it.sks) ? it.sks : null,
          dosen: typeof it.dosen === "string" && it.dosen.trim() ? it.dosen.trim() : null,
          confidenceEstimate: typeof it.confidenceEstimate === "number" ? it.confidenceEstimate : null,
          ambiguousFieldsReason: typeof it.ambiguousFieldsReason === "string" ? it.ambiguousFieldsReason : null,
          fieldConfidence: it.fieldConfidence && typeof it.fieldConfidence === "object" ? it.fieldConfidence : undefined,
          fieldStatuses: it.fieldStatuses && typeof it.fieldStatuses === "object" ? it.fieldStatuses : undefined,
          rawFields: it.rawFields && typeof it.rawFields === "object" ? it.rawFields : undefined,
        }));

        return {
          provider: "gemini",
          model,
          layoutKind: parsedJson?.layout,
          rows,
          durationMs,
          usage: data?.usageMetadata
            ? {
                promptTokens: data.usageMetadata.promptTokenCount,
                completionTokens: data.usageMetadata.candidatesTokenCount,
                totalTokens: data.usageMetadata.totalTokenCount,
              }
            : undefined,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        if (err.name === "AbortError") {
          lastError = new Error(`Pemanggilan API vision melebihi batas waktu (${this.config.timeoutMs}ms).`);
        }
        if (attempt <= this.config.maxRetries && !isNonRetryableError(lastError)) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
        break;
      }
    }

    throw lastError || new Error("Gagal mengekstrak jadwal via vision provider.");
  }

  async verifySchedule(
    imageBuffer: Buffer,
    mimeType: string,
    candidateItems: any[],
    options?: { signal?: AbortSignal }
  ): Promise<ScheduleVerificationResult> {
    if (!this.isAvailable()) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi pada server. Fitur verifikasi AI belum aktif.");
    }

    const t0 = Date.now();
    const base64Data = imageBuffer.toString("base64");
    const model = this.config.modelId || "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(this.config.apiKey!)}`;

    let normalizedMime = (mimeType || "image/jpeg").toLowerCase();
    if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";

    const candidatePayload = candidateItems.map((it, idx) => ({
      id: String(it.id || `item_${idx + 1}`),
      namaMatkul: it.namaMatkul ?? it.nama_matkul ?? "",
      hari: it.hari ?? "",
      waktuMulai: it.waktuMulai ?? it.waktu_mulai ?? "",
      waktuSelesai: it.waktuSelesai ?? it.waktu_selesai ?? "",
      lokasi: it.lokasi ?? it.ruang ?? "",
      sks: it.sks ?? null,
      dosen: it.dosen ?? "",
      kodeMatkul: it.kodeMatkul ?? it.kode_matkul ?? "",
      kelas: it.kelas ?? "",
    }));

    const verificationPrompt = `${SCHEDULE_VERIFICATION_PROMPT}\n\nCANDIDATE SCHEDULE ITEMS TO VERIFY:\n${JSON.stringify(
      candidatePayload,
      null,
      2
    )}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: base64Data,
              },
            },
            {
              text: verificationPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: VERIFY_RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    };

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= this.config.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const combinedSignal = options?.signal
          ? anySignal([options.signal, controller.signal])
          : controller.signal;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const status = res.status;
          let errorDetail = "";
          try {
            const errJson = await res.json();
            errorDetail = errJson?.error?.message || "";
          } catch {
            errorDetail = await res.text().catch(() => "");
          }

          if (status === 429) {
            throw new Error("Kuota API vision Gemini sedang mencapai batas (HTTP 429). Silakan coba lagi beberapa saat.");
          }
          if (status === 401 || status === 403) {
            throw new Error("Otorisasi API vision gagal (Invalid GEMINI_API_KEY).");
          }
          if (status === 404) {
            throw new Error(`Model vision '${model}' tidak ditemukan atau tidak tersedia (HTTP 404).`);
          }
          throw new Error(`Provider verifikasi mengembalikan error HTTP ${status}: ${errorDetail.slice(0, 150)}`);
        }

        const data = await res.json();
        const durationMs = Date.now() - t0;
        const candidate = data?.candidates?.[0];
        const contentText = candidate?.content?.parts?.[0]?.text;

        if (!contentText) {
          throw new Error("Respons provider verifikasi kosong atau tidak memuat bagian teks.");
        }

        let parsedJson: any;
        try {
          parsedJson = JSON.parse(contentText);
        } catch {
          throw new Error("Format keluaran JSON provider verifikasi tidak valid.");
        }

        const rawVerified = Array.isArray(parsedJson?.verifiedItems) ? parsedJson.verifiedItems : [];
        let confirmedCount = 0;
        let correctedCount = 0;
        let uncertainCount = 0;

        const verifiedItems: VerifiedScheduleItem[] = rawVerified.map((vi: any) => {
          const findingsMap: Record<string, VisionFieldVerification> = {};
          const findingsList = Array.isArray(vi.findings) ? vi.findings : [];
          const candidate = candidateItems.find((c) => String(c.id || "") === String(vi.id || ""));

          for (const f of findingsList) {
            if (!f.field) continue;
            let dec = (f.decision || "confirmed").toLowerCase();
            let proposedVal = f.proposedValue;
            const evidence = typeof f.evidence === "string" ? f.evidence.trim() : "";
            const origVal = candidate
              ? candidate[f.field] ?? candidate[f.field === "namaMatkul" ? "nama_matkul" : f.field]
              : undefined;

            // Invariant: A correction counts as successful only when the proposed value genuinely fixes
            // a known incorrect/missing field. If the proposed value is identical to the candidate value,
            // it is a confirmation, not a correction.
            if (dec === "corrected") {
              const origStr = origVal !== undefined && origVal !== null ? String(origVal).trim().toLowerCase() : "";
              const propStr = proposedVal !== undefined && proposedVal !== null ? String(proposedVal).trim().toLowerCase() : "";
              if (origStr.length > 0 && origStr === propStr) {
                dec = "confirmed";
                proposedVal = undefined;
              }
            }

            // Rule 2 & 8: Never invent values for blank or unreadable cells; insufficient evidence = uncertain
            if (dec === "missing") {
              proposedVal = null;
            } else if (dec === "unreadable" || dec === "uncertain") {
              proposedVal = undefined;
            } else if (dec === "corrected") {
              // If evidence is missing or invalid, revert to uncertain rather than guessing
              const evidenceCheck = isValidVisualEvidence(evidence);
              if (!evidenceCheck.valid) {
                dec = "uncertain";
                proposedVal = undefined;
              }
            }

            if (dec === "corrected") correctedCount++;
            else if (dec === "confirmed") confirmedCount++;
            else uncertainCount++;

            findingsMap[f.field] = {
              field: f.field,
              decision: dec,
              proposedValue: proposedVal,
              evidence: evidence || undefined,
              reason: f.reason,
              confidence: typeof f.confidence === "number" ? f.confidence : undefined,
            };
          }

          return {
            id: String(vi.id || ""),
            overallStatus:
              vi.overallStatus ||
              (Object.values(findingsMap).some((f) => f.decision === "corrected")
                ? "has_corrections"
                : "confirmed"),
            findings: findingsMap,
          };
        });

        // Rule 4: Process legitimately missed rows - MUST have direct visualEvidence citing document
        const proposedAddedRows: ProposedAddedRow[] = [];
        if (Array.isArray(parsedJson?.missedRows)) {
          for (let mIdx = 0; mIdx < parsedJson.missedRows.length; mIdx++) {
            const mr = parsedJson.missedRows[mIdx];
            if (!mr || typeof mr !== "object") continue;
            const courseName = typeof mr.namaMatkul === "string" ? mr.namaMatkul.trim() : "";
            const vEvidence = typeof mr.visualEvidence === "string" ? mr.visualEvidence.trim() : "";

            // Filter out any proposed row without course name or substantive direct visual proof
            const evidenceCheck = isValidVisualEvidence(vEvidence);
            if (!courseName || !evidenceCheck.valid) {
              continue;
            }

            proposedAddedRows.push({
              tempId: `added_missed_${Date.now()}_${mIdx}`,
              namaMatkul: courseName,
              hari: typeof mr.hari === "string" ? mr.hari.trim() : undefined,
              waktuMulai: typeof mr.waktuMulai === "string" ? mr.waktuMulai.trim() : undefined,
              waktuSelesai: typeof mr.waktuSelesai === "string" ? mr.waktuSelesai.trim() : undefined,
              lokasi: typeof mr.lokasi === "string" ? mr.lokasi.trim() : undefined,
              kodeMatkul: typeof mr.kodeMatkul === "string" ? mr.kodeMatkul.trim() : undefined,
              kelas: typeof mr.kelas === "string" ? mr.kelas.trim() : undefined,
              sks: typeof mr.sks === "number" && !isNaN(mr.sks) ? mr.sks : undefined,
              dosen: typeof mr.dosen === "string" ? mr.dosen.trim() : undefined,
              visualEvidence: vEvidence,
              reason: mr.reason || "Baris terlewat pada tabel dokumen asli.",
              confidence: typeof mr.confidence === "number" ? mr.confidence : 80,
            });
          }
        }

        // Process proposed removals of phantom / duplicate candidate items
        const proposedRemovedRows: ProposedRemovedRow[] = [];
        if (Array.isArray(parsedJson?.proposedRemovals)) {
          for (const pr of parsedJson.proposedRemovals) {
            if (!pr?.id) continue;
            const targetId = String(pr.id);
            if (!candidateItems.some((c) => String(c.id) === targetId)) continue;

            proposedRemovedRows.push({
              itemId: targetId,
              reason: pr.reason || "Baris tidak terbukti ada pada tabel dokumen asli.",
              visualEvidence: pr.visualEvidence,
              confidence: typeof pr.confidence === "number" ? pr.confidence : 85,
            });
          }
        }

        // Rule 5 & 6: Compute before/after diff summary
        const modifiedFields: Array<{
          itemId: string;
          field: string;
          before: any;
          after: any;
          evidence?: string;
          reason?: string;
          confidence?: number;
        }> = [];

        for (const vi of verifiedItems) {
          const candidate = candidateItems.find((c) => String(c.id) === String(vi.id));
          for (const [fKey, finding] of Object.entries(vi.findings)) {
            if (finding.decision === "corrected" && finding.proposedValue !== undefined) {
              const origVal = candidate ? candidate[fKey] : undefined;
              if (finding.proposedValue !== origVal) {
                modifiedFields.push({
                  itemId: vi.id,
                  field: fKey,
                  before: origVal,
                  after: finding.proposedValue,
                  evidence: finding.evidence,
                  reason: finding.reason,
                  confidence: finding.confidence,
                });
              }
            }
          }
        }

        const diff: VerificationDiffSummary = {
          originalRowCount: candidateItems.length,
          proposedRowCount: candidateItems.length + proposedAddedRows.length - proposedRemovedRows.length,
          addedRowsCount: proposedAddedRows.length,
          removedRowsCount: proposedRemovedRows.length,
          modifiedFieldsCount: modifiedFields.length,
          addedRows: proposedAddedRows,
          removedRows: proposedRemovedRows,
          modifiedFields,
        };

        return {
          provider: "gemini",
          model,
          verifiedItems,
          proposedAddedRows,
          proposedRemovedRows,
          diff,
          summary: {
            totalChecked: candidateItems.length,
            confirmedCount,
            correctedCount,
            uncertainCount,
            addedRowsCount: proposedAddedRows.length,
            removedRowsCount: proposedRemovedRows.length,
          },
          durationMs,
          usage: data?.usageMetadata
            ? {
                promptTokens: data.usageMetadata.promptTokenCount,
                completionTokens: data.usageMetadata.candidatesTokenCount,
                totalTokens: data.usageMetadata.totalTokenCount,
              }
            : undefined,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        if (err.name === "AbortError") {
          lastError = new Error(`Pemanggilan API verifikasi melebihi batas waktu (${this.config.timeoutMs}ms).`);
        }
        if (attempt <= this.config.maxRetries && !isNonRetryableError(lastError)) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
        break;
      }
    }

    throw lastError || new Error("Gagal memverifikasi jadwal via vision provider.");
  }
}

/**
 * Mock vision provider for deterministic unit & integration tests without network API calls.
 */
export class MockVisionProvider implements ScheduleVisionProvider {
  name = "mock";
  private mockRows: VisionScheduleRow[];
  private mockVerification: Partial<ScheduleVerificationResult> | null = null;
  private shouldFail = false;
  private failMessage = "";

  constructor(mockRows: VisionScheduleRow[] = []) {
    this.mockRows = mockRows;
  }

  setMockRows(rows: VisionScheduleRow[]) {
    this.mockRows = rows;
  }

  setMockVerification(res: Partial<ScheduleVerificationResult> | null) {
    this.mockVerification = res;
  }

  setFailure(fail: boolean, msg = "Mock Vision Provider Error") {
    this.shouldFail = fail;
    this.failMessage = msg;
  }

  isAvailable(): boolean {
    return true;
  }

  async extractSchedule(): Promise<VisionExtractionResult> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }
    return {
      provider: "mock",
      model: "mock-vision-v1",
      layoutKind: "unas_8col_table",
      rows: this.mockRows,
      durationMs: 15,
      usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
    };
  }

  async verifySchedule(
    imageBuffer: Buffer,
    mimeType: string,
    candidateItems: any[]
  ): Promise<ScheduleVerificationResult> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }
    if (this.mockVerification) {
      const vItems = (this.mockVerification.verifiedItems as any) || [];
      const addedRows = this.mockVerification.proposedAddedRows || [];
      const removedRows = this.mockVerification.proposedRemovedRows || [];
      const modifiedFields: Array<{
        itemId: string;
        field: string;
        before: any;
        after: any;
        evidence?: string;
        reason?: string;
        confidence?: number;
      }> = [];

      for (const vi of vItems) {
        const candidate = candidateItems.find((c) => String(c.id) === String(vi.id));
        for (const [fKey, finding] of Object.entries(vi.findings || {})) {
          const f = finding as VisionFieldVerification;
          if (f.decision === "corrected" && f.proposedValue !== undefined) {
            const origVal = candidate ? candidate[fKey] : undefined;
            if (f.proposedValue !== origVal) {
              modifiedFields.push({
                itemId: vi.id,
                field: fKey,
                before: origVal,
                after: f.proposedValue,
                evidence: f.evidence,
                reason: f.reason,
                confidence: f.confidence,
              });
            }
          }
        }
      }

      const diff: VerificationDiffSummary = this.mockVerification.diff || {
        originalRowCount: candidateItems.length,
        proposedRowCount: candidateItems.length + addedRows.length - removedRows.length,
        addedRowsCount: addedRows.length,
        removedRowsCount: removedRows.length,
        modifiedFieldsCount: modifiedFields.length,
        addedRows,
        removedRows,
        modifiedFields,
      };

      const s = this.mockVerification.summary || {
        totalChecked: candidateItems.length,
        confirmedCount: candidateItems.length,
        correctedCount: 0,
        uncertainCount: 0,
      };

      return {
        provider: "mock",
        model: "mock-vision-v1",
        verifiedItems: vItems,
        proposedAddedRows: addedRows,
        proposedRemovedRows: removedRows,
        diff,
        summary: {
          totalChecked: s.totalChecked ?? candidateItems.length,
          confirmedCount: s.confirmedCount ?? candidateItems.length,
          correctedCount: s.correctedCount ?? 0,
          uncertainCount: s.uncertainCount ?? 0,
          addedRowsCount: addedRows.length,
          removedRowsCount: removedRows.length,
        },
        durationMs: 15,
      };
    }

    // Default intelligent mock verification:
    // Identifies suspicious times or course names and provides proposed corrections
    const verifiedItems: VerifiedScheduleItem[] = candidateItems.map((item, idx) => {
      const findings: Record<string, VisionFieldVerification> = {};
      let hasCorrections = false;

      // Check for suspicious start time (e.g. 09:00 vs 09:50 in UNAS timetable)
      if (
        item.waktuMulai === "09:00" &&
        (item.rawText?.includes("09:50") || item.tentativeSuggestions?.waktuMulai === "09:50")
      ) {
        findings.waktuMulai = {
          field: "waktuMulai",
          originalValue: item.waktuMulai,
          decision: "corrected",
          proposedValue: "09:50",
          evidence: "Kolom Mulai baris ini tertulis '09:50:00'",
          reason: "Angka 5 pada menit terbaca jelas pada baris tabel",
          confidence: 96,
        };
        hasCorrections = true;
      } else if (item.waktuMulai) {
        findings.waktuMulai = {
          field: "waktuMulai",
          originalValue: item.waktuMulai,
          decision: "confirmed",
          confidence: 95,
        };
      }

      // Check for abbreviated course names
      if (item.namaMatkul) {
        if (item.namaMatkul.includes("Tek.")) {
          findings.namaMatkul = {
            field: "namaMatkul",
            originalValue: item.namaMatkul,
            decision: "corrected",
            proposedValue: item.namaMatkul.replace("Tek.", "Teknologi Informasi"),
            evidence: "Teks lengkap dokumen: Etika Profesi Teknologi Informasi",
            reason: "Singkatan 'Tek.' diekspansi sesuai teks lengkap dokumen",
            confidence: 94,
          };
          hasCorrections = true;
        } else {
          findings.namaMatkul = {
            field: "namaMatkul",
            originalValue: item.namaMatkul,
            decision: "confirmed",
            confidence: 98,
          };
        }
      }

      if (item.hari) {
        findings.hari = {
          field: "hari",
          originalValue: item.hari,
          decision: "confirmed",
          confidence: 99,
        };
      }

      // Check for empty room cell that is visible
      if (!item.lokasi && item.rawText?.includes("D.302")) {
        findings.lokasi = {
          field: "lokasi",
          originalValue: null,
          decision: "corrected",
          proposedValue: "D.302 VA",
          evidence: "Kolom Ruang memuat teks 'D.302 VA'",
          reason: "Ruang kuliah ditemukan pada tabel sumber",
          confidence: 92,
        };
        hasCorrections = true;
      }

      // Rule 2: Genuinely empty cell without text in raw document remains missing / null (no invention!)
      if (!item.dosen && !item.rawText?.includes("Dosen:")) {
        findings.dosen = {
          field: "dosen",
          originalValue: null,
          decision: "missing",
          proposedValue: null,
          evidence: "Kolom Dosen tidak memuat nama (kosong pada jadwal)",
          reason: "Tidak ada data dosen pada sel tabel",
          confidence: 90,
        };
      }

      return {
        id: item.id || `item_${idx + 1}`,
        overallStatus: hasCorrections ? "has_corrections" : "confirmed",
        findings,
      };
    });

    const proposedAddedRows: ProposedAddedRow[] = [];
    // Only add a missed row if candidateItems specifically has MISSED_ROW_DEMO in rawText and valid visualEvidence
    const missedRowTrigger = candidateItems.find((it) => it.rawText?.includes("MISSED_ROW_DEMO"));
    if (missedRowTrigger) {
      proposedAddedRows.push({
        tempId: "mock_added_1",
        namaMatkul: "Sistem Terdistribusi",
        hari: "Rabu",
        waktuMulai: "13:00",
        waktuSelesai: "15:30",
        lokasi: "Lab Komputer 2",
        visualEvidence: "Baris ke-4 tabel: 'Rabu 13:00 - 15:30 Sistem Terdistribusi'",
        reason: "Mata kuliah terlihat jelas pada baris ke-4 tabel tetapi belum ada di daftar kandidat.",
        confidence: 95,
      });
    }

    const proposedRemovedRows: ProposedRemovedRow[] = [];
    const duplicateRowTrigger = candidateItems.find((it) => it.rawText?.includes("PHANTOM_ROW_DEMO"));
    if (duplicateRowTrigger) {
      proposedRemovedRows.push({
        itemId: String(duplicateRowTrigger.id),
        reason: "Baris ini adalah catatan footer jadwal, bukan mata kuliah aktif.",
        visualEvidence: "Teks berada di area catatan kaki / footer dokumen.",
        confidence: 90,
      });
    }

    const modifiedFields: Array<{
      itemId: string;
      field: string;
      before: any;
      after: any;
      evidence?: string;
      reason?: string;
      confidence?: number;
    }> = [];

    for (const vi of verifiedItems) {
      const candidate = candidateItems.find((c) => String(c.id) === String(vi.id));
      for (const [fKey, finding] of Object.entries(vi.findings)) {
        if (finding.decision === "corrected" && finding.proposedValue !== undefined) {
          const origVal = candidate ? candidate[fKey] : undefined;
          if (finding.proposedValue !== origVal) {
            modifiedFields.push({
              itemId: vi.id,
              field: fKey,
              before: origVal,
              after: finding.proposedValue,
              evidence: finding.evidence,
              reason: finding.reason,
              confidence: finding.confidence,
            });
          }
        }
      }
    }

    const diff: VerificationDiffSummary = {
      originalRowCount: candidateItems.length,
      proposedRowCount: candidateItems.length + proposedAddedRows.length - proposedRemovedRows.length,
      addedRowsCount: proposedAddedRows.length,
      removedRowsCount: proposedRemovedRows.length,
      modifiedFieldsCount: modifiedFields.length,
      addedRows: proposedAddedRows,
      removedRows: proposedRemovedRows,
      modifiedFields,
    };

    const correctedCount = verifiedItems.filter((i) => i.overallStatus === "has_corrections").length;
    return {
      provider: "mock",
      model: "mock-vision-v1",
      verifiedItems,
      proposedAddedRows,
      proposedRemovedRows,
      diff,
      summary: {
        totalChecked: candidateItems.length,
        confirmedCount: candidateItems.length - correctedCount,
        correctedCount,
        uncertainCount: 0,
        addedRowsCount: proposedAddedRows.length,
        removedRowsCount: proposedRemovedRows.length,
      },
      durationMs: 20,
    };
  }
}

/**
 * Factory to retrieve the active vision provider.
 */
let activeProviderOverride: ScheduleVisionProvider | null = null;

export function setVisionProviderOverride(provider: ScheduleVisionProvider | null) {
  activeProviderOverride = provider;
}

export function getVisionProvider(): ScheduleVisionProvider {
  if (activeProviderOverride) {
    return activeProviderOverride;
  }
  const config = getVisionProviderConfig();
  if (config.providerName === "mock") {
    return new MockVisionProvider();
  }
  return new GeminiVisionProvider(config);
}

function isNonRetryableError(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("tidak dikonfigurasi") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("404") ||
    msg.includes("tidak ditemukan") ||
    msg.includes("otorisasi") ||
    msg.includes("abort") ||
    msg.includes("batas waktu") ||
    msg.includes("timeout")
  );
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      return controller.signal;
    }
    sig.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}


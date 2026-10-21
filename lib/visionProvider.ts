/**
 * Server-only Vision Provider Abstraction for Hybrid Schedule Recognition.
 * Supports configurable providers (Gemini REST API, mock/offline testing provider, custom compatible endpoints).
 * NEVER exposes API keys to client-side bundles, logs, or responses.
 */

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
  confidenceEstimate?: number | null;
  ambiguousFieldsReason?: string | null;
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
 * Strict JSON schema for Structured Outputs with Gemini API.
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
            description: "Brief explanation if any cell text was unclear or partially obscured.",
          },
          confidenceEstimate: {
            type: "NUMBER",
            description: "Uncalibrated visual clarity estimate between 0 and 100 for this row.",
          },
        },
        required: ["hari", "waktuMulai", "waktuSelesai", "namaMatkul"],
      },
    },
  },
  required: ["items"],
};

const SCHEDULE_EXTRACTION_PROMPT = `
You are an expert academic timetable document extractor.
Examine this university timetable image (or screenshot). Extract EVERY visible schedule row into the specified structured JSON format.

CRITICAL RULES:
1. NEVER invent, guess, or hallucinate missing courses, weekdays, times, or credit units (SKS). If absent, use null or empty string.
2. For combined time cells (e.g., "08:00 - 10:30" or "13:00 s/d 14:40"), separate them into waktuMulai (08:00) and waktuSelesai (10:30).
3. If an 8-column table (like SIAKAD UNAS) contains: Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS, extract each column to its matching property accurately.
4. If a course or room name wraps onto multiple lines (e.g. "Lab. Data" / "Science" or "Rekayasa Perangkat Lunak" / "Informatika"), combine them into one continuous string.
5. If text is blurry or ambiguous, preserve original characters and specify ambiguousFieldsReason.
6. Do not infer a field from an unrelated row.
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
}

/**
 * Mock vision provider for deterministic unit & integration tests without network API calls.
 */
export class MockVisionProvider implements ScheduleVisionProvider {
  name = "mock";
  private mockRows: VisionScheduleRow[];
  private shouldFail = false;
  private failMessage = "";

  constructor(mockRows: VisionScheduleRow[] = []) {
    this.mockRows = mockRows;
  }

  setMockRows(rows: VisionScheduleRow[]) {
    this.mockRows = rows;
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


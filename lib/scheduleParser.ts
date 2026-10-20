import path from "path";
import os from "os";
import { createRequire } from "module";

const nodeRequire = createRequire(import.meta.url);

function formatTimeFromDate(dateInput?: Date | string | null, fallback = "00:00"): string {
  if (!dateInput) return fallback;
  if (typeof dateInput === "string") {
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(dateInput.trim())) {
      const parts = dateInput.trim().split(":");
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
  }
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return fallback;
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export interface OcrBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence?: number;
  bbox: OcrBoundingBox;
}

export interface OcrExtractionResult {
  text: string;
  words: OcrWord[];
  confidence: number | null;
}

export type MappingFieldType =
  | "kodeMatkul"
  | "namaMatkul"
  | "lokasi"
  | "hari"
  | "kelas"
  | "courseByCode";

export interface UserScheduleMapping {
  id: string;
  field: MappingFieldType;
  /** Normalized lookup key (e.g. raw OCR token or confirmed course code) */
  sourceKey: string;
  /** User-confirmed target value */
  targetValue: string;
  /** Optional contextual metadata for courseByCode and Phase 7B conflict/rejection guard */
  metadata?: {
    namaMatkul?: string;
    lokasi?: string;
    sks?: number;
    kelas?: string;
    contextQualifier?: string;
    isAmbiguous?: boolean;
    alternateTargets?: string[];
    hasConflict?: boolean;
    revertedByTarget?: string;
    isUserDisabled?: boolean;
    usageCount?: number;
    lastUsedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type FieldConfidenceLevel = "confirmed" | "high" | "medium" | "low";

export type FieldConfidenceSource =
  | "user_mapping"
  | "header_aligned_ocr"
  | "pattern_match"
  | "ocr_normalized"
  | "fallback_inferred"
  | "missing";

export type ScheduleFieldKey =
  | "hari"
  | "waktuMulai"
  | "waktuSelesai"
  | "kodeMatkul"
  | "namaMatkul"
  | "kelas"
  | "lokasi"
  | "sks"
  | "dosen";

export interface FieldConfidenceInfo {
  level: FieldConfidenceLevel;
  source: FieldConfidenceSource;
  ocrConfidence?: number | null;
  needsReview: boolean;
  reviewReason?: string;
  tentativeSuggestion?: string;
}

export type ScheduleLayoutKind =
  | "unas_8col_table"
  | "combined_time_table"
  | "simple_schedule_table"
  | "traditional_krs_text"
  | "unstructured_fallback";

export interface LayoutDetectionResult {
  kind: ScheduleLayoutKind;
  label: string;
  hasRecognizedHeaders: boolean;
  detectedColumns: string[];
  limitationReason?: string;
}

export interface ParsedScheduleItem {
  id: string; // temporary client key
  namaMatkul: string;
  nama_matkul?: string; // iOS snake_case compatibility
  hari: string;
  waktuMulai: string;
  waktu_mulai?: string; // iOS snake_case compatibility
  waktuSelesai: string;
  waktu_selesai?: string; // iOS snake_case compatibility
  dosen: string | null;
  kategori: string | null;
  lokasi: string | null;
  sks: number | null;
  kodeMatkul?: string | null;
  kode_matkul?: string | null; // iOS snake_case compatibility
  kelas?: string | null;
  rawText?: string;
  rawFields?: Record<string, string>;
  appliedCorrections?: string[];
  tentativeSuggestions?: Record<string, string>;
  fieldConfidence?: Partial<Record<ScheduleFieldKey, FieldConfidenceInfo>>;
  recognitionStatus?: "confirmed_assisted" | "high_confidence" | "needs_review";
  layoutKind?: ScheduleLayoutKind;
  extractionSource?: "local_ocr" | "pdf_stream" | "vision_fallback" | "hybrid_merged";
  needsReview: boolean;
  warnings: string[];
}

export interface ScheduleRecognitionResult {
  layout: LayoutDetectionResult;
  items: ParsedScheduleItem[];
  insufficientForProduction?: boolean;
  insufficiencyReasons?: string[];
}

export interface ExistingSchedule {
  id: number;
  namaMatkul: string;
  hari: string;
  waktuMulai: Date;
  waktuSelesai: Date;
}

const HARI_ALIASES: Record<string, string> = {
  senin: "Senin",
  sen1n: "Senin",
  senln: "Senin",
  sehin: "Senin",
  seh1n: "Senin",
  snn: "Senin",
  mon: "Senin",
  monday: "Senin",
  selasa: "Selasa",
  se1asa: "Selasa",
  selas4: "Selasa",
  seiasa: "Selasa",
  sls: "Selasa",
  tue: "Selasa",
  tuesday: "Selasa",
  rabu: "Rabu",
  r4bu: "Rabu",
  rab0: "Rabu",
  rabo: "Rabu",
  wed: "Rabu",
  wednesday: "Rabu",
  kamis: "Kamis",
  kam1s: "Kamis",
  kamls: "Kamis",
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
  sabt0: "Sabtu",
  sabto: "Sabtu",
  sbt: "Sabtu",
  sat: "Sabtu",
  saturday: "Sabtu",
  minggu: "Minggu",
  m1nggu: "Minggu",
  mlnggu: "Minggu",
  mgg: "Minggu",
  ahad: "Minggu",
  sun: "Minggu",
  sunday: "Minggu",
};

export function normalizeMappingKey(str: string): string {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Computes character-level Sorensen-Dice bigram similarity (0..1) for conservative fuzzy matching.
 */
export function computeTextSimilarity(a: string, b: string): number {
  const s1 = normalizeMappingKey(a);
  const s2 = normalizeMappingKey(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (s1.length - 1 + (s2.length - 1));
}

/**
 * Normalizes day name to Indonesian standard capitalization, supporting deterministic OCR aliases
 * and optional user-confirmed mappings.
 */
export function normalizeHari(raw: string, userMappings: UserScheduleMapping[] = []): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check user mappings first
  const key = normalizeMappingKey(trimmed);
  for (const m of userMappings) {
    if (m.field === "hari" && normalizeMappingKey(m.sourceKey) === key) {
      if (HARI_ALIASES[normalizeMappingKey(m.targetValue)]) {
        return HARI_ALIASES[normalizeMappingKey(m.targetValue)];
      }
    }
  }

  const clean = trimmed.toLowerCase().replace(/[^a-z0-9']/g, "");
  if (HARI_ALIASES[clean]) return HARI_ALIASES[clean];

  // Check alpha-only fallback
  const alphaOnly = trimmed.toLowerCase().replace(/[^a-z']/g, "");
  return HARI_ALIASES[alphaOnly] || null;
}

/**
 * Extracts and cleans time string into HH:mm format.
 * Supports HH:mm, H:mm, HH:mm:ss, HH.mm, HH.mm.ss, and common OCR digit confusions inside time tokens.
 */
export function normalizeTime(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  // Collapse internal spaces around colons/dots (e.g. "09 : 50 : 00" -> "09:50:00")
  const trimmed = raw
    .trim()
    .replace(/\s*([:.])\s*/g, "$1")
    .replace(/^(\d{2})\s+(\d{2})(?:\s+(\d{2}))?$/, "$1:$2:$3")
    .replace(/:$/, "");
  if (!trimmed) return null;

  // Match standard or OCR-confused time strings (e.g. 09:50:00, 09.50, 09:5O:00, l0:40:00)
  // Also support 6-digit HHMM00 where colons were dropped by OCR (e.g. 095000 -> 09:50:00)
  let rawMatch = trimmed.match(
    /^([0-9OQoIl|SBZ]{1,2})[:.,;]([0-9OQoIl|SBZ]{2})(?:[:.,;]?([0-9OQoIl|SBZ]{2}))?$/i
  );
  if (!rawMatch && /^\d{6}$/.test(trimmed) && trimmed.endsWith("00")) {
    rawMatch = [trimmed, trimmed.slice(0, 2), trimmed.slice(2, 4), trimmed.slice(4, 6)];
  }
  if (!rawMatch) return null;

  const repairDigits = (part: string, allowLetterSubstitutions: boolean): string => {
    if (/^\d+$/.test(part)) return part;
    if (!allowLetterSubstitutions) return part;
    return part
      .replace(/[OQo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[Zz]/g, "2")
      .replace(/[Ss]/g, "5")
      .replace(/[B]/g, "8");
  };

  // Only allow OCR letter->digit repair if at least one character in the time token is already a real digit
  const hasRealDigit = /\d/.test(trimmed);
  const hStr = repairDigits(rawMatch[1], hasRealDigit);
  const mStr = repairDigits(rawMatch[2], hasRealDigit);
  const sStr = rawMatch[3] ? repairDigits(rawMatch[3], hasRealDigit) : "00";

  if (!/^\d{1,2}$/.test(hStr) || !/^\d{2}$/.test(mStr) || !/^\d{2}$/.test(sStr)) {
    return null;
  }

  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const seconds = parseInt(sStr, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const KNOWN_COURSE_PREFIXES: Record<string, string> = {
  "1F": "IF",
  LF: "IF",
  "|F": "IF",
  "!F": "IF",
  IF: "IF",
  "7I": "TI",
  T1: "TI",
  TL: "TI",
  "T|": "TI",
  TI: "TI",
  S1: "SI",
  SL: "SI",
  "5I": "SI",
  SI: "SI",
  M1: "MI",
  ML: "MI",
  MI: "MI",
  T5: "TS",
  TS: "TS",
  TE: "TE",
  TM: "TM",
  TK: "TK",
  AK: "AK",
  MN: "MN",
  HK: "HK",
  HI: "HI",
  IK: "IK",
  BI: "BI",
  FI: "FI",
  KI: "KI",
  MK: "MK",
  MKU: "MKU",
  MKK: "MKK",
};

/**
 * Recognizes and normalizes university course codes (e.g., IF253418, IF253417)
 * while repairing deterministic OCR confusions (e.g. 1F253418 -> IF253418, IF2S34I8 -> IF253418).
 */
export function normalizeCourseCode(
  raw: string,
  userMappings: UserScheduleMapping[] = []
): { code: string; raw: string; wasCorrected: boolean } | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check exact user mapping first
  const key = normalizeMappingKey(trimmed);
  for (const m of userMappings) {
    if (m.field === "kodeMatkul" && normalizeMappingKey(m.sourceKey) === key) {
      return {
        code: m.targetValue.trim().toUpperCase(),
        raw: trimmed,
        wasCorrected: m.targetValue.trim().toUpperCase() !== trimmed,
      };
    }
  }

  // Must not contain dots or slashes (which indicate room codes like D.302 or class R.03)
  if (/[./]/.test(trimmed)) return null;

  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  // Course code pattern: 2-4 prefix chars + 4-8 numeric/confused-numeric chars + optional 1 trailing letter
  const match = compact.match(/^([A-Z10578|!]{2,4})([0-9OQoIl|!SZGB]{4,8})([A-Z])?$/);
  if (!match) return null;

  const [, rawPrefix, rawDigits, trailingLetter] = match;

  // Ensure rawDigits has at least 2 actual digits so normal words like "INFORMASI" aren't matched
  const actualDigitCount = (rawDigits.match(/\d/g) || []).length;
  if (actualDigitCount < 2) return null;

  // Repair prefix
  let cleanPrefix = KNOWN_COURSE_PREFIXES[rawPrefix] || rawPrefix;
  if (!KNOWN_COURSE_PREFIXES[rawPrefix]) {
    cleanPrefix = rawPrefix
      .replace(/1|!|\|/g, "I")
      .replace(/0/g, "O")
      .replace(/5/g, "S")
      .replace(/7/g, "T")
      .replace(/8/g, "B");
  }

  // Must be letters in prefix
  if (!/^[A-Z]{2,4}$/.test(cleanPrefix)) return null;

  // Repair digits in suffix
  const cleanDigits = rawDigits
    .replace(/[OQoD]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Z]/g, "2")
    .replace(/[S]/g, "5")
    .replace(/[G]/g, "6")
    .replace(/[B]/g, "8");

  if (!/^\d{4,8}$/.test(cleanDigits)) return null;

  const finalCode = `${cleanPrefix}${cleanDigits}${trailingLetter || ""}`;
  return {
    code: finalCode,
    raw: trimmed,
    wasCorrected: finalCode !== trimmed,
  };
}

/**
 * Recognizes and normalizes class/section labels such as "R.03", "R.01", "A.02", "R-01".
 */
export function normalizeClassLabel(
  raw: string,
  userMappings: UserScheduleMapping[] = []
): { kelas: string; raw: string; wasCorrected: boolean } | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const key = normalizeMappingKey(trimmed);
  for (const m of userMappings) {
    if (m.field === "kelas" && normalizeMappingKey(m.sourceKey) === key) {
      return {
        kelas: m.targetValue.trim(),
        raw: trimmed,
        wasCorrected: m.targetValue.trim() !== trimmed,
      };
    }
  }

  // Pattern like R.03, R.01, R.O3, R . 01, R,03, A.01, B-02
  const compact = trimmed.replace(/\s+/g, "");
  const match = compact.match(/^([A-Z]{1,2})([.,-])([0-9OQoIl|SZB]{1,3}[A-Z]?)$/i);
  if (match) {
    const prefix = match[1].toUpperCase();
    const sep = match[2] === "," ? "." : match[2];
    const numPart = match[3]
      .toUpperCase()
      .replace(/[OQo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[Z]/g, "2")
      .replace(/[S]/g, "5")
      .replace(/[B]/g, "8");

    if (/^\d{1,3}[A-Z]?$/.test(numPart)) {
      const normalized = `${prefix}${sep}${numPart}`;
      return {
        kelas: normalized,
        raw: trimmed,
        wasCorrected: normalized !== trimmed,
      };
    }
  }

  // Compact class code without dot like R01, R03 (1-2 letters + 2 digits)
  const shortMatch = compact.match(/^([A-Z]{1,2})([0-9OQoIl|]{2})$/i);
  if (shortMatch) {
    const prefix = shortMatch[1].toUpperCase();
    const numPart = shortMatch[2]
      .replace(/[OQo]/g, "0")
      .replace(/[Il|]/g, "1");
    if (/^\d{2}$/.test(numPart)) {
      const normalized = `${prefix}${numPart}`;
      return {
        kelas: normalized,
        raw: trimmed,
        wasCorrected: normalized !== trimmed,
      };
    }
  }

  return null;
}

/**
 * Extracts OcrWord[] with bounding boxes from Tesseract TSV string.
 */
export function parseTsvToWords(tsv: string): OcrWord[] {
  if (!tsv || typeof tsv !== "string") return [];
  const words: OcrWord[] = [];
  const lines = tsv.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 12) continue;
    const level = parseInt(cols[0], 10);
    if (level !== 5) continue; // level 5 is word level in Tesseract TSV

    const left = parseInt(cols[6], 10);
    const top = parseInt(cols[7], 10);
    const width = parseInt(cols[8], 10);
    const height = parseInt(cols[9], 10);
    const conf = parseFloat(cols[10]);
    const text = cols.slice(11).join("\t").trim();

    if (!text || isNaN(left) || isNaN(top) || isNaN(width) || isNaN(height)) continue;

    words.push({
      text,
      confidence: isNaN(conf) ? undefined : conf,
      bbox: {
        x0: left,
        y0: top,
        x1: left + width,
        y1: top + height,
      },
    });
  }

  return words;
}

/**
 * Extracts OcrWord[] with bounding boxes from Tesseract blocks JSON structure.
 */
export function extractWordsFromBlocks(blocks: any[]): OcrWord[] {
  if (!Array.isArray(blocks)) return [];
  const words: OcrWord[] = [];

  for (const block of blocks) {
    const paragraphs = block?.paragraphs || [];
    for (const para of paragraphs) {
      const lines = para?.lines || [];
      for (const line of lines) {
        const lineWords = line?.words || [];
        for (const w of lineWords) {
          const text = typeof w?.text === "string" ? w.text.trim() : "";
          const bbox = w?.bbox;
          if (
            text &&
            bbox &&
            typeof bbox.x0 === "number" &&
            typeof bbox.y0 === "number" &&
            typeof bbox.x1 === "number" &&
            typeof bbox.y1 === "number"
          ) {
            words.push({
              text,
              confidence: typeof w.confidence === "number" ? w.confidence : undefined,
              bbox: {
                x0: bbox.x0,
                y0: bbox.y0,
                x1: bbox.x1,
                y1: bbox.y1,
              },
            });
          }
        }
      }
    }
  }

  return words;
}

type TableColumnField =
  | "hari"
  | "waktuMulai"
  | "waktuSelesai"
  | "waktuGabungan"
  | "lokasi"
  | "kodeMatkul"
  | "kelas"
  | "namaMatkul"
  | "sks"
  | "dosen"
  | "ignore";

interface DetectedColumnHeader {
  field: TableColumnField;
  label: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  minX: number;
  maxX: number;
}

interface VisualLine {
  y0: number;
  y1: number;
  yCenter: number;
  height: number;
  words: OcrWord[];
}

/**
 * Extracts a pair of start and end times from a combined time cell string
 * (e.g., "08:00 - 10:30", "09:50:00 s/d 11:30:00", "08.00 10.30").
 */
export function extractTimePairFromCell(raw: string): {
  waktuMulai: string;
  waktuSelesai: string;
  rawMulai: string;
  rawSelesai: string;
} | null {
  if (!raw || typeof raw !== "string") return null;
  const rangeMatch = raw.match(
    /([0-9OQoIl|SBZ]{1,2}[:.][0-9OQoIl|SBZ]{2}(?:[:.][0-9OQoIl|SBZ]{2})?)\s*(?:-|–|—|s\s*\/\s*d\.?|s\.?d\.?|sampai|to|\s)\s*([0-9OQoIl|SBZ]{1,2}[:.][0-9OQoIl|SBZ]{2}(?:[:.][0-9OQoIl|SBZ]{2})?)/i
  );
  if (rangeMatch) {
    const t1 = normalizeTime(rangeMatch[1]);
    const t2 = normalizeTime(rangeMatch[2]);
    if (t1 && t2) {
      return {
        waktuMulai: t1,
        waktuSelesai: t2,
        rawMulai: rangeMatch[1],
        rawSelesai: rangeMatch[2],
      };
    }
  }
  const single = normalizeTime(raw);
  if (single) {
    return {
      waktuMulai: single,
      waktuSelesai: "",
      rawMulai: raw.trim(),
      rawSelesai: "",
    };
  }
  return null;
}

/**
 * Groups OCR words into horizontal visual lines using spatial Y coordinates.
 */
export function groupWordsIntoVisualLines(words: OcrWord[]): VisualLine[] {
  const validWords = words.filter((w) => w && w.text && w.text.trim().length > 0 && w.bbox);
  if (validWords.length === 0) return [];

  // Sort by vertical center first, then x0
  const sorted = [...validWords].sort((a, b) => {
    const ycA = (a.bbox.y0 + a.bbox.y1) / 2;
    const ycB = (b.bbox.y0 + b.bbox.y1) / 2;
    if (Math.abs(ycA - ycB) > 4) return ycA - ycB;
    return a.bbox.x0 - b.bbox.x0;
  });

  const lines: VisualLine[] = [];

  for (const w of sorted) {
    const h = Math.max(4, w.bbox.y1 - w.bbox.y0);
    const yc = (w.bbox.y0 + w.bbox.y1) / 2;

    // Find best matching existing visual line
    let matchedLine: VisualLine | null = null;
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) {
      const candidate = lines[i];
      const tolerance = Math.max(8, Math.min(candidate.height, h) * 0.6);
      if (Math.abs(yc - candidate.yCenter) <= tolerance) {
        matchedLine = candidate;
        break;
      }
    }

    if (matchedLine) {
      matchedLine.words.push(w);
      matchedLine.y0 = Math.min(matchedLine.y0, w.bbox.y0);
      matchedLine.y1 = Math.max(matchedLine.y1, w.bbox.y1);
      const count = matchedLine.words.length;
      matchedLine.yCenter = (matchedLine.yCenter * (count - 1) + yc) / count;
      matchedLine.height = Math.max(matchedLine.height, h);
    } else {
      lines.push({
        y0: w.bbox.y0,
        y1: w.bbox.y1,
        yCenter: yc,
        height: h,
        words: [w],
      });
    }
  }

  // Sort lines top-to-bottom and sort words within each line left-to-right
  lines.sort((a, b) => a.yCenter - b.yCenter);
  for (const line of lines) {
    line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  return lines;
}

function classifyHeaderPhrase(phrase: string): TableColumnField | null {
  const clean = phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return null;
  if (clean === "no" || clean === "nomor") return "ignore";
  if (clean === "hari" || clean === "day") return "hari";
  if (clean === "mulai" || clean === "jam mulai" || clean === "waktu mulai" || clean === "start") {
    return "waktuMulai";
  }
  if (
    clean === "akhir" ||
    clean === "selesai" ||
    clean === "jam akhir" ||
    clean === "jam selesai" ||
    clean === "waktu selesai" ||
    clean === "end"
  ) {
    return "waktuSelesai";
  }
  if (
    clean === "jam" ||
    clean === "waktu" ||
    clean === "jam kuliah" ||
    clean === "waktu kuliah" ||
    clean === "jam pelajaran" ||
    clean === "waktu pelajaran" ||
    clean === "pukul" ||
    clean === "time"
  ) {
    return "waktuGabungan";
  }
  if (
    clean === "ruang" ||
    clean === "ruangan" ||
    clean === "lokasi" ||
    clean === "room" ||
    clean === "gedung"
  ) {
    return "lokasi";
  }
  if (
    clean === "kode mk" ||
    clean === "kodemk" ||
    clean === "kd mk" ||
    clean === "kode" ||
    clean === "kode matkul" ||
    clean === "sandi"
  ) {
    return "kodeMatkul";
  }
  if (clean === "kls" || clean === "kelas" || clean === "class" || clean === "seksi") {
    return "kelas";
  }
  if (
    clean === "nama mk" ||
    clean === "namamk" ||
    clean === "mata kuliah" ||
    clean === "matakuliah" ||
    clean === "nama mata kuliah" ||
    clean === "nama matkul" ||
    clean === "nama" ||
    clean === "kegiatan kursus" ||
    clean === "kegiatan" ||
    clean === "kursus" ||
    clean === "mata pelajaran" ||
    clean === "mapel" ||
    clean === "subject" ||
    clean === "course"
  ) {
    return "namaMatkul";
  }
  if (clean === "sks" || clean === "kredit" || clean === "credit" || clean === "bobot") {
    return "sks";
  }
  if (
    clean === "dosen" ||
    clean === "pengajar" ||
    clean === "nama dosen" ||
    clean === "guru" ||
    clean === "nama guru" ||
    clean === "lecturer" ||
    clean === "instructor" ||
    clean === "instruktur"
  ) {
    return "dosen";
  }
  return null;
}

/**
 * Detects a table header row from visual lines and computes horizontal column spans.
 */
export function detectTableHeaderFromLines(lines: VisualLine[]): {
  headerLineIndex: number;
  columns: DetectedColumnHeader[];
} | null {
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const words = line.words;
    const matchedCols: DetectedColumnHeader[] = [];

    let i = 0;
    while (i < words.length) {
      const w1 = words[i];
      const w2 = i + 1 < words.length ? words[i + 1] : null;
      const w3 = i + 2 < words.length ? words[i + 2] : null;

      // Try 3-word phrase (e.g. "Nama Mata Kuliah")
      if (w3 && w2 && w2.bbox.x0 - w1.bbox.x1 < 60 && w3.bbox.x0 - w2.bbox.x1 < 60) {
        const phrase3 = `${w1.text} ${w2.text} ${w3.text}`;
        const field3 = classifyHeaderPhrase(phrase3);
        if (field3) {
          matchedCols.push({
            field: field3,
            label: phrase3,
            x0: w1.bbox.x0,
            x1: w3.bbox.x1,
            y0: Math.min(w1.bbox.y0, w2.bbox.y0, w3.bbox.y0),
            y1: Math.max(w1.bbox.y1, w2.bbox.y1, w3.bbox.y1),
            minX: 0,
            maxX: Infinity,
          });
          i += 3;
          continue;
        }
      }

      // Try 2-word phrase (e.g. "Kode MK", "Nama MK", "Jam Mulai")
      if (w2 && w2.bbox.x0 - w1.bbox.x1 < 60) {
        const phrase2 = `${w1.text} ${w2.text}`;
        const field2 = classifyHeaderPhrase(phrase2);
        if (field2) {
          matchedCols.push({
            field: field2,
            label: phrase2,
            x0: w1.bbox.x0,
            x1: w2.bbox.x1,
            y0: Math.min(w1.bbox.y0, w2.bbox.y0),
            y1: Math.max(w1.bbox.y1, w2.bbox.y1),
            minX: 0,
            maxX: Infinity,
          });
          i += 2;
          continue;
        }
      }

      // Try 1-word header
      const field1 = classifyHeaderPhrase(w1.text);
      if (field1) {
        matchedCols.push({
          field: field1,
          label: w1.text,
          x0: w1.bbox.x0,
          x1: w1.bbox.x1,
          y0: w1.bbox.y0,
          y1: w1.bbox.y1,
          minX: 0,
          maxX: Infinity,
        });
      }
      i += 1;
    }

    const meaningfulCols = matchedCols.filter((c) => c.field !== "ignore");
    if (meaningfulCols.length >= 3) {
      // Sort columns left-to-right and compute minX / maxX boundaries
      matchedCols.sort((a, b) => a.x0 - b.x0);
      for (let c = 0; c < matchedCols.length; c++) {
        const cur = matchedCols[c];
        const prev = c > 0 ? matchedCols[c - 1] : null;
        const next = c + 1 < matchedCols.length ? matchedCols[c + 1] : null;

        if (!prev) {
          cur.minX = 0;
        } else {
          cur.minX = prev.maxX;
        }

        if (!next) {
          cur.maxX = Infinity;
        } else {
          // In left-aligned tables (like UNAS), column content starts near header x0
          // and can extend close to the next column's x0.
          const gap = Math.max(0, next.x0 - cur.x1);
          const leftPadForNext = Math.min(18, Math.max(4, gap * 0.25));
          cur.maxX = Math.max(cur.x1, next.x0 - leftPadForNext);
        }
      }

      return {
        headerLineIndex: idx,
        columns: matchedCols,
      };
    }
  }

  return null;
}

/**
 * Assigns a word to the most appropriate detected table column using spatial X coordinates
 * combined with token-type affinity near column boundaries.
 */
function assignWordToColumn(
  word: OcrWord,
  columns: DetectedColumnHeader[],
  userMappings: UserScheduleMapping[]
): TableColumnField {
  const wx0 = word.bbox.x0;
  const wxCenter = (word.bbox.x0 + word.bbox.x1) / 2;
  const text = word.text.trim();

  // Find primary spatial column based on word start (wx0) and word center (wxCenter)
  let spatialColIndex = columns.findIndex((c) => wx0 >= c.minX && wx0 < c.maxX);
  if (spatialColIndex === -1) {
    spatialColIndex = columns.findIndex((c) => wxCenter >= c.minX && wxCenter < c.maxX);
  }
  if (spatialColIndex === -1) {
    spatialColIndex = columns.length - 1;
  }

  const candidateCols = [
    columns[spatialColIndex],
    spatialColIndex > 0 ? columns[spatialColIndex - 1] : null,
    spatialColIndex + 1 < columns.length ? columns[spatialColIndex + 1] : null,
  ].filter(Boolean) as DetectedColumnHeader[];

  // Token-type affinity check for boundary disambiguation
  const isTime = normalizeTime(text) !== null;
  const isHari = normalizeHari(text, userMappings) !== null;
  const isCode = normalizeCourseCode(text, userMappings) !== null;
  const isKls = normalizeClassLabel(text, userMappings) !== null;
  const isSksDigit = /^[1-8]$/.test(text);

  if (isTime) {
    const timeCol = candidateCols.find(
      (c) =>
        c.field === "waktuMulai" ||
        c.field === "waktuSelesai" ||
        c.field === "waktuGabungan"
    );
    if (timeCol) return timeCol.field;
  }
  if (isHari) {
    const hariCol = candidateCols.find((c) => c.field === "hari");
    if (hariCol) return "hari";
  }
  if (isCode) {
    const codeCol = candidateCols.find((c) => c.field === "kodeMatkul");
    if (codeCol) return "kodeMatkul";
  }
  if (isKls) {
    const klsCol = candidateCols.find((c) => c.field === "kelas");
    if (klsCol && Math.abs(wx0 - klsCol.x0) < 60) return "kelas";
  }
  if (isSksDigit) {
    const sksCol = candidateCols.find((c) => c.field === "sks");
    if (sksCol && Math.abs(wxCenter - (sksCol.x0 + sksCol.x1) / 2) < 55) return "sks";
  }

  // Prevent non-code words in Ruang from spilling into kodeMatkul
  const assigned = columns[spatialColIndex];
  if (assigned.field === "kodeMatkul" && !isCode) {
    const prevCol = spatialColIndex > 0 ? columns[spatialColIndex - 1] : null;
    if (prevCol && prevCol.field === "lokasi" && wx0 < assigned.x0) {
      return "lokasi";
    }
  }

  // Prevent long Nama MK words from spilling into SKS column unless they are digits
  if (assigned.field === "sks" && !/^\d+$/.test(text)) {
    const prevCol = spatialColIndex > 0 ? columns[spatialColIndex - 1] : null;
    if (prevCol && prevCol.field === "namaMatkul") {
      return "namaMatkul";
    }
  }

  return assigned.field;
}

function classifyColumnsToLayout(cols: TableColumnField[]): LayoutDetectionResult {
  const meaningful = cols.filter((c) => c !== "ignore");
  const hasStartAndEnd =
    meaningful.includes("waktuMulai") && meaningful.includes("waktuSelesai");
  const hasCombinedTime = meaningful.includes("waktuGabungan");
  const hasKodeOrKls =
    meaningful.includes("kodeMatkul") || meaningful.includes("kelas");

  if (hasStartAndEnd && hasKodeOrKls && meaningful.length >= 6) {
    return {
      kind: "unas_8col_table",
      label: "Tabel Akademik 8-Kolom (Format SIAKAD/UNAS)",
      hasRecognizedHeaders: true,
      detectedColumns: meaningful,
    };
  }
  if (hasCombinedTime) {
    return {
      kind: "combined_time_table",
      label: "Tabel Jadwal dengan Kolom Waktu Gabungan",
      hasRecognizedHeaders: true,
      detectedColumns: meaningful,
    };
  }
  return {
    kind: "simple_schedule_table",
    label: "Tabel Jadwal Ringkas",
    hasRecognizedHeaders: true,
    detectedColumns: meaningful,
  };
}

/**
 * Lightweight layout-detection stage before parsing:
 * Identifies UNAS 8-column tables, combined start/end time tables, simpler weekday/time/course tables,
 * traditional KRS text schedules, or unstructured fallback.
 */
export function detectScheduleLayout(input: {
  text?: string;
  words?: OcrWord[];
}): LayoutDetectionResult {
  if (Array.isArray(input.words) && input.words.length > 0) {
    const vLines = groupWordsIntoVisualLines(input.words);
    const headerInfo = detectTableHeaderFromLines(vLines);
    if (headerInfo) {
      return classifyColumnsToLayout(headerInfo.columns.map((c) => c.field));
    }
  }

  const rawText = typeof input.text === "string" ? input.text : "";
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l));

  for (const line of lines) {
    if (isHeaderTextLine(line)) {
      const delimiter = (line.match(/\|/g) || []).length >= 2
        ? "|"
        : (line.match(/\t/g) || []).length >= 2
        ? "\t"
        : null;
      if (delimiter) {
        const rawCells = splitDelimitedRow(line, delimiter, 0);
        const cols = rawCells.map((c) => classifyHeaderPhrase(c) || "ignore");
        if (cols.filter((c) => c !== "ignore").length >= 3) {
          return classifyColumnsToLayout(cols);
        }
      }
      // Space-separated header line
      const lower = line.toLowerCase();
      if (/\bmulai\b/.test(lower) && /\b(akhir|selesai)\b/.test(lower) && /\bkode\b/.test(lower)) {
        return {
          kind: "unas_8col_table",
          label: "Tabel Akademik 8-Kolom (Format SIAKAD/UNAS)",
          hasRecognizedHeaders: true,
          detectedColumns: ["hari", "waktuMulai", "waktuSelesai", "lokasi", "kodeMatkul", "kelas", "namaMatkul", "sks"],
        };
      }
      if (/\b(jam|waktu|pukul)\b/.test(lower) && !/\bmulai\b/.test(lower)) {
        return {
          kind: "combined_time_table",
          label: "Tabel Jadwal dengan Kolom Waktu Gabungan",
          hasRecognizedHeaders: true,
          detectedColumns: ["hari", "waktuGabungan", "namaMatkul"],
        };
      }
      return {
        kind: "simple_schedule_table",
        label: "Tabel Jadwal Ringkas",
        hasRecognizedHeaders: true,
        detectedColumns: ["hari", "waktuMulai", "waktuSelesai", "namaMatkul"],
      };
    }
  }

  // No explicit header row detected — inspect row structure
  const hasPipeOrTabTable = lines.some(
    (l) => (l.match(/\|/g) || []).length >= 2 || (l.match(/\t/g) || []).length >= 2
  );
  const hasHmsTime = lines.some((l) => /\b\d{1,2}[:.]\d{2}[:.]\d{2}\b/.test(l));
  const hasCourseCode = lines.some((l) =>
    l.split(/\s+/).some((tok) => normalizeCourseCode(tok) !== null)
  );
  const hasHyphenTimeRange = lines.some((l) =>
    /(\d{1,2}[:.]\d{2})\s*(?:-|–|—|s\s*\/\s*d\.?|s\.?d\.?|sampai|to)\s*(\d{1,2}[:.]\d{2})/i.test(l)
  );
  const hasTraditionalLabels = lines.some((l) => /\b(?:Dosen|Pengajar)\s*:/i.test(l));

  if ((hasHmsTime && hasCourseCode) || (hasCourseCode && !hasHyphenTimeRange)) {
    return {
      kind: "unas_8col_table",
      label: "Baris Tabel Akademik (Tanpa Baris Header)",
      hasRecognizedHeaders: false,
      detectedColumns: ["hari", "waktuMulai", "waktuSelesai", "lokasi", "kodeMatkul", "kelas", "namaMatkul", "sks"],
      limitationReason: "Baris judul kolom (header) tidak terdeteksi; posisi kolom dikenali melalui pola jam dan kode mata kuliah.",
    };
  }

  if (hasPipeOrTabTable) {
    return {
      kind: hasHyphenTimeRange ? "combined_time_table" : "simple_schedule_table",
      label: "Tabel Jadwal Tanpa Baris Header",
      hasRecognizedHeaders: false,
      detectedColumns: ["hari", "waktuMulai", "waktuSelesai", "namaMatkul", "sks"],
      limitationReason:
        "Baris header tabel tidak ditemukan; kolom dipetakan otomatis berdasarkan pola hari, waktu, dan mata kuliah.",
    };
  }

  if (hasTraditionalLabels || hasHyphenTimeRange) {
    return {
      kind: "traditional_krs_text",
      label: "Jadwal Berbasis Teks / Daftar KRS",
      hasRecognizedHeaders: false,
      detectedColumns: ["namaMatkul", "hari", "waktuMulai", "waktuSelesai", "lokasi", "dosen", "sks"],
    };
  }

  return {
    kind: "unstructured_fallback",
    label: "Teks Jadwal Tanpa Struktur Tabel Jelas",
    hasRecognizedHeaders: false,
    detectedColumns: [],
    limitationReason:
      "Struktur kolom atau batas tabel tidak dapat dikenali dengan pasti. Harap tinjau dan lengkapi kolom yang ditandai sebelum menyimpan.",
  };
}

function computeAverageWordConfidence(words: OcrWord[]): number | null {
  const confs = words
    .map((w) => w.confidence)
    .filter((c): c is number => typeof c === "number" && !isNaN(c));
  if (confs.length === 0) return null;
  return Math.round(confs.reduce((a, b) => a + b, 0) / confs.length);
}

/**
 * Parses OCR words with bounding boxes into structured schedule items using spatial table layout.
 */
export function parseScheduleFromWords(
  words: OcrWord[],
  existingCourses: ExistingSchedule[] = [],
  userMappings: UserScheduleMapping[] = []
): ParsedScheduleItem[] {
  if (!Array.isArray(words) || words.length === 0) return [];

  const visualLines = groupWordsIntoVisualLines(words);
  if (visualLines.length === 0) return [];

  const headerInfo = detectTableHeaderFromLines(visualLines);
  if (!headerInfo) {
    // If no table header detected from words, reconstruct text from visual lines and delegate to text parser
    const reconstructedText = visualLines
      .map((l) => l.words.map((w) => w.text).join(" "))
      .join("\n");
    return parseScheduleText(reconstructedText, existingCourses, userMappings);
  }

  const { headerLineIndex, columns } = headerInfo;
  const layoutInfo = classifyColumnsToLayout(columns.map((c) => c.field));
  const dataLines = visualLines.slice(headerLineIndex + 1);
  if (dataLines.length === 0) return [];

  interface BucketedLine {
    visualLine: VisualLine;
    buckets: Record<TableColumnField, OcrWord[]>;
    isAnchor: boolean;
  }

  const bucketedLines: BucketedLine[] = dataLines.map((vLine) => {
    const buckets: Record<TableColumnField, OcrWord[]> = {
      hari: [],
      waktuMulai: [],
      waktuSelesai: [],
      waktuGabungan: [],
      lokasi: [],
      kodeMatkul: [],
      kelas: [],
      namaMatkul: [],
      sks: [],
      dosen: [],
      ignore: [],
    };

    for (const w of vLine.words) {
      // Skip stray pipe/table border characters
      if (/^[|¦—–_]+$/.test(w.text.trim())) continue;
      const colField = assignWordToColumn(w, columns, userMappings);
      buckets[colField].push(w);
    }

    // If waktuGabungan has words, split into waktuMulai and waktuSelesai
    if (buckets.waktuGabungan.length > 0) {
      const joinedTime = buckets.waktuGabungan.map((w) => w.text).join(" ");
      const pair = extractTimePairFromCell(joinedTime);
      if (pair) {
        if (buckets.waktuMulai.length === 0 && pair.rawMulai) {
          buckets.waktuMulai.push({
            text: pair.rawMulai,
            confidence: computeAverageWordConfidence(buckets.waktuGabungan) ?? undefined,
            bbox: buckets.waktuGabungan[0].bbox,
          });
        }
        if (buckets.waktuSelesai.length === 0 && pair.rawSelesai) {
          buckets.waktuSelesai.push({
            text: pair.rawSelesai,
            confidence: computeAverageWordConfidence(buckets.waktuGabungan) ?? undefined,
            bbox: buckets.waktuGabungan[buckets.waktuGabungan.length - 1].bbox,
          });
        }
      }
    }

    // If waktuMulai received 2 time tokens and waktuSelesai is empty, split them
    if (buckets.waktuMulai.length >= 2 && buckets.waktuSelesai.length === 0) {
      const t1 = normalizeTime(buckets.waktuMulai[0].text);
      const t2 = normalizeTime(buckets.waktuMulai[1].text);
      if (t1 && t2) {
        buckets.waktuSelesai.push(buckets.waktuMulai[1]);
        buckets.waktuMulai = [buckets.waktuMulai[0]];
      }
    }

    const hasTime =
      buckets.waktuMulai.some((w) => normalizeTime(w.text) !== null) ||
      buckets.waktuSelesai.some((w) => normalizeTime(w.text) !== null);
    const hasDay = buckets.hari.some((w) => normalizeHari(w.text, userMappings) !== null);
    const hasCode = buckets.kodeMatkul.some((w) => normalizeCourseCode(w.text, userMappings) !== null);
    const hasKls = buckets.kelas.some((w) => normalizeClassLabel(w.text, userMappings) !== null);

    // A line is a row anchor if it has a valid time, or at least two structural keys (day, code, class)
    const anchorCount = (hasTime ? 2 : 0) + (hasDay ? 1 : 0) + (hasCode ? 1 : 0) + (hasKls ? 1 : 0);
    const isAnchor = anchorCount >= 2;

    return {
      visualLine: vLine,
      buckets,
      isAnchor,
    };
  });

  // Group bucketed lines into logical rows (handling multi-line course names & multi-line rooms,
  // both top-aligned and vertically centered)
  interface LogicalRow {
    anchorY: number;
    lastY: number;
    buckets: Record<TableColumnField, OcrWord[]>;
    allWords: OcrWord[];
  }

  const logicalRows: LogicalRow[] = [];
  let pendingPreAnchorLines: BucketedLine[] = [];

  for (let i = 0; i < bucketedLines.length; i++) {
    const bLine = bucketedLines[i];

    if (bLine.isAnchor) {
      const newRow: LogicalRow = {
        anchorY: bLine.visualLine.yCenter,
        lastY: bLine.visualLine.yCenter,
        buckets: {
          hari: [],
          waktuMulai: [],
          waktuSelesai: [],
          waktuGabungan: [],
          lokasi: [],
          kodeMatkul: [],
          kelas: [],
          namaMatkul: [],
          sks: [],
          dosen: [],
          ignore: [],
        },
        allWords: [],
      };

      // Attach any pending pre-anchor lines (from middle-aligned multi-line cells)
      for (const pre of pendingPreAnchorLines) {
        if (bLine.visualLine.yCenter - pre.visualLine.yCenter <= bLine.visualLine.height * 2.5) {
          for (const key of Object.keys(newRow.buckets) as TableColumnField[]) {
            newRow.buckets[key].push(...pre.buckets[key]);
          }
          newRow.allWords.push(...pre.visualLine.words);
        }
      }
      pendingPreAnchorLines = [];

      for (const key of Object.keys(newRow.buckets) as TableColumnField[]) {
        newRow.buckets[key].push(...bLine.buckets[key]);
      }
      newRow.allWords.push(...bLine.visualLine.words);
      logicalRows.push(newRow);
    } else {
      // Continuation line (e.g., 2nd line of Nama MK or Ruang)
      const prevRow = logicalRows.length > 0 ? logicalRows[logicalRows.length - 1] : null;
      const nextAnchor = bucketedLines.slice(i + 1).find((bl) => bl.isAnchor);

      if (!prevRow) {
        pendingPreAnchorLines.push(bLine);
      } else {
        const distToPrev = bLine.visualLine.yCenter - prevRow.lastY;
        const distToNext = nextAnchor
          ? nextAnchor.visualLine.yCenter - bLine.visualLine.yCenter
          : Infinity;

        // If much closer to the previous row (or within normal multi-line wrap distance), append to prevRow
        if (distToPrev <= Math.max(32, bLine.visualLine.height * 2.2) || distToPrev <= distToNext * 1.3) {
          for (const key of Object.keys(prevRow.buckets) as TableColumnField[]) {
            prevRow.buckets[key].push(...bLine.buckets[key]);
          }
          prevRow.allWords.push(...bLine.visualLine.words);
          prevRow.lastY = bLine.visualLine.yCenter;
        } else {
          pendingPreAnchorLines.push(bLine);
        }
      }
    }
  }

  // If no anchor rows were found at all, treat non-empty bucketed lines as review candidates
  if (logicalRows.length === 0 && pendingPreAnchorLines.length > 0) {
    for (const pre of pendingPreAnchorLines) {
      logicalRows.push({
        anchorY: pre.visualLine.yCenter,
        lastY: pre.visualLine.yCenter,
        buckets: pre.buckets,
        allWords: [...pre.visualLine.words],
      });
    }
  }

  const rawItems: Partial<ParsedScheduleItem>[] = [];
  let lastValidHari = "";

  for (const row of logicalRows) {
    const joinBucket = (field: TableColumnField): string => {
      const wList = row.buckets[field];
      if (!wList || wList.length === 0) return "";
      // Sort top-to-bottom, left-to-right within the cell
      const sorted = [...wList].sort((a, b) => {
        const ycA = (a.bbox.y0 + a.bbox.y1) / 2;
        const ycB = (b.bbox.y0 + b.bbox.y1) / 2;
        if (Math.abs(ycA - ycB) > 6) return ycA - ycB;
        return a.bbox.x0 - b.bbox.x0;
      });
      return sorted.map((w) => w.text.trim()).join(" ").replace(/\s+/g, " ").trim();
    };

    const rawHari = joinBucket("hari");
    const rawMulai = joinBucket("waktuMulai");
    const rawSelesai = joinBucket("waktuSelesai");
    const rawLokasi = joinBucket("lokasi");
    const rawKode = joinBucket("kodeMatkul");
    const rawKelas = joinBucket("kelas");
    const rawNama = joinBucket("namaMatkul");
    const rawSks = joinBucket("sks");
    const rawDosen = joinBucket("dosen");

    const rowRawText = row.allWords.map((w) => w.text).join(" ").trim();
    if (!rowRawText) continue;

    const appliedCorrections: string[] = [];
    const warnings: string[] = [];

    let normalizedHari = normalizeHari(rawHari, userMappings);
    if (!normalizedHari && !rawHari && lastValidHari && (rawMulai || rawSelesai)) {
      // Carry over weekday when a multi-course weekday block merges the Hari cell
      normalizedHari = lastValidHari;
      appliedCorrections.push(`Hari '${normalizedHari}' diteruskan dari baris jadwal sebelumnya.`);
    }
    if (normalizedHari) {
      if (rawHari && normalizedHari.toLowerCase() !== rawHari.toLowerCase()) {
        appliedCorrections.push(`Hari dinormalisasi: '${rawHari}' → '${normalizedHari}'`);
      }
      lastValidHari = normalizedHari;
    }

    let waktuMulai = normalizeTime(rawMulai) || "";
    let waktuSelesai = normalizeTime(rawSelesai) || "";

    // If spatial column OCR missed colons or split tokens across words, scan row.allWords and joined row text
    if (!waktuMulai || !waktuSelesai) {
      const timeTokens: string[] = [];
      for (const w of row.allWords) {
        const nt = normalizeTime(w.text);
        if (nt) timeTokens.push(nt);
      }
      if (timeTokens.length < 2) {
        // Also scan joined rowRawText for time patterns like "09:50:00", "09 50 00", or "09.50"
        const regexMatches = Array.from(
          rowRawText.matchAll(/\b(\d{1,2})\s*[:.]?\s*(\d{2})(?:\s*[:.]?\s*(?:00|\d{2}))?\b/g)
        );
        for (const m of regexMatches) {
          const candidate = `${m[1]}:${m[2]}`;
          const nt = normalizeTime(candidate);
          if (nt && !timeTokens.includes(nt)) {
            timeTokens.push(nt);
          }
        }
      }
      if (!waktuMulai && timeTokens.length >= 1) waktuMulai = timeTokens[0];
      if (!waktuSelesai && timeTokens.length >= 2) waktuSelesai = timeTokens[1];
    }

    let kodeMatkul: string | null = null;
    let extraKelasFromKode: string | null = null;
    if (rawKode) {
      const codeNorm = normalizeCourseCode(rawKode, userMappings);
      if (codeNorm) {
        kodeMatkul = codeNorm.code;
        if (codeNorm.wasCorrected) {
          appliedCorrections.push(`Kode MK diperbaiki dari OCR: '${rawKode}' → '${codeNorm.code}'`);
        }
      } else {
        // Check if rawKode has multiple tokens (e.g. "IF253418 R.03" when Kls column merged into Kode MK)
        const kodeTokens = rawKode.split(/\s+/).filter(Boolean);
        const firstCode = kodeTokens.length > 0 ? normalizeCourseCode(kodeTokens[0], userMappings) : null;
        if (firstCode) {
          kodeMatkul = firstCode.code;
          if (firstCode.wasCorrected) {
            appliedCorrections.push(`Kode MK diperbaiki dari OCR: '${kodeTokens[0]}' → '${firstCode.code}'`);
          }
          if (kodeTokens.length > 1) {
            const secondKls = normalizeClassLabel(kodeTokens[1], userMappings);
            if (secondKls) {
              extraKelasFromKode = secondKls.kelas;
            }
          }
        } else {
          kodeMatkul = rawKode;
          warnings.push(`Format Kode MK '${rawKode}' tampak tidak standar. Harap periksa kembali.`);
        }
      }
    } else {
      for (const w of row.allWords) {
        const cn = normalizeCourseCode(w.text, userMappings);
        if (cn) {
          kodeMatkul = cn.code;
          break;
        }
      }
    }

    let kelas: string | null = extraKelasFromKode;
    if (rawKelas) {
      const klsNorm = normalizeClassLabel(rawKelas, userMappings);
      if (klsNorm) {
        kelas = klsNorm.kelas;
        if (klsNorm.wasCorrected) {
          appliedCorrections.push(`Label kelas dinormalisasi: '${rawKelas}' → '${klsNorm.kelas}'`);
        }
      } else {
        kelas = rawKelas;
      }
    }

    let sks: number | null = null;
    if (rawSks) {
      const sksMatch = rawSks.match(/\d+/);
      if (sksMatch) {
        sks = parseInt(sksMatch[0], 10);
      } else {
        warnings.push(`Nilai SKS '${rawSks}' tidak terbaca sebagai angka.`);
      }
    }

    // Track per-field average OCR word confidence when available
    const fieldOcrConf: Partial<Record<ScheduleFieldKey, number | null>> = {
      hari: computeAverageWordConfidence(row.buckets.hari),
      waktuMulai: computeAverageWordConfidence(row.buckets.waktuMulai),
      waktuSelesai: computeAverageWordConfidence(row.buckets.waktuSelesai),
      lokasi: computeAverageWordConfidence(row.buckets.lokasi),
      kodeMatkul: computeAverageWordConfidence(row.buckets.kodeMatkul),
      kelas: computeAverageWordConfidence(row.buckets.kelas),
      namaMatkul: computeAverageWordConfidence(row.buckets.namaMatkul),
      sks: computeAverageWordConfidence(row.buckets.sks),
      dosen: computeAverageWordConfidence(row.buckets.dosen),
    };

    rawItems.push({
      namaMatkul: cleanCourseName(rawNama),
      hari: normalizedHari || "",
      waktuMulai,
      waktuSelesai,
      lokasi: cleanRoomName(rawLokasi) || null,
      kodeMatkul,
      kelas,
      sks,
      dosen: rawDosen || null,
      kategori: "Wajib",
      rawText: rowRawText,
      rawFields: {
        hari: rawHari,
        waktuMulai: rawMulai,
        waktuSelesai: rawSelesai,
        lokasi: rawLokasi,
        kodeMatkul: rawKode,
        kelas: rawKelas,
        namaMatkul: rawNama,
        sks: rawSks,
        dosen: rawDosen,
        _ocrConf: JSON.stringify(fieldOcrConf),
      },
      layoutKind: layoutInfo.kind,
      appliedCorrections,
      warnings,
    });
  }

  return finalizeScheduleBatch(rawItems, existingCourses, userMappings, {
    layoutKind: layoutInfo.kind,
    hasRecognizedHeaders: true,
  });
}

/**
 * Parses pipe/tab/space-separated tabular schedule rows or traditional KRS text into ParsedScheduleItem[].
 */
export function parseScheduleText(
  text: string,
  existingCourses: ExistingSchedule[] = [],
  userMappings: UserScheduleMapping[] = []
): ParsedScheduleItem[] {
  if (!text || typeof text !== "string") return [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l));

  if (rawLines.length === 0) return [];

  const layout = detectScheduleLayout({ text });

  // 1. Check if text contains pipe-delimited or tab-delimited table rows
  const pipeOrTabLines = rawLines.filter((l) => (l.match(/\|/g) || []).length >= 2 || (l.match(/\t/g) || []).length >= 2);
  if (pipeOrTabLines.length >= 1) {
    const delimitedResult = parseDelimitedTableLines(rawLines, existingCourses, userMappings, layout);
    if (delimitedResult.length > 0) return delimitedResult;
  }

  // 2. Check if text contains UNAS / SIAKAD tabular rows (either header or rows with 2 time columns / course codes)
  const tabularResult = parseTabularTextLines(rawLines, existingCourses, userMappings, layout);
  if (tabularResult.length > 0) return tabularResult;

  // 3. Traditional KRS / list-based schedule format (e.g., "1. Pemrograman Web\nSenin 08:00 - 10:30 3 SKS ...")
  const krsResult = parseTraditionalKrsLines(rawLines, existingCourses, userMappings);
  if (krsResult.length > 0) return krsResult;

  // 4. Fallback Review State (Requirement 2.9 & 4):
  // If non-empty text could not be recovered into standard rows, return reviewable candidate row(s)
  // rather than a misleading array.
  return buildFallbackReviewItems(rawLines, existingCourses, userMappings);
}

/**
 * Full recognition pipeline returning both detected layout metadata and confidence-annotated items.
 */
export function recognizeScheduleData(
  input: {
    text?: string;
    words?: OcrWord[];
    tsv?: string;
    blocks?: any[];
  },
  existingCourses: ExistingSchedule[] = [],
  userMappings: UserScheduleMapping[] = []
): ScheduleRecognitionResult {
  let words: OcrWord[] = [];
  if (Array.isArray(input.words) && input.words.length > 0) {
    words = input.words;
  } else if (typeof input.tsv === "string" && input.tsv.trim().length > 0) {
    words = parseTsvToWords(input.tsv);
  } else if (Array.isArray(input.blocks) && input.blocks.length > 0) {
    words = extractWordsFromBlocks(input.blocks);
  }

  const layout = detectScheduleLayout({ text: input.text, words });
  let items: ParsedScheduleItem[] = [];

  if (words.length > 0) {
    const spatialItems = parseScheduleFromWords(words, existingCourses, userMappings);
    if (spatialItems.length > 0) {
      items = spatialItems;
    }
  }

  if (items.length === 0 && typeof input.text === "string" && input.text.trim().length > 0) {
    items = parseScheduleText(input.text, existingCourses, userMappings);
  }

  // Tag local OCR source
  items = items.map((it) => ({
    ...it,
    extractionSource: it.extractionSource || "local_ocr",
  }));

  const sufficiency = evaluateScheduleExtractionSufficiency(layout, items);

  return {
    layout,
    items,
    insufficientForProduction: sufficiency.insufficient,
    insufficiencyReasons: sufficiency.reasons,
  };
}

/**
 * Requirement Phase C: Hybrid Decision Logic.
 * Evaluates explicit, testable indicators to determine if local OCR extraction is insufficient
 * and vision-model fallback should be offered.
 */
export function evaluateScheduleExtractionSufficiency(
  layout: LayoutDetectionResult,
  items: ParsedScheduleItem[]
): {
  insufficient: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Indicator 1: No valid schedule rows extracted
  if (!items || items.length === 0) {
    reasons.push("Tidak ada baris jadwal kuliah yang berhasil diekstrak oleh OCR lokal.");
    return { insufficient: true, reasons };
  }

  // Indicator 2: Table headers could not be mapped or unstructured fallback
  if (layout.kind === "unstructured_fallback" || !layout.hasRecognizedHeaders) {
    reasons.push("Format tabel tidak memiliki baris header yang dapat dipetakan secara pasti.");
  }

  // Indicator 3: Required weekday or time fields are missing or invalid
  const rowsWithMissingDay = items.filter((it) => !it.hari || !normalizeHari(it.hari)).length;
  const rowsWithMissingTime = items.filter(
    (it) => !it.waktuMulai || !it.waktuSelesai || it.waktuMulai >= it.waktuSelesai
  ).length;
  const rowsWithMissingCourse = items.filter((it) => !it.namaMatkul || it.namaMatkul.length < 3).length;

  if (rowsWithMissingDay > 0) {
    reasons.push(`${rowsWithMissingDay} dari ${items.length} baris tidak memiliki hari kuliah yang valid.`);
  }
  if (rowsWithMissingTime > 0) {
    reasons.push(`${rowsWithMissingTime} dari ${items.length} baris tidak memiliki jam kuliah yang valid.`);
  }
  if (rowsWithMissingCourse > 0) {
    reasons.push(`${rowsWithMissingCourse} dari ${items.length} baris tidak memiliki nama mata kuliah yang terbaca jelas.`);
  }

  // Indicator 4: High ratio of ambiguous/needs-review rows (> 40% of rows need review)
  const rowsNeedingReview = items.filter((it) => it.needsReview).length;
  if (rowsNeedingReview / items.length >= 0.4) {
    reasons.push(
      `${rowsNeedingReview} dari ${items.length} baris memiliki kolom yang meragukan atau perlu ditinjau.`
    );
  }

  // Indicator 5: Missing SKS on more than half the rows in a multi-course schedule
  const rowsWithMissingSks = items.filter((it) => it.sks === null || typeof it.sks !== "number").length;
  if (items.length >= 2 && rowsWithMissingSks / items.length >= 0.5) {
    reasons.push("Sebagian besar baris tidak berhasil mengekstrak bobot SKS.");
  }

  return {
    insufficient: reasons.length > 0,
    reasons,
  };
}

/**
 * Requirement Phase E: Merge and Validate.
 * Merges external vision-model output with existing local OCR results without blindly replacing local evidence.
 * Resolves discrepancies, attaches review reasons for conflicts, and runs server-side validation.
 */
export function mergeVisionWithOcrSchedule(
  localItems: ParsedScheduleItem[],
  visionRows: any[],
  existingCourses: ExistingSchedule[] = [],
  userMappings: UserScheduleMapping[] = [],
  layoutKind?: ScheduleLayoutKind
): ParsedScheduleItem[] {
  if (!visionRows || visionRows.length === 0) {
    return localItems;
  }

  const rawMergedCandidates: Partial<ParsedScheduleItem>[] = [];

  // Match each vision row with the most relevant local OCR row
  // Matching priority: exact day + time overlap OR high course name similarity OR matched course code
  const usedLocalIndices = new Set<number>();

  for (let vIdx = 0; vIdx < visionRows.length; vIdx++) {
    const vr = visionRows[vIdx];
    const vHari = vr.hari ? normalizeHari(vr.hari, userMappings) : null;
    const vMulai = vr.waktuMulai ? normalizeTime(vr.waktuMulai) : null;
    const vSelesai = vr.waktuSelesai ? normalizeTime(vr.waktuSelesai) : null;
    const vNama = (vr.namaMatkul || "").trim();
    const vKode = vr.kodeMatkul ? vr.kodeMatkul.trim().toUpperCase() : null;
    const vRuang = vr.lokasi ? vr.lokasi.trim() : null;
    const vKelas = vr.kelas ? vr.kelas.trim() : null;
    const vSks = typeof vr.sks === "number" && !isNaN(vr.sks) ? vr.sks : null;
    const vDosen = vr.dosen ? vr.dosen.trim() : null;

    let matchedLocalIdx = -1;
    let highestScore = 0;

    for (let lIdx = 0; lIdx < localItems.length; lIdx++) {
      if (usedLocalIndices.has(lIdx)) continue;
      const lr = localItems[lIdx];
      let score = 0;

      // Same day and overlapping/exact times
      if (vHari && lr.hari && vHari.toLowerCase() === lr.hari.toLowerCase()) {
        score += 30;
        if (vMulai && lr.waktuMulai && vMulai === lr.waktuMulai) score += 30;
        if (vSelesai && lr.waktuSelesai && vSelesai === lr.waktuSelesai) score += 20;
      }

      // Course code match
      if (vKode && lr.kodeMatkul && vKode.toUpperCase() === lr.kodeMatkul.toUpperCase()) {
        score += 40;
      }

      // Course name similarity
      if (vNama && lr.namaMatkul) {
        const sim = computeTextSimilarity(vNama, lr.namaMatkul);
        score += Math.round(sim * 40);
      }

      if (score > highestScore && score >= 35) {
        highestScore = score;
        matchedLocalIdx = lIdx;
      }
    }

    const appliedCorrections: string[] = [];
    const warnings: string[] = [];
    const tentativeSuggestions: Record<string, string> = {};

    let finalHari = vHari || "";
    let finalMulai = vMulai || "";
    let finalSelesai = vSelesai || "";
    let finalNama = vNama;
    let finalKode = vKode;
    let finalRuang = vRuang;
    let finalKelas = vKelas;
    let finalSks = vSks;
    let finalDosen = vDosen;

    let rawTextCombined = `[Vision AI Row #${vIdx + 1}]`;

    if (matchedLocalIdx !== -1) {
      usedLocalIndices.add(matchedLocalIdx);
      const lr = localItems[matchedLocalIdx];
      rawTextCombined = `${rawTextCombined} Local OCR: ${lr.rawText || lr.namaMatkul}`;

      // Local OCR had a clean confirmed mapping -> preserve confirmed mapping!
      const isLocalConfirmed = lr.recognitionStatus === "confirmed_assisted";

      // 1. Hari resolution
      if (isLocalConfirmed && lr.hari) {
        finalHari = lr.hari;
      } else if (!finalHari && lr.hari) {
        finalHari = lr.hari;
      }

      // 2. Time resolution
      if (lr.waktuMulai && lr.waktuSelesai && lr.waktuMulai < lr.waktuSelesai) {
        if (!finalMulai || !finalSelesai) {
          finalMulai = lr.waktuMulai;
          finalSelesai = lr.waktuSelesai;
          appliedCorrections.push("Jam kuliah dipertahankan dari pembacaan OCR lokal.");
        } else if (finalMulai !== lr.waktuMulai || finalSelesai !== lr.waktuSelesai) {
          // Conflict between local OCR and Vision Model -> flag for user review
          warnings.push(
            `Perbedaan jam kuliah: Vision '${finalMulai}-${finalSelesai}' vs OCR Lokal '${lr.waktuMulai}-${lr.waktuSelesai}'. Harap periksa jadwal asli.`
          );
          tentativeSuggestions.waktuMulai = lr.waktuMulai;
          tentativeSuggestions.waktuSelesai = lr.waktuSelesai;
        }
      }

      // 3. Nama Mata Kuliah resolution
      if (lr.namaMatkul && lr.namaMatkul.length >= 3) {
        if (!finalNama) {
          finalNama = lr.namaMatkul;
        } else if (lr.namaMatkul !== finalNama) {
          const sim = computeTextSimilarity(lr.namaMatkul, finalNama);
          if (sim < 0.6) {
            // Serious discrepancy
            warnings.push(
              `Perbedaan nama mata kuliah: Vision '${finalNama}' vs OCR Lokal '${lr.namaMatkul}'. Harap pastikan nama yang benar.`
            );
            tentativeSuggestions.namaMatkul = lr.namaMatkul;
          } else if (lr.namaMatkul.length > finalNama.length && !isLocalConfirmed) {
            // Keep the more complete name if similar
            finalNama = lr.namaMatkul;
          }
        }
      }

      // 4. Kode MK & SKS resolution
      if (!finalKode && lr.kodeMatkul) finalKode = lr.kodeMatkul;
      if (finalSks === null && lr.sks !== null) finalSks = lr.sks;
      if (!finalRuang && lr.lokasi) finalRuang = lr.lokasi;
      if (!finalKelas && lr.kelas) finalKelas = lr.kelas;
      if (!finalDosen && lr.dosen) finalDosen = lr.dosen;
    }

    if (vr.ambiguousFieldsReason) {
      warnings.push(`Catatan Vision Model: ${vr.ambiguousFieldsReason}`);
    }

    rawMergedCandidates.push({
      namaMatkul: cleanCourseName(finalNama),
      hari: finalHari,
      waktuMulai: finalMulai,
      waktuSelesai: finalSelesai,
      lokasi: cleanRoomName(finalRuang || "") || null,
      kodeMatkul: finalKode,
      kelas: finalKelas,
      sks: finalSks,
      dosen: finalDosen,
      kategori: "Wajib",
      rawText: rawTextCombined,
      rawFields: {
        namaMatkul: finalNama,
        hari: finalHari,
        waktuMulai: finalMulai,
        waktuSelesai: finalSelesai,
        lokasi: finalRuang || "",
        kodeMatkul: finalKode || "",
        kelas: finalKelas || "",
      },
      tentativeSuggestions,
      extractionSource: matchedLocalIdx !== -1 ? "hybrid_merged" : "vision_fallback",
      layoutKind: layoutKind || "unas_8col_table",
      appliedCorrections,
      warnings,
      needsReview: warnings.length > 0,
    });
  }

  // Include any unmatched high-confidence local OCR items so local evidence is never silently discarded
  for (let lIdx = 0; lIdx < localItems.length; lIdx++) {
    if (!usedLocalIndices.has(lIdx)) {
      const unmatchedLocal = localItems[lIdx];
      if (unmatchedLocal.namaMatkul && unmatchedLocal.hari && unmatchedLocal.waktuMulai && !unmatchedLocal.needsReview) {
        rawMergedCandidates.push({
          ...unmatchedLocal,
          warnings: [
            ...(unmatchedLocal.warnings || []),
            "Baris ini ditemukan oleh OCR lokal tetapi tidak terdapat pada hasil vision model. Harap periksa.",
          ],
          needsReview: true,
        });
      }
    }
  }

  // Finalize batch through standard server-side validation & duplicate checking
  const finalized = finalizeScheduleBatch(rawMergedCandidates, existingCourses, userMappings, {
    layoutKind: layoutKind || "unas_8col_table",
    hasRecognizedHeaders: true,
  });

  return finalized.map((it) => ({
    ...it,
    extractionSource: it.extractionSource || "vision_fallback",
  }));
}

/**
 * Unified entry point supporting OCR words (bounding boxes), TSV, blocks, and plain text.
 */
export function parseScheduleData(
  input: {
    text?: string;
    words?: OcrWord[];
    tsv?: string;
    blocks?: any[];
  },
  existingCourses: ExistingSchedule[] = [],
  userMappings: UserScheduleMapping[] = []
): ParsedScheduleItem[] {
  return recognizeScheduleData(input, existingCourses, userMappings).items;
}

function isHeaderTextLine(line: string): boolean {
  const clean = line.toLowerCase().replace(/[|\t,;()]+/g, " ").replace(/\s+/g, " ").trim();
  // Exclude document titles like "KARTU RENCANA STUDI (KRS) SEMESTER GANJIL"
  if (/\bkartu\s+rencana\s+studi\b/.test(clean) && !/\bhari\b/.test(clean) && !/\bmulai\b/.test(clean)) {
    return false;
  }
  let matches = 0;
  if (/\bhari\b/.test(clean)) matches++;
  if (/\b(mulai|start)\b/.test(clean)) matches++;
  if (/\b(akhir|selesai|end)\b/.test(clean)) matches++;
  if (/\b(jam|waktu|pukul)\b/.test(clean)) matches++;
  if (/\b(ruang|ruangan|lokasi)\b/.test(clean)) matches++;
  if (/\b(kode\s*mk|kodemk|kode)\b/.test(clean)) matches++;
  if (/\b(kls|kelas)\b/.test(clean)) matches++;
  if (/\b(nama\s*mk|mata\s*kuliah|matakuliah|kegiatan|kursus|mata\s*pelajaran|mapel)\b/.test(clean)) matches++;
  if (/\bsks\b/.test(clean)) matches++;
  if (/\b(dosen|pengajar|guru|instruktur)\b/.test(clean)) matches++;
  return matches >= 3;
}

/**
 * Parses pipe-delimited (|) or tab-delimited (\t) schedule lines, supporting multi-line continuation cells,
 * UNAS 8-column tables, combined start/end time tables, and simpler weekday/time/course tables.
 */
function parseDelimitedTableLines(
  lines: string[],
  existingCourses: ExistingSchedule[],
  userMappings: UserScheduleMapping[],
  layout?: LayoutDetectionResult
): ParsedScheduleItem[] {
  const delimiter = lines.some((l) => (l.match(/\|/g) || []).length >= 2) ? "|" : "\t";
  let columnMap: TableColumnField[] = [
    "hari",
    "waktuMulai",
    "waktuSelesai",
    "lokasi",
    "kodeMatkul",
    "kelas",
    "namaMatkul",
    "sks",
  ];
  let hasRecognizedHeader = false;

  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isHeaderTextLine(lines[i])) {
      const rawCells = splitDelimitedRow(lines[i], delimiter, 0);
      const detectedMap = rawCells.map((cell) => classifyHeaderPhrase(cell) || "ignore");
      if (detectedMap.filter((f) => f !== "ignore").length >= 3) {
        columnMap = detectedMap;
        hasRecognizedHeader = true;
      }
      startIdx = i + 1;
      break;
    }
  }

  interface DelimitedRowAccum {
    cells: Record<TableColumnField, string[]>;
    rawLines: string[];
  }

  const rows: DelimitedRowAccum[] = [];
  let lastValidHari = "";

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(delimiter)) {
      // Continuation line without delimiter -> append to last row's namaMatkul
      if (rows.length > 0 && !isHeaderTextLine(line)) {
        rows[rows.length - 1].cells.namaMatkul.push(line);
        rows[rows.length - 1].rawLines.push(line);
      }
      continue;
    }

    // Skip markdown separator lines like |---|---|---|
    if (/^[\s|:-]+$/.test(line)) continue;
    if (isHeaderTextLine(line)) continue;

    const parts = splitDelimitedRow(line, delimiter, columnMap.length);
    const cellMap: Record<TableColumnField, string> = {
      hari: "",
      waktuMulai: "",
      waktuSelesai: "",
      waktuGabungan: "",
      lokasi: "",
      kodeMatkul: "",
      kelas: "",
      namaMatkul: "",
      sks: "",
      dosen: "",
      ignore: "",
    };

    // If no header was present and the row has fewer columns (e.g. 3-5 columns: Hari | Jam | Mata Kuliah | Ruang | SKS),
    // dynamically infer column mapping from cell contents
    if (!hasRecognizedHeader && parts.length >= 3 && parts.length <= 6) {
      for (const part of parts) {
        const pair = extractTimePairFromCell(part);
        if (!cellMap.hari && normalizeHari(part, userMappings)) {
          cellMap.hari = part;
        } else if (pair && pair.waktuMulai && pair.waktuSelesai && !cellMap.waktuMulai) {
          cellMap.waktuMulai = pair.rawMulai;
          cellMap.waktuSelesai = pair.rawSelesai;
        } else if (!cellMap.waktuMulai && normalizeTime(part)) {
          cellMap.waktuMulai = part;
        } else if (cellMap.waktuMulai && !cellMap.waktuSelesai && normalizeTime(part)) {
          cellMap.waktuSelesai = part;
        } else if (!cellMap.kodeMatkul && normalizeCourseCode(part, userMappings)) {
          cellMap.kodeMatkul = part;
        } else if (!cellMap.kelas && normalizeClassLabel(part, userMappings)) {
          cellMap.kelas = part;
        } else if (!cellMap.sks && /^[1-8](?:\s*sks)?$/i.test(part)) {
          cellMap.sks = part;
        } else if (!cellMap.namaMatkul && part.length >= 3) {
          cellMap.namaMatkul = part;
        } else if (!cellMap.lokasi && part.length >= 2) {
          cellMap.lokasi = part;
        }
      }
    } else {
      for (let c = 0; c < parts.length; c++) {
        const field = columnMap[c] || "ignore";
        if (field !== "ignore" && parts[c]) {
          cellMap[field] = cellMap[field] ? `${cellMap[field]} ${parts[c]}` : parts[c];
        }
      }
    }

    if (cellMap.waktuGabungan) {
      const pair = extractTimePairFromCell(cellMap.waktuGabungan);
      if (pair) {
        if (!cellMap.waktuMulai) cellMap.waktuMulai = pair.rawMulai;
        if (!cellMap.waktuSelesai) cellMap.waktuSelesai = pair.rawSelesai;
      }
    }

    const hasTime =
      normalizeTime(cellMap.waktuMulai) !== null || normalizeTime(cellMap.waktuSelesai) !== null;
    const hasCode = normalizeCourseCode(cellMap.kodeMatkul, userMappings) !== null;
    const hasDay = normalizeHari(cellMap.hari, userMappings) !== null;

    if (!hasTime && !hasCode && !hasDay && rows.length > 0) {
      // Multi-line continuation row in delimited table
      const prev = rows[rows.length - 1];
      for (const f of Object.keys(cellMap) as TableColumnField[]) {
        if (cellMap[f]) prev.cells[f].push(cellMap[f]);
      }
      prev.rawLines.push(line);
    } else {
      const accum: DelimitedRowAccum = {
        cells: {
          hari: cellMap.hari ? [cellMap.hari] : [],
          waktuMulai: cellMap.waktuMulai ? [cellMap.waktuMulai] : [],
          waktuSelesai: cellMap.waktuSelesai ? [cellMap.waktuSelesai] : [],
          waktuGabungan: cellMap.waktuGabungan ? [cellMap.waktuGabungan] : [],
          lokasi: cellMap.lokasi ? [cellMap.lokasi] : [],
          kodeMatkul: cellMap.kodeMatkul ? [cellMap.kodeMatkul] : [],
          kelas: cellMap.kelas ? [cellMap.kelas] : [],
          namaMatkul: cellMap.namaMatkul ? [cellMap.namaMatkul] : [],
          sks: cellMap.sks ? [cellMap.sks] : [],
          dosen: cellMap.dosen ? [cellMap.dosen] : [],
          ignore: [],
        },
        rawLines: [line],
      };
      rows.push(accum);
    }
  }

  const rawItems: Partial<ParsedScheduleItem>[] = [];
  const effectiveLayoutKind = layout?.kind || classifyColumnsToLayout(columnMap).kind;

  for (const r of rows) {
    const rawHari = r.cells.hari.join(" ").trim();
    const rawMulai = r.cells.waktuMulai.join(" ").trim();
    const rawSelesai = r.cells.waktuSelesai.join(" ").trim();
    const rawLokasi = r.cells.lokasi.join(" ").trim();
    const rawKode = r.cells.kodeMatkul.join(" ").trim();
    const rawKelas = r.cells.kelas.join(" ").trim();
    const rawNama = r.cells.namaMatkul.join(" ").trim();
    const rawSks = r.cells.sks.join(" ").trim();
    const rawDosen = r.cells.dosen.join(" ").trim();

    const appliedCorrections: string[] = [];
    const warnings: string[] = [];

    let normalizedHari = normalizeHari(rawHari, userMappings);
    if (!normalizedHari && !rawHari && lastValidHari && (rawMulai || rawSelesai)) {
      normalizedHari = lastValidHari;
      appliedCorrections.push(`Hari '${normalizedHari}' diteruskan dari baris jadwal sebelumnya.`);
    }
    if (normalizedHari) {
      if (rawHari && normalizedHari.toLowerCase() !== rawHari.toLowerCase()) {
        appliedCorrections.push(`Hari dinormalisasi: '${rawHari}' → '${normalizedHari}'`);
      }
      lastValidHari = normalizedHari;
    }

    const waktuMulai = normalizeTime(rawMulai) || "";
    const waktuSelesai = normalizeTime(rawSelesai) || "";

    let kodeMatkul: string | null = null;
    if (rawKode) {
      const codeNorm = normalizeCourseCode(rawKode, userMappings);
      if (codeNorm) {
        kodeMatkul = codeNorm.code;
        if (codeNorm.wasCorrected) {
          appliedCorrections.push(`Kode MK diperbaiki dari OCR: '${rawKode}' → '${codeNorm.code}'`);
        }
      } else {
        kodeMatkul = rawKode;
        warnings.push(`Format Kode MK '${rawKode}' tampak tidak standar. Harap periksa kembali.`);
      }
    }

    let kelas: string | null = null;
    if (rawKelas) {
      const klsNorm = normalizeClassLabel(rawKelas, userMappings);
      if (klsNorm) {
        kelas = klsNorm.kelas;
        if (klsNorm.wasCorrected) {
          appliedCorrections.push(`Label kelas dinormalisasi: '${rawKelas}' → '${klsNorm.kelas}'`);
        }
      } else {
        kelas = rawKelas;
      }
    }

    let sks: number | null = null;
    if (rawSks) {
      const m = rawSks.match(/\d+/);
      if (m) sks = parseInt(m[0], 10);
    }

    rawItems.push({
      namaMatkul: cleanCourseName(rawNama),
      hari: normalizedHari || "",
      waktuMulai,
      waktuSelesai,
      lokasi: cleanRoomName(rawLokasi) || null,
      kodeMatkul,
      kelas,
      sks,
      dosen: rawDosen || null,
      kategori: "Wajib",
      rawText: r.rawLines.join(" "),
      rawFields: {
        hari: rawHari,
        waktuMulai: rawMulai,
        waktuSelesai: rawSelesai,
        lokasi: rawLokasi,
        kodeMatkul: rawKode,
        kelas: rawKelas,
        namaMatkul: rawNama,
        sks: rawSks,
        dosen: rawDosen,
      },
      layoutKind: effectiveLayoutKind,
      appliedCorrections,
      warnings,
    });
  }

  return finalizeScheduleBatch(rawItems, existingCourses, userMappings, {
    layoutKind: effectiveLayoutKind,
    hasRecognizedHeaders: hasRecognizedHeader,
  });
}

function splitDelimitedRow(line: string, delimiter: string, expectedCols = 0): string[] {
  const parts = line.split(delimiter).map((p) => p.trim());
  if (delimiter === "|") {
    // Only strip outer empty strings if the row has markdown outer borders (e.g. | a | b | -> expectedCols + 2)
    // or if expectedCols is 0 (header detection) and both ends are empty
    if (expectedCols > 0) {
      if (parts.length > expectedCols && parts[0] === "") parts.shift();
      if (parts.length > expectedCols && parts[parts.length - 1] === "") parts.pop();
    } else {
      if (parts.length > 2 && parts[0] === "" && parts[parts.length - 1] === "") {
        parts.shift();
        parts.pop();
      }
    }
  }
  return parts;
}

/**
 * Parses space-separated tabular schedule lines (such as UNAS SIAKAD OCR rows:
 * "Selasa 09:50:00 11:30:00 D.302 VA IF253418 R.03 Etika Profesi Teknologi Informasi 2")
 * including multi-line wrapped cells.
 */
function parseTabularTextLines(
  lines: string[],
  existingCourses: ExistingSchedule[],
  userMappings: UserScheduleMapping[],
  layout?: LayoutDetectionResult
): ParsedScheduleItem[] {
  const hasHeader = lines.some((l) => isHeaderTextLine(l));

  // Pattern for a line that has two time tokens (Mulai & Akhir) with or without a hyphen
  const twoTimesRegex =
    /\b([0-9OQoIl|SBZ]{1,2}[:.][0-9OQoIl|SBZ]{2}(?:[:.][0-9OQoIl|SBZ]{2})?)\s*(?:-|–|—|s\.?d\.?|sampai|to)?\s+([0-9OQoIl|SBZ]{1,2}[:.][0-9OQoIl|SBZ]{2}(?:[:.][0-9OQoIl|SBZ]{2})?)\b/i;

  const hasCourseCodeAnywhere = lines.some((l) =>
    l
      .split(/\s+/)
      .some((tok) => normalizeCourseCode(tok, userMappings) !== null)
  );
  const hasHmsTime = lines.some((l) => /\b\d{1,2}[:.]\d{2}[:.]\d{2}\b/.test(l));
  const linesWithDayAndTimePair = lines.filter((l) => {
    const tm = l.match(twoTimesRegex);
    const hasPair = Boolean(tm && normalizeTime(tm[1]) && normalizeTime(tm[2]));
    const firstTok = l.split(/\s+/)[0] || "";
    return hasPair && Boolean(normalizeHari(firstTok, userMappings));
  });

  // Exclude traditional multi-line KRS format ("1. Course\nSenin ... 3 SKS Ruang ..." or "Course\nSenin ... 3 SKS Ruang ...")
  // when there is no table header and no HH:mm:ss time
  const hasPrecedingCourseTitleLine = lines.some((l, idx) => {
    if (isHeaderTextLine(l) || /^(?:jadwal\s+kuliah|kartu\s+rencana\s+studi)/i.test(l)) return false;
    const tm = l.match(twoTimesRegex);
    const hasPair = Boolean(tm && normalizeTime(tm[1]) && normalizeTime(tm[2]));
    if (hasPair) return false;
    const nextLine = lines[idx + 1] || "";
    const nextTm = nextLine.match(twoTimesRegex);
    return Boolean(nextTm && normalizeTime(nextTm[1]) && normalizeTime(nextTm[2]));
  });
  const isTraditionalKrsFormat =
    lines.some((l) => /\b(?:Dosen|Pengajar)\s*:/i.test(l)) ||
    lines.some((l) => /^\d+\.\s+[A-Za-z]/.test(l) && !twoTimesRegex.test(l)) ||
    hasPrecedingCourseTitleLine;
  if (
    (!hasHeader && !hasCourseCodeAnywhere && !hasHmsTime && linesWithDayAndTimePair.length === 0) ||
    (!hasHeader && isTraditionalKrsFormat && !hasHmsTime)
  ) {
    return [];
  }

  // Group lines into logical tabular row blocks:
  // An anchor line has `twoTimesRegex` (where both times normalize validly) OR (starts with a valid weekday + has 1 time/code)
  const rowBlocks: string[][] = [];

  for (const line of lines) {
    if (isHeaderTextLine(line)) continue;
    // Skip pure page titles/headers like "JADWAL KULIAH"
    if (/^(?:jadwal\s+kuliah|kartu\s+rencana\s+studi)/i.test(line) && !twoTimesRegex.test(line)) {
      continue;
    }

    const tm = line.match(twoTimesRegex);
    const hasValidTimePair = Boolean(tm && normalizeTime(tm[1]) && normalizeTime(tm[2]));

    const tokens = line.split(/\s+/);
    const firstHari = tokens.length > 0 ? normalizeHari(tokens[0], userMappings) : null;
    const secondTime = tokens.length > 1 ? normalizeTime(tokens[1]) : null;
    const hasCodeInLine = tokens.some((tok) => normalizeCourseCode(tok, userMappings) !== null);

    const isRowStart = hasValidTimePair || Boolean(firstHari && (secondTime || hasCodeInLine));

    if (isRowStart) {
      rowBlocks.push([line]);
    } else if (rowBlocks.length > 0) {
      // Continuation line of a wrapped table row (e.g. "Science" or "Informatika 3")
      rowBlocks[rowBlocks.length - 1].push(line);
    }
  }

  if (rowBlocks.length === 0) return [];

  const rawItems: Partial<ParsedScheduleItem>[] = [];
  let lastValidHari = "";
  const effectiveLayoutKind: ScheduleLayoutKind =
    layout?.kind && layout.kind !== "unstructured_fallback"
      ? layout.kind
      : hasCourseCodeAnywhere || hasHmsTime
      ? "unas_8col_table"
      : "simple_schedule_table";

  for (const block of rowBlocks) {
    const joined = block.join(" ").replace(/\s+/g, " ").trim();
    const tokens = joined.split(" ").filter(Boolean);
    if (tokens.length < 2) continue;

    const appliedCorrections: string[] = [];
    const warnings: string[] = [];

    let cursor = 0;
    // Optional leading row number "1" or "1."
    if (/^\d+\.?$/.test(tokens[cursor]) && tokens.length > 3) {
      const nextHari = normalizeHari(tokens[cursor + 1], userMappings);
      const nextTime = normalizeTime(tokens[cursor + 1]);
      if (nextHari || nextTime) {
        cursor++;
      }
    }

    // 1. Extract Hari
    let rawHari = "";
    let normalizedHari: string | null = null;
    if (cursor < tokens.length) {
      const maybeHari = normalizeHari(tokens[cursor], userMappings);
      if (maybeHari) {
        rawHari = tokens[cursor];
        normalizedHari = maybeHari;
        if (rawHari.toLowerCase() !== maybeHari.toLowerCase()) {
          appliedCorrections.push(`Hari dinormalisasi: '${rawHari}' → '${maybeHari}'`);
        }
        lastValidHari = maybeHari;
        cursor++;
      }
    }

    // 2. Find Start Time and End Time (either two separate tokens or combined token like "08:00-10:30")
    let rawMulai = "";
    let rawSelesai = "";
    let waktuMulai = "";
    let waktuSelesai = "";

    while (cursor < tokens.length) {
      const combinedPair = extractTimePairFromCell(tokens[cursor]);
      if (combinedPair) {
        rawMulai = combinedPair.rawMulai;
        rawSelesai = combinedPair.rawSelesai;
        waktuMulai = combinedPair.waktuMulai;
        waktuSelesai = combinedPair.waktuSelesai;
        cursor++;
        break;
      }

      const t1 = normalizeTime(tokens[cursor]);
      if (t1) {
        rawMulai = tokens[cursor];
        waktuMulai = t1;
        cursor++;
        // Skip optional separator '-', 's/d', 'to'
        if (cursor < tokens.length && /^(?:-|–|—|s\.?d\.?|sampai|to)$/i.test(tokens[cursor])) {
          cursor++;
        }
        if (cursor < tokens.length) {
          const t2 = normalizeTime(tokens[cursor]);
          if (t2) {
            rawSelesai = tokens[cursor];
            waktuSelesai = t2;
            cursor++;
          }
        }
        break;
      }
      cursor++;
    }

    if (!normalizedHari && !rawHari && lastValidHari && (waktuMulai || waktuSelesai)) {
      normalizedHari = lastValidHari;
      appliedCorrections.push(`Hari '${normalizedHari}' diteruskan dari baris jadwal sebelumnya.`);
    }

    // Remaining tokens after End Time: [Ruang...] [Kode MK] [Kls] [Nama MK...] [SKS]
    const remTokens = tokens.slice(cursor);

    // Locate Kode MK token in remTokens
    let codeIdx = -1;
    let codeResult: { code: string; raw: string; wasCorrected: boolean } | null = null;
    for (let i = 0; i < remTokens.length; i++) {
      const cr = normalizeCourseCode(remTokens[i], userMappings);
      if (cr) {
        codeIdx = i;
        codeResult = cr;
        break;
      }
    }

    let rawLokasi = "";
    let rawKode = "";
    let kodeMatkul: string | null = null;
    let rawKelas = "";
    let kelas: string | null = null;
    let rawNama = "";
    let rawSks = "";
    let sks: number | null = null;

    if (codeIdx !== -1 && codeResult) {
      // Everything before codeIdx is Ruang
      rawLokasi = remTokens.slice(0, codeIdx).join(" ").trim();
      rawKode = codeResult.raw;
      kodeMatkul = codeResult.code;
      if (codeResult.wasCorrected) {
        appliedCorrections.push(`Kode MK diperbaiki dari OCR: '${rawKode}' → '${kodeMatkul}'`);
      }

      let afterCodeIdx = codeIdx + 1;
      // Check if the token right after Kode MK is Kls (e.g. R.03, R.01, A.01)
      if (afterCodeIdx < remTokens.length) {
        const klsNorm = normalizeClassLabel(remTokens[afterCodeIdx], userMappings);
        if (klsNorm) {
          rawKelas = klsNorm.raw;
          kelas = klsNorm.kelas;
          if (klsNorm.wasCorrected) {
            appliedCorrections.push(`Label kelas dinormalisasi: '${rawKelas}' → '${kelas}'`);
          }
          afterCodeIdx++;
        }
      }

      const tailTokens = remTokens.slice(afterCodeIdx);
      // Check trailing SKS at the end of tailTokens (e.g. "... 2" or "... 3 SKS")
      if (tailTokens.length > 0) {
        const lastTok = tailTokens[tailTokens.length - 1];
        const secondLastTok = tailTokens.length > 1 ? tailTokens[tailTokens.length - 2] : "";
        if (/^(?:sks|kredit)$/i.test(lastTok) && /^\d+$/.test(secondLastTok)) {
          rawSks = `${secondLastTok} ${lastTok}`;
          sks = parseInt(secondLastTok, 10);
          tailTokens.pop();
          tailTokens.pop();
        } else if (/^\d+$/.test(lastTok)) {
          rawSks = lastTok;
          sks = parseInt(lastTok, 10);
          tailTokens.pop();
        }
      }

      rawNama = tailTokens.join(" ").trim();
    } else {
      // No Kode MK found: check if Kls (e.g. R.03) is present as an anchor between Ruang and Nama MK
      let klsIdx = -1;
      let klsResult: { kelas: string; raw: string; wasCorrected: boolean } | null = null;
      for (let i = 0; i < remTokens.length; i++) {
        const kr = normalizeClassLabel(remTokens[i], userMappings);
        if (kr) {
          klsIdx = i;
          klsResult = kr;
          break;
        }
      }

      if (klsIdx !== -1 && klsResult) {
        rawLokasi = remTokens.slice(0, klsIdx).join(" ").trim();
        rawKelas = klsResult.raw;
        kelas = klsResult.kelas;
        const tailTokens = remTokens.slice(klsIdx + 1);
        if (tailTokens.length > 0 && /^\d+$/.test(tailTokens[tailTokens.length - 1])) {
          rawSks = tailTokens.pop()!;
          sks = parseInt(rawSks, 10);
        }
        rawNama = tailTokens.join(" ").trim();
      } else {
        // Fallback within simple tabular row (e.g., "Senin 08:00 - 10:30 Pemrograman Web Ruang Lab-2 3 SKS")
        const tailTokens = [...remTokens];
        if (tailTokens.length > 1 && /^(?:sks|kredit)$/i.test(tailTokens[tailTokens.length - 1]) && /^\d+$/.test(tailTokens[tailTokens.length - 2])) {
          const lastTok = tailTokens.pop()!;
          const numTok = tailTokens.pop()!;
          rawSks = `${numTok} ${lastTok}`;
          sks = parseInt(numTok, 10);
        } else if (tailTokens.length > 0 && /^\d+$/.test(tailTokens[tailTokens.length - 1])) {
          rawSks = tailTokens.pop()!;
          sks = parseInt(rawSks, 10);
        }

        const joinedTail = tailTokens.join(" ").trim();
        const ruangMatch = joinedTail.match(/\b((?:Ruang|Ruangan|Lab\.?|Gedung|Room)\s+[A-Za-z0-9.-]+(?:\s+[A-Za-z0-9.-]+)?)$/i);
        if (ruangMatch) {
          rawLokasi = ruangMatch[1].trim();
          rawNama = joinedTail.slice(0, ruangMatch.index).trim();
        } else {
          rawNama = joinedTail;
        }
      }
    }

    rawItems.push({
      namaMatkul: cleanCourseName(rawNama),
      hari: normalizedHari || "",
      waktuMulai,
      waktuSelesai,
      lokasi: cleanRoomName(rawLokasi) || null,
      kodeMatkul,
      kelas,
      sks,
      dosen: null,
      kategori: "Wajib",
      rawText: joined,
      rawFields: {
        hari: rawHari,
        waktuMulai: rawMulai,
        waktuSelesai: rawSelesai,
        lokasi: rawLokasi,
        kodeMatkul: rawKode,
        kelas: rawKelas,
        namaMatkul: rawNama,
        sks: rawSks,
      },
      layoutKind: effectiveLayoutKind,
      appliedCorrections,
      warnings,
    });
  }

  return finalizeScheduleBatch(rawItems, existingCourses, userMappings, {
    layoutKind: effectiveLayoutKind,
    hasRecognizedHeaders: hasHeader,
  });
}

/**
 * Parses traditional multi-line KRS / list schedule text:
 * e.g. "1. Pemrograman Web Lanjut\nSenin 08:00 - 10:30 3 SKS Ruang Lab-3 Dosen: Dr. Budi Santoso"
 */
function parseTraditionalKrsLines(
  lines: string[],
  existingCourses: ExistingSchedule[],
  userMappings: UserScheduleMapping[]
): ParsedScheduleItem[] {
  const timeRangeRegex =
    /(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s*(?:-|–|—|s\.?d\.?|sampai|to)\s*(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)/i;
  const hariRegex =
    /\b(Senin|Selasa|Rabu|Kamis|Jum'?at|Sabtu|Minggu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;
  const sksRegex = /\b(\d+)\s*(?:sks|credit|credits)\b/i;
  const ruangRegex = /\b(?:Ruang|Ruangan|Lab\.?|Gedung|Room)\s+[A-Za-z0-9.-]+/i;
  const dosenPrefixRegex = /\b(?:Dosen|Pengajar|Lecturer)\s*:\s*[^,;|]+/i;

  const rawItems: Partial<ParsedScheduleItem>[] = [];
  let currentItem: Partial<ParsedScheduleItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = line.match(timeRangeRegex);
    const hariMatch = line.match(hariRegex);

    if (timeMatch) {
      const startTime = normalizeTime(timeMatch[1]);
      const endTime = normalizeTime(timeMatch[2]);

      if (currentItem && (currentItem.namaMatkul || currentItem.waktuMulai)) {
        rawItems.push(currentItem);
        currentItem = null;
      }

      let title = "";
      let extractedSks: number | null = null;
      let extractedRuang: string | null = null;

      const sksMatch = line.match(sksRegex);
      if (sksMatch) {
        extractedSks = parseInt(sksMatch[1], 10);
      }

      const ruangMatch = line.match(ruangRegex);

      if (hariMatch && timeMatch) {
        const hariIdx = line.indexOf(hariMatch[0]);
        const timeIdx = line.indexOf(timeMatch[0]);
        const timeEndIdx = timeIdx + timeMatch[0].length;

        // Extract prefix before the day name
        let prefix = line.slice(0, hariIdx).trim();

        // Check standalone SKS digit right before the day name (e.g. "...Diskrit  2  Senin")
        const standaloneSksMatch = prefix.match(/\s+([1-8])\s*$/);
        if (standaloneSksMatch && extractedSks === null) {
          extractedSks = parseInt(standaloneSksMatch[1], 10);
          prefix = prefix.slice(0, prefix.length - standaloneSksMatch[0].length).trim();
        }

        // Strip leading numbering from prefix (e.g. "1   Matematika Diskrit" -> "Matematika Diskrit")
        prefix = prefix.replace(/^\d+[\s.)-]+\s*/, "").trim();
        if (prefix.length >= 2) {
          title = prefix;
        }

        // Extract room / location after the time range
        const suffix = line.slice(timeEndIdx).trim();
        if (suffix) {
          const candidateRoom = suffix.replace(/^[|;,\s-]+/, "").trim();
          if (candidateRoom && !/^(?:teori|praktek|wajib|pilihan)$/i.test(candidateRoom)) {
            extractedRuang = candidateRoom;
          }
        }
      }

      if (!extractedRuang && ruangMatch) {
        extractedRuang = ruangMatch[0].trim();
      }

      if (!title && hariMatch) {
        const stripped = line
          .replace(timeRangeRegex, "")
          .replace(hariRegex, "")
          .replace(sksRegex, "")
          .replace(dosenPrefixRegex, "")
          .replace(ruangRegex, "")
          .replace(/[,;|]/g, " ")
          .replace(/^\d+[\s.)-]+\s*/, "")
          .replace(/^[:.\s-]+/, "")
          .trim();
        if (stripped.length > 2 && !/^(?:sks|ruang|lab|dosen|gedung|teori|praktek)$/i.test(stripped)) {
          title = stripped;
        }
      }

      if (!title && i > 0) {
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prev = lines[j];
          if (
            !prev.match(timeRangeRegex) &&
            !prev.match(/^[\d\s.,-]+$/) &&
            !prev.match(/^(?:kartu\s+rencana\s+studi|jadwal\s+kuliah)/i) &&
            prev.length > 3
          ) {
            title = prev.replace(/^\d+[\s.)-]+\s*/, "").trim();
            break;
          }
        }
      }

      const hari = hariMatch ? normalizeHari(hariMatch[1], userMappings) : null;
      const dosenMatch = line.match(/\b(?:Dosen|Pengajar|Lecturer)\s*:\s*([^,;|]+)/i);

      currentItem = {
        namaMatkul: cleanCourseName(title),
        hari: hari || "",
        waktuMulai: startTime || "",
        waktuSelesai: endTime || "",
        sks: extractedSks,
        lokasi: extractedRuang ? cleanRoomName(extractedRuang) : null,
        dosen: dosenMatch ? dosenMatch[1].trim() : null,
        kategori: "Wajib",
        rawText: title ? `${title} | ${line}` : line,
        rawFields: {
          namaMatkul: title,
          hari: hariMatch ? hariMatch[1] : "",
          waktuMulai: timeMatch[1],
          waktuSelesai: timeMatch[2],
          sks: extractedSks ? String(extractedSks) : "",
          lokasi: extractedRuang || "",
          dosen: dosenMatch ? dosenMatch[1].trim() : "",
        },
        layoutKind: "traditional_krs_text",
        appliedCorrections: [],
        warnings: [],
      };
    } else if (currentItem) {
      const dosenMatch =
        line.match(/\b(?:Dosen|Pengajar|Lecturer)\s*:\s*([^,;|]+)/i) ||
        line.match(/\b(?:Prof\.|Dr\.|Ir\.|M\.[A-Z]|S\.[A-Z])[^\n,]+/);
      if (dosenMatch && !currentItem.dosen) {
        currentItem.dosen = (dosenMatch[1] || dosenMatch[0])
          .replace(/^(?:Dosen|Pengajar)\s*:\s*/i, "")
          .trim();
        if (currentItem.rawFields) currentItem.rawFields.dosen = currentItem.dosen;
      }

      const ruangMatch = line.match(ruangRegex);
      if (ruangMatch && !currentItem.lokasi) {
        currentItem.lokasi = ruangMatch[0].trim();
        if (currentItem.rawFields) currentItem.rawFields.lokasi = currentItem.lokasi;
      }

      const hariMatchSecondary = line.match(hariRegex);
      if (hariMatchSecondary && !currentItem.hari) {
        currentItem.hari = normalizeHari(hariMatchSecondary[1], userMappings) || "";
        if (currentItem.rawFields) currentItem.rawFields.hari = hariMatchSecondary[1];
      }
    }
  }

  if (currentItem && (currentItem.namaMatkul || currentItem.waktuMulai)) {
    rawItems.push(currentItem);
  }

  if (rawItems.length === 0) return [];
  return finalizeScheduleBatch(rawItems, existingCourses, userMappings, {
    layoutKind: "traditional_krs_text",
    hasRecognizedHeaders: false,
  });
}

/**
 * Requirement 2.9 & 4: Builds reviewable candidate items when table structure cannot be reliably recovered
 * from non-empty OCR text, preventing a misleading empty result.
 */
function buildFallbackReviewItems(
  lines: string[],
  existingCourses: ExistingSchedule[],
  userMappings: UserScheduleMapping[]
): ParsedScheduleItem[] {
  const meaningfulLines = lines.filter(
    (l) => !isHeaderTextLine(l) && l.replace(/[^a-zA-Z0-9]/g, "").length >= 3
  );
  if (meaningfulLines.length === 0) return [];

  const candidateItems: Partial<ParsedScheduleItem>[] = [];

  for (const line of meaningfulLines.slice(0, 15)) {
    const tokens = line.split(/\s+/);
    let foundHari = "";
    const foundTimes: string[] = [];
    let foundCode: string | null = null;
    let foundKelas: string | null = null;
    const remainingWords: string[] = [];

    for (const tok of tokens) {
      const h = !foundHari ? normalizeHari(tok, userMappings) : null;
      if (h) {
        foundHari = h;
        continue;
      }
      const t = normalizeTime(tok);
      if (t && foundTimes.length < 2) {
        foundTimes.push(t);
        continue;
      }
      const c: { code: string; raw: string; wasCorrected: boolean } | null = !foundCode
        ? normalizeCourseCode(tok, userMappings)
        : null;
      if (c) {
        foundCode = c.code;
        continue;
      }
      const k: { kelas: string; raw: string; wasCorrected: boolean } | null = !foundKelas
        ? normalizeClassLabel(tok, userMappings)
        : null;
      if (k) {
        foundKelas = k.kelas;
        continue;
      }
      remainingWords.push(tok);
    }

    let sks: number | null = null;
    if (remainingWords.length > 0 && /^[1-8]$/.test(remainingWords[remainingWords.length - 1])) {
      sks = parseInt(remainingWords.pop()!, 10);
    }

    const residualText = cleanCourseName(remainingWords.join(" "));

    candidateItems.push({
      namaMatkul: residualText,
      hari: foundHari,
      waktuMulai: foundTimes[0] || "",
      waktuSelesai: foundTimes[1] || "",
      lokasi: null,
      kodeMatkul: foundCode,
      kelas: foundKelas,
      sks,
      dosen: null,
      kategori: "Wajib",
      rawText: line,
      rawFields: { rawLine: line },
      layoutKind: "unstructured_fallback",
      appliedCorrections: [],
      warnings: [
        "Struktur tabel tidak terbaca secara utuh. Harap periksa dan lengkapi kolom sebelum menyimpan.",
      ],
      needsReview: true,
    });
  }

  return finalizeScheduleBatch(candidateItems, existingCourses, userMappings, {
    layoutKind: "unstructured_fallback",
    hasRecognizedHeaders: false,
  });
}

function cleanCourseName(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^\d+[\s.-]+/, "") // remove leading numbering "1. ", "01 - "
    .replace(/\[.*?\]|\(.*?\)/g, (match) => {
      return match.match(/teori|praktek|praktikum|lab/i) ? match : "";
    })
    .replace(/[;|\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRoomName(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/[;|\t]+/g, " ")
    .replace(/\bLab\s*\.\s*/gi, "Lab. ")
    .replace(/\b([A-Z])\s*\.\s*(\d{3})/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Applies user-confirmed correction mappings when context matches and confidence is sufficient.
 * Distinguishes high-confidence confirmed mappings from moderate-confidence tentative suggestions,
 * preventing aggressive fuzzy matches or conflicting course codes from silently selecting the wrong course.
 */
export function applyConfirmedMappings(
  item: Partial<ParsedScheduleItem>,
  userMappings: UserScheduleMapping[]
): Partial<ParsedScheduleItem> {
  if (!userMappings || userMappings.length === 0) return item;

  const updated = { ...item };
  const applied = [...(updated.appliedCorrections || [])];
  const warnings = [...(updated.warnings || [])];
  const tentativeSuggestions: Partial<Record<ScheduleFieldKey, string>> = {
    ...(updated.tentativeSuggestions || {}),
  };
  const confirmedFields = new Set<ScheduleFieldKey>();
  const conflictReasons: Partial<Record<ScheduleFieldKey, string>> = {};

  // 1. Apply field-specific mappings (kodeMatkul, lokasi, namaMatkul, kelas, hari)
  const applyFieldMap = (
    field: MappingFieldType,
    scheduleKey: ScheduleFieldKey,
    currentVal: string | null | undefined,
    minConfirmedSimilarity = 0.90,
    minTentativeSimilarity = 0.72
  ): string | null => {
    if (!currentVal || !currentVal.trim()) return currentVal || null;
    const normCurrent = normalizeMappingKey(currentVal);

    // Exact match first
    for (const m of userMappings) {
      if (m.field === field && normalizeMappingKey(m.sourceKey) === normCurrent) {
        // Phase 7B: Check if mapping is flagged as ambiguous, in conflict, or user-disabled
        if (m.metadata?.isAmbiguous || m.metadata?.hasConflict || m.metadata?.isUserDisabled) {
          tentativeSuggestions[scheduleKey] = m.targetValue;
          updated.needsReview = true;
          const altMsg = m.metadata?.alternateTargets && m.metadata.alternateTargets.length > 0
            ? ` (alternatif lain: ${m.metadata.alternateTargets.join(', ')})`
            : '';
          const warn = `Koreksi tersimpan (${field}) memiliki variasi nilai: '${currentVal}' vs '${m.targetValue}'${altMsg}. Harap tinjau.`;
          if (!warnings.includes(warn)) warnings.push(warn);
          return currentVal;
        }

        // Phase 7B: Short token guard (< 3 chars, or location <= 3 chars like 'LAB') without context qualifier
        const isShort = normCurrent.length < 3 || (field === "lokasi" && normCurrent.length <= 3);
        if (isShort) {
          if (m.metadata?.contextQualifier) {
            const currentKode = (updated.kodeMatkul || updated.rawFields?.kodeMatkul || "").toLowerCase();
            const currentTitle = (updated.namaMatkul || updated.rawFields?.namaMatkul || "").toLowerCase();
            const q = m.metadata.contextQualifier.toLowerCase();
            const matchesContext =
              (currentKode && (currentKode.includes(q) || q.includes(currentKode))) ||
              (currentTitle && (currentTitle.includes(q) || q.includes(currentTitle)));
            if (!matchesContext) {
              tentativeSuggestions[scheduleKey] = m.targetValue;
              updated.needsReview = true;
              return currentVal;
            }
          } else {
            tentativeSuggestions[scheduleKey] = m.targetValue;
            updated.needsReview = true;
            const warn = `Token singkat '${currentVal}' (${field}) disarankan sebagai '${m.targetValue}'. Harap tinjau.`;
            if (!warnings.includes(warn)) warnings.push(warn);
            return currentVal;
          }
        }

        confirmedFields.add(scheduleKey);
        if (m.targetValue !== currentVal) {
          applied.push(`Koreksi tersimpan (${field}): '${currentVal}' → '${m.targetValue}'`);
        }
        return m.targetValue;
      }
    }

    // Fuzzy match for longer strings (namaMatkul / lokasi)
    if (normCurrent.length >= 5 && (field === "namaMatkul" || field === "lokasi")) {
      let bestMatch: UserScheduleMapping | null = null;
      let bestScore = 0;
      for (const m of userMappings) {
        if (m.field === field) {
          const score = computeTextSimilarity(currentVal, m.sourceKey);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = m;
          }
        }
      }
      if (bestMatch) {
        if (bestMatch.metadata?.isAmbiguous || bestMatch.metadata?.hasConflict || bestMatch.metadata?.isUserDisabled) {
          tentativeSuggestions[scheduleKey] = bestMatch.targetValue;
          updated.needsReview = true;
          return currentVal;
        }
        if (bestScore >= minConfirmedSimilarity) {
          confirmedFields.add(scheduleKey);
          if (bestMatch.targetValue !== currentVal) {
            applied.push(
              `Koreksi tersimpan (${field}, kemiripan ${Math.round(bestScore * 100)}%): '${currentVal}' → '${bestMatch.targetValue}'`
            );
          }
          return bestMatch.targetValue;
        } else if (bestScore >= minTentativeSimilarity && bestMatch.targetValue !== currentVal) {
          // Moderate similarity: do NOT silently replace; offer as a tentative suggestion
          tentativeSuggestions[scheduleKey] = bestMatch.targetValue;
        }
      }
    }

    return currentVal;
  };

  if (updated.hari) {
    const hNorm = normalizeMappingKey(updated.hari);
    if (userMappings.some((m) => m.field === "hari" && normalizeMappingKey(m.sourceKey) === hNorm)) {
      confirmedFields.add("hari");
    }
  }
  if (updated.kodeMatkul) {
    const rawKodeBefore = updated.rawFields?.kodeMatkul || updated.kodeMatkul;
    if (
      userMappings.some(
        (m) =>
          m.field === "kodeMatkul" &&
          (normalizeMappingKey(m.sourceKey) === normalizeMappingKey(rawKodeBefore) ||
            normalizeMappingKey(m.targetValue) === normalizeMappingKey(updated.kodeMatkul!))
      )
    ) {
      confirmedFields.add("kodeMatkul");
    }
    updated.kodeMatkul = applyFieldMap("kodeMatkul", "kodeMatkul", updated.kodeMatkul, 0.92, 0.85);
  }
  if (updated.lokasi) {
    updated.lokasi = applyFieldMap("lokasi", "lokasi", updated.lokasi, 0.90, 0.72);
  }
  if (updated.namaMatkul) {
    updated.namaMatkul = applyFieldMap("namaMatkul", "namaMatkul", updated.namaMatkul, 0.90, 0.72) || "";
  }
  if (updated.kelas) {
    updated.kelas = applyFieldMap("kelas", "kelas", updated.kelas, 0.92, 0.85);
  }

  // 2. Apply courseByCode mapping when kodeMatkul matches a user-confirmed course code
  if (updated.kodeMatkul) {
    const codeKey = normalizeMappingKey(updated.kodeMatkul);
    const codeMapping = userMappings.find(
      (m) => m.field === "courseByCode" && normalizeMappingKey(m.sourceKey) === codeKey
    );
    if (codeMapping) {
      confirmedFields.add("kodeMatkul");
      const targetName = codeMapping.metadata?.namaMatkul || codeMapping.targetValue;
      if (targetName) {
        const currentName = (updated.namaMatkul || "").trim();
        const similarity = currentName ? computeTextSimilarity(currentName, targetName) : 1;

        if (!currentName || currentName.length < 4 || similarity >= 0.62) {
          // Confirmed match: either course name was missing/truncated or matches the stored course name
          confirmedFields.add("namaMatkul");
          if (currentName !== targetName) {
            applied.push(
              `Nama MK dipulihkan dari Kode MK '${updated.kodeMatkul}': '${currentName || "(kosong)"}' → '${targetName}'`
            );
            updated.namaMatkul = targetName;
          }
          if (
            (updated.sks === null || updated.sks === undefined) &&
            typeof codeMapping.metadata?.sks === "number"
          ) {
            updated.sks = codeMapping.metadata.sks;
            confirmedFields.add("sks");
            applied.push(`SKS (${updated.sks}) dilengkapi dari Kode MK '${updated.kodeMatkul}'.`);
          }
        } else {
          // Requirement 3: Prevent overly aggressive course-code replacement when OCR course name is a different course!
          tentativeSuggestions.namaMatkul = targetName;
          const conflictMsg = `Kode MK '${updated.kodeMatkul}' tersimpan sebagai '${targetName}', tetapi teks baris terbaca '${currentName}'. Harap tinjau agar tidak salah memilih mata kuliah.`;
          conflictReasons.namaMatkul = conflictMsg;
          conflictReasons.kodeMatkul = conflictMsg;
          if (!warnings.includes(conflictMsg)) {
            warnings.push(conflictMsg);
          }
          updated.needsReview = true;
        }
      }
    }
  }

  updated.appliedCorrections = applied;
  updated.warnings = warnings;
  updated.tentativeSuggestions = tentativeSuggestions;
  const rawFieldsObj: Record<string, string> = { ...(updated.rawFields || {}) };
  rawFieldsObj._confirmedFields = JSON.stringify(Array.from(confirmedFields));
  rawFieldsObj._conflictReasons = JSON.stringify(conflictReasons);
  updated.rawFields = rawFieldsObj;
  return updated;
}

/**
 * Validates and finalizes a batch of parsed items, checking:
 * - User-confirmed mappings & tentative suggestions
 * - Per-field evidence-based confidence & review reasons
 * - Missing or uncertain fields (never silently inventing values)
 * - Start time < End time, valid weekday, reasonable SKS (1..8)
 * - Duplicate rows & intra-batch schedule overlaps
 * - Conflicts with existing database courses
 * - iOS-compatible snake_case aliases alongside camelCase
 */
function finalizeScheduleBatch(
  rawItems: Partial<ParsedScheduleItem>[],
  existingCourses: ExistingSchedule[],
  userMappings: UserScheduleMapping[],
  options?: {
    layoutKind?: ScheduleLayoutKind;
    hasRecognizedHeaders?: boolean;
  }
): ParsedScheduleItem[] {
  const finalized: ParsedScheduleItem[] = [];
  const batchLayoutKind: ScheduleLayoutKind = options?.layoutKind || "unas_8col_table";
  const hasHeaders = Boolean(options?.hasRecognizedHeaders);

  for (let idx = 0; idx < rawItems.length; idx++) {
    const mapped = applyConfirmedMappings(rawItems[idx], userMappings);
    const warnings: string[] = [...(mapped.warnings || [])];
    const appliedCorrections: string[] = [...(mapped.appliedCorrections || [])];
    const tentativeSuggestions: Partial<Record<ScheduleFieldKey, string>> = {
      ...(mapped.tentativeSuggestions || {}),
    };
    let needsReview = Boolean(mapped.needsReview);

    const rawFieldsInput = { ...(mapped.rawFields || {}) };
    let ocrConfMap: Partial<Record<ScheduleFieldKey, number | null>> = {};
    let confirmedFieldsList: ScheduleFieldKey[] = [];
    let conflictReasonsMap: Partial<Record<ScheduleFieldKey, string>> = {};

    try {
      if (rawFieldsInput._ocrConf) {
        ocrConfMap = JSON.parse(rawFieldsInput._ocrConf);
      }
    } catch {}
    try {
      if (rawFieldsInput._confirmedFields) {
        confirmedFieldsList = JSON.parse(rawFieldsInput._confirmedFields);
      }
    } catch {}
    try {
      if (rawFieldsInput._conflictReasons) {
        conflictReasonsMap = JSON.parse(rawFieldsInput._conflictReasons);
      }
    } catch {}

    delete rawFieldsInput._ocrConf;
    delete rawFieldsInput._confirmedFields;
    delete rawFieldsInput._conflictReasons;

    const confirmedSet = new Set<ScheduleFieldKey>(confirmedFieldsList);

    // 1. Validate namaMatkul (never invent "Mata Kuliah Baru")
    const namaMatkul = (mapped.namaMatkul || "").trim();
    if (!namaMatkul || namaMatkul.length < 3) {
      warnings.push("Nama mata kuliah belum terdeteksi jelas. Harap isi atau periksa kembali.");
      needsReview = true;
    }

    // 2. Validate hari (never invent "Senin")
    const rawHari = (mapped.hari || "").trim();
    const validHari = rawHari ? normalizeHari(rawHari, userMappings) : null;
    const hari = validHari || "";
    if (!hari) {
      warnings.push("Hari kuliah belum terdeteksi atau tidak valid. Silakan pilih hari.");
      needsReview = true;
    }

    // 3. Validate waktuMulai & waktuSelesai (never invent "08:00" - "10:00")
    const waktuMulai = mapped.waktuMulai ? normalizeTime(mapped.waktuMulai) || "" : "";
    const waktuSelesai = mapped.waktuSelesai ? normalizeTime(mapped.waktuSelesai) || "" : "";

    let timeOrderInvalid = false;
    if (!waktuMulai || !waktuSelesai) {
      warnings.push("Jam mulai atau jam selesai belum lengkap.");
      needsReview = true;
    } else if (waktuMulai >= waktuSelesai) {
      warnings.push("Waktu selesai harus lebih lambat dari waktu mulai.");
      needsReview = true;
      timeOrderInvalid = true;
    }

    // 4. Validate SKS (never silently invent 3 SKS; check reasonable range 1..8)
    let sks: number | null =
      typeof mapped.sks === "number" && !isNaN(mapped.sks) ? mapped.sks : null;
    let sksOutOfRange = false;
    if (sks === null) {
      warnings.push("Jumlah SKS belum terdeteksi. Harap periksa nilai SKS.");
      needsReview = true;
    } else if (sks < 1 || sks > 8) {
      warnings.push(`Jumlah SKS (${sks}) di luar rentang wajar (1–8 SKS). Harap periksa kembali.`);
      needsReview = true;
      sksOutOfRange = true;
    }

    const kodeMatkul = mapped.kodeMatkul ? mapped.kodeMatkul.trim() : null;
    const kelas = mapped.kelas ? mapped.kelas.trim() : null;
    const lokasi = mapped.lokasi ? mapped.lokasi.trim() : null;
    const dosen = mapped.dosen ? mapped.dosen.trim() : null;

    // 5. Compute field-level confidence based on concrete evidence
    const isFallbackLayout =
      (mapped.layoutKind || batchLayoutKind) === "unstructured_fallback";
    const baseSource: FieldConfidenceSource = hasHeaders
      ? "header_aligned_ocr"
      : isFallbackLayout
      ? "fallback_inferred"
      : "pattern_match";

    const buildConfidence = (
      field: ScheduleFieldKey,
      val: string | number | null,
      optionsField: {
        required: boolean;
        wasOcrRepaired?: boolean;
        invalidReason?: string;
        repairReviewReason?: string;
      }
    ): FieldConfidenceInfo => {
      const ocrConf = ocrConfMap[field] ?? null;
      const suggestion = tentativeSuggestions[field];
      const conflictReason = conflictReasonsMap[field];
      const isEmpty = val === null || val === undefined || String(val).trim() === "";

      if (conflictReason) {
        return {
          level: "low",
          source: "pattern_match",
          ocrConfidence: ocrConf,
          needsReview: true,
          reviewReason: conflictReason,
          tentativeSuggestion: suggestion,
        };
      }

      if (optionsField.invalidReason) {
        return {
          level: "low",
          source: isEmpty ? "missing" : baseSource,
          ocrConfidence: ocrConf,
          needsReview: true,
          reviewReason: optionsField.invalidReason,
          tentativeSuggestion: suggestion,
        };
      }

      if (isEmpty) {
        if (optionsField.required) {
          return {
            level: "low",
            source: "missing",
            ocrConfidence: ocrConf,
            needsReview: true,
            reviewReason: `Kolom ${field} wajib diisi dan belum terbaca dari dokumen.`,
            tentativeSuggestion: suggestion,
          };
        }
        return {
          level: "medium",
          source: "missing",
          ocrConfidence: ocrConf,
          needsReview: false,
          tentativeSuggestion: suggestion,
        };
      }

      if (confirmedSet.has(field)) {
        return {
          level: "confirmed",
          source: "user_mapping",
          ocrConfidence: ocrConf,
          needsReview: false,
          tentativeSuggestion: suggestion,
        };
      }

      if (ocrConf !== null && ocrConf < 55) {
        return {
          level: "low",
          source: baseSource,
          ocrConfidence: ocrConf,
          needsReview: true,
          reviewReason: `Keyakinan bacaan OCR rendah (${ocrConf}%) pada kolom ini. Harap periksa kembali.`,
          tentativeSuggestion: suggestion,
        };
      }

      if (isFallbackLayout) {
        return {
          level: "low",
          source: "fallback_inferred",
          ocrConfidence: ocrConf,
          needsReview: true,
          reviewReason: "Diekstrak tanpa struktur tabel yang jelas. Harap pastikan posisinya benar.",
          tentativeSuggestion: suggestion,
        };
      }

      if (optionsField.wasOcrRepaired) {
        const shouldReviewRepair = Boolean(optionsField.repairReviewReason);
        return {
          level: "medium",
          source: "ocr_normalized",
          ocrConfidence: ocrConf,
          needsReview: shouldReviewRepair,
          reviewReason: optionsField.repairReviewReason,
          tentativeSuggestion: suggestion,
        };
      }

      if (suggestion) {
        return {
          level: "medium",
          source: baseSource,
          ocrConfidence: ocrConf,
          needsReview: true,
          reviewReason: `Mirip dengan data tersimpan '${suggestion}'. Periksa apakah perlu menggunakan saran tersebut.`,
          tentativeSuggestion: suggestion,
        };
      }

      if (ocrConf !== null && ocrConf < 72) {
        return {
          level: "medium",
          source: baseSource,
          ocrConfidence: ocrConf,
          needsReview: ocrConf < 62,
          reviewReason:
            ocrConf < 62
              ? `Keyakinan OCR sedang (${ocrConf}%). Disarankan memeriksa ejaan.`
              : undefined,
          tentativeSuggestion: suggestion,
        };
      }

      return {
        level: "high",
        source: baseSource,
        ocrConfidence: ocrConf,
        needsReview: false,
      };
    };

    const hariCarriedOver = appliedCorrections.some((c) => c.includes("diteruskan dari baris"));
    const hariRepaired =
      Boolean(rawFieldsInput.hari) &&
      Boolean(hari) &&
      rawFieldsInput.hari.trim().toLowerCase() !== hari.toLowerCase();
    const kodeRepaired = appliedCorrections.some((c) => c.startsWith("Kode MK diperbaiki dari OCR"));
    const kodeNonStandard = warnings.some((w) => w.includes("Format Kode MK"));
    const kelasRepaired = appliedCorrections.some((c) => c.startsWith("Label kelas dinormalisasi"));
    const mulaiRepaired =
      Boolean(rawFieldsInput.waktuMulai) &&
      /[OQoIl|SBZ]/i.test(rawFieldsInput.waktuMulai);
    const selesaiRepaired =
      Boolean(rawFieldsInput.waktuSelesai) &&
      /[OQoIl|SBZ]/i.test(rawFieldsInput.waktuSelesai);

    const fieldConfidence: Record<ScheduleFieldKey, FieldConfidenceInfo> = {
      hari: buildConfidence("hari", hari, {
        required: true,
        wasOcrRepaired: hariRepaired || hariCarriedOver,
        invalidReason: !hari ? "Hari kuliah belum terdeteksi atau tidak valid." : undefined,
        repairReviewReason: hariCarriedOver
          ? `Hari '${hari}' diteruskan dari baris di atasnya. Pastikan sesuai jadwal.`
          : undefined,
      }),
      waktuMulai: buildConfidence("waktuMulai", waktuMulai, {
        required: true,
        wasOcrRepaired: mulaiRepaired,
        invalidReason: !waktuMulai
          ? "Jam mulai belum terdeteksi."
          : timeOrderInvalid
          ? "Jam mulai harus lebih awal dari jam selesai."
          : undefined,
        repairReviewReason: mulaiRepaired
          ? `Karakter jam mulai '${rawFieldsInput.waktuMulai}' dinormalisasi menjadi '${waktuMulai}'.`
          : undefined,
      }),
      waktuSelesai: buildConfidence("waktuSelesai", waktuSelesai, {
        required: true,
        wasOcrRepaired: selesaiRepaired,
        invalidReason: !waktuSelesai
          ? "Jam selesai belum terdeteksi."
          : timeOrderInvalid
          ? "Jam selesai harus lebih lambat dari jam mulai."
          : undefined,
        repairReviewReason: selesaiRepaired
          ? `Karakter jam selesai '${rawFieldsInput.waktuSelesai}' dinormalisasi menjadi '${waktuSelesai}'.`
          : undefined,
      }),
      kodeMatkul: buildConfidence("kodeMatkul", kodeMatkul, {
        required: false,
        wasOcrRepaired: kodeRepaired,
        invalidReason: kodeNonStandard
          ? `Format Kode MK '${kodeMatkul}' tidak standar.`
          : undefined,
        repairReviewReason: kodeRepaired
          ? `Kode MK diperbaiki dari '${rawFieldsInput.kodeMatkul}' menjadi '${kodeMatkul}'. Harap pastikan digit/huruf benar.`
          : undefined,
      }),
      namaMatkul: buildConfidence("namaMatkul", namaMatkul, {
        required: true,
        invalidReason:
          !namaMatkul || namaMatkul.length < 3
            ? "Nama mata kuliah belum lengkap atau terlalu pendek."
            : undefined,
      }),
      kelas: buildConfidence("kelas", kelas, {
        required: false,
        wasOcrRepaired: kelasRepaired,
      }),
      lokasi: buildConfidence("lokasi", lokasi, {
        required: false,
      }),
      sks: buildConfidence("sks", sks, {
        required: true,
        invalidReason:
          sks === null
            ? "Jumlah SKS belum terdeteksi."
            : sksOutOfRange
            ? `SKS (${sks}) berada di luar rentang wajar (1–8 SKS).`
            : undefined,
      }),
      dosen: buildConfidence("dosen", dosen, {
        required: false,
      }),
    };

    if (Object.values(fieldConfidence).some((fc) => fc.needsReview)) {
      needsReview = true;
    }

    // 6. Check conflicts with existing courses in DB
    if (hari && waktuMulai && waktuSelesai && waktuMulai < waktuSelesai) {
      for (const ec of existingCourses) {
        if (ec.hari.toLowerCase() === hari.toLowerCase()) {
          const ecMulai = formatTimeFromDate(ec.waktuMulai);
          const ecSelesai = formatTimeFromDate(ec.waktuSelesai);

          const hasOverlap = waktuMulai < ecSelesai && waktuSelesai > ecMulai;
          if (hasOverlap) {
            warnings.push(
              `Bentrok dengan mata kuliah terdaftar '${ec.namaMatkul}' (${ecMulai} - ${ecSelesai}).`
            );
            needsReview = true;
          }
        }
      }
    }

    const recognitionStatus: ParsedScheduleItem["recognitionStatus"] = needsReview
      ? "needs_review"
      : confirmedSet.size > 0
      ? "confirmed_assisted"
      : "high_confidence";

    finalized.push({
      id: mapped.id || `parsed_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      namaMatkul,
      hari,
      waktuMulai,
      waktuSelesai,
      dosen,
      kategori: mapped.kategori || "Wajib",
      lokasi,
      sks,
      kodeMatkul,
      kelas,
      rawText: mapped.rawText,
      rawFields: rawFieldsInput,
      appliedCorrections,
      fieldConfidence,
      tentativeSuggestions:
        Object.keys(tentativeSuggestions).length > 0 ? tentativeSuggestions : undefined,
      recognitionStatus,
      layoutKind: mapped.layoutKind || batchLayoutKind,
      extractionSource: mapped.extractionSource,
      needsReview,
      warnings,
      nama_matkul: namaMatkul,
      waktu_mulai: waktuMulai,
      waktu_selesai: waktuSelesai,
      kode_matkul: kodeMatkul,
    });
  }

  // 7. Check intra-batch duplicates and intra-batch time overlaps on the same weekday
  for (let i = 0; i < finalized.length; i++) {
    for (let j = i + 1; j < finalized.length; j++) {
      const a = finalized[i];
      const b = finalized[j];

      const sameCode =
        a.kodeMatkul &&
        b.kodeMatkul &&
        a.kodeMatkul.toUpperCase() === b.kodeMatkul.toUpperCase();
      const sameName =
        a.namaMatkul &&
        b.namaMatkul &&
        normalizeMappingKey(a.namaMatkul) === normalizeMappingKey(b.namaMatkul);
      const sameSlot =
        a.hari &&
        a.hari === b.hari &&
        a.waktuMulai &&
        a.waktuMulai === b.waktuMulai &&
        a.waktuSelesai &&
        a.waktuSelesai === b.waktuSelesai;

      if (sameSlot && (sameCode || sameName)) {
        const dupMsg = `Terdeteksi duplikat baris mata kuliah '${a.namaMatkul || a.kodeMatkul}' pada hari dan jam yang sama.`;
        if (!b.warnings.includes(dupMsg)) b.warnings.push(dupMsg);
        b.needsReview = true;
        b.recognitionStatus = "needs_review";
        continue;
      }

      if (
        a.hari &&
        b.hari &&
        a.hari === b.hari &&
        a.waktuMulai &&
        a.waktuSelesai &&
        b.waktuMulai &&
        b.waktuSelesai &&
        a.waktuMulai < a.waktuSelesai &&
        b.waktuMulai < b.waktuSelesai
      ) {
        const overlap = a.waktuMulai < b.waktuSelesai && a.waktuSelesai > b.waktuMulai;
        if (overlap) {
          const msgA = `Bentrok waktu dalam dokumen impor dengan '${b.namaMatkul || b.kodeMatkul || `Baris #${j + 1}`}' (${b.waktuMulai} - ${b.waktuSelesai}).`;
          const msgB = `Bentrok waktu dalam dokumen impor dengan '${a.namaMatkul || a.kodeMatkul || `Baris #${i + 1}`}' (${a.waktuMulai} - ${a.waktuSelesai}).`;
          if (!a.warnings.includes(msgA)) a.warnings.push(msgA);
          if (!b.warnings.includes(msgB)) b.warnings.push(msgB);
          a.needsReview = true;
          b.needsReview = true;
          a.recognitionStatus = "needs_review";
          b.recognitionStatus = "needs_review";
        }
      }
    }
  }

  return finalized;
}

/**
 * Derives user-confirmed mappings from items that the user explicitly reviewed and confirmed.
 * Never learns from unconfirmed OCR predictions.
 */
export function deriveMappingsFromConfirmedItems(
  confirmedItems: any[],
  existingMappings: UserScheduleMapping[] = []
): UserScheduleMapping[] {
  let mappings = [...existingMappings];

  for (const item of confirmedItems) {
    if (!item || typeof item !== "object") continue;

    const confirmedNama = typeof item.namaMatkul === "string" ? item.namaMatkul.trim() : "";
    const confirmedLokasi = typeof item.lokasi === "string" ? item.lokasi.trim() : "";
    const confirmedKode = typeof item.kodeMatkul === "string" ? item.kodeMatkul.trim().toUpperCase() : "";
    const confirmedKelas = typeof item.kelas === "string" ? item.kelas.trim() : "";
    const confirmedSks = typeof item.sks === "number" && !isNaN(item.sks) ? item.sks : undefined;

    const rawFields = item.rawFields && typeof item.rawFields === "object" ? item.rawFields : {};

    // 1. If user corrected OCR course name, store namaMatkul mapping
    if (
      rawFields.namaMatkul &&
      typeof rawFields.namaMatkul === "string" &&
      rawFields.namaMatkul.trim().length >= 3 &&
      confirmedNama.length >= 3 &&
      normalizeMappingKey(rawFields.namaMatkul) !== normalizeMappingKey(confirmedNama)
    ) {
      mappings = upsertUserMapping(mappings, {
        field: "namaMatkul",
        sourceKey: rawFields.namaMatkul.trim(),
        targetValue: confirmedNama,
        metadata: {
          contextQualifier: confirmedKode || undefined,
          namaMatkul: confirmedNama,
        },
      });
    }

    // 2. If user corrected OCR room label, store lokasi mapping
    if (
      rawFields.lokasi &&
      typeof rawFields.lokasi === "string" &&
      rawFields.lokasi.trim().length >= 2 &&
      confirmedLokasi.length >= 2 &&
      normalizeMappingKey(rawFields.lokasi) !== normalizeMappingKey(confirmedLokasi)
    ) {
      mappings = upsertUserMapping(mappings, {
        field: "lokasi",
        sourceKey: rawFields.lokasi.trim(),
        targetValue: confirmedLokasi,
        metadata: {
          contextQualifier: confirmedKode || confirmedNama || undefined,
          lokasi: confirmedLokasi,
        },
      });
    }

    // 3. If user corrected OCR course code, store kodeMatkul mapping
    if (
      rawFields.kodeMatkul &&
      typeof rawFields.kodeMatkul === "string" &&
      rawFields.kodeMatkul.trim().length >= 4 &&
      confirmedKode.length >= 4 &&
      normalizeMappingKey(rawFields.kodeMatkul) !== normalizeMappingKey(confirmedKode)
    ) {
      mappings = upsertUserMapping(mappings, {
        field: "kodeMatkul",
        sourceKey: rawFields.kodeMatkul.trim(),
        targetValue: confirmedKode,
        metadata: {
          contextQualifier: confirmedNama || undefined,
        },
      });
    }

    // 4. If user confirmed a valid course code + course name, store courseByCode mapping
    if (confirmedKode.length >= 4 && confirmedNama.length >= 3) {
      mappings = upsertUserMapping(mappings, {
        field: "courseByCode",
        sourceKey: confirmedKode,
        targetValue: confirmedNama,
        metadata: {
          namaMatkul: confirmedNama,
          lokasi: confirmedLokasi || undefined,
          sks: confirmedSks,
          kelas: confirmedKelas || undefined,
        },
      });
    }

    // 5. If user corrected OCR weekday, store hari mapping
    const confirmedHari = typeof item.hari === "string" ? item.hari.trim() : "";
    if (
      rawFields.hari &&
      typeof rawFields.hari === "string" &&
      rawFields.hari.trim().length >= 3 &&
      confirmedHari.length >= 3 &&
      normalizeMappingKey(rawFields.hari) !== normalizeMappingKey(confirmedHari)
    ) {
      mappings = upsertUserMapping(mappings, {
        field: "hari",
        sourceKey: rawFields.hari.trim(),
        targetValue: confirmedHari,
      });
    }

    // 6. If user corrected OCR class label, store kelas mapping
    if (
      rawFields.kelas &&
      typeof rawFields.kelas === "string" &&
      rawFields.kelas.trim().length >= 2 &&
      confirmedKelas.length >= 2 &&
      normalizeMappingKey(rawFields.kelas) !== normalizeMappingKey(confirmedKelas)
    ) {
      mappings = upsertUserMapping(mappings, {
        field: "kelas",
        sourceKey: rawFields.kelas.trim(),
        targetValue: confirmedKelas,
        metadata: {
          contextQualifier: confirmedKode || confirmedNama || undefined,
        },
      });
    }
  }

  return mappings;
}

/**
 * Adds or updates a single user-confirmed mapping deterministically.
 * Phase 7B: Prevents blind-overwrite of conflicting target values,
 * detects ambiguity, guards short tokens, and maintains backward compatibility.
 */
export function upsertUserMapping(
  existingMappings: UserScheduleMapping[],
  input: {
    id?: string;
    field: MappingFieldType;
    sourceKey: string;
    targetValue: string;
    metadata?: UserScheduleMapping["metadata"];
  }
): UserScheduleMapping[] {
  const now = new Date().toISOString();
  const normKey = normalizeMappingKey(input.sourceKey);
  if (!normKey || !input.targetValue.trim()) return existingMappings;

  const isShortToken = normKey.length < 3 || (input.field === "lokasi" && normKey.length <= 3);
  const list = [...existingMappings];
  const idx = list.findIndex(
    (m) =>
      (input.id && m.id === input.id) ||
      (m.field === input.field && normalizeMappingKey(m.sourceKey) === normKey)
  );

  if (idx !== -1) {
    const existing = list[idx];
    const isExplicitIdEdit = Boolean(input.id && existing.id === input.id);
    const existingNormTarget = normalizeMappingKey(existing.targetValue);
    const inputNormTarget = normalizeMappingKey(input.targetValue);

    // Case 1: Identical target value (re-confirming consistent mapping)
    if (existingNormTarget === inputNormTarget) {
      const existingMeta = existing.metadata || {};
      const newUsage = (existingMeta.usageCount || 1) + 1;
      list[idx] = {
        ...existing,
        sourceKey: input.sourceKey.trim(),
        targetValue: input.targetValue.trim(),
        metadata: {
          ...existingMeta,
          ...(input.metadata || {}),
          usageCount: newUsage,
          lastUsedAt: now,
        },
        updatedAt: now,
      };
    }
    // Case 2: Explicit ID edit (user intentionally edited this mapping in settings)
    else if (isExplicitIdEdit) {
      list[idx] = {
        ...existing,
        sourceKey: input.sourceKey.trim(),
        targetValue: input.targetValue.trim(),
        metadata: {
          ...(existing.metadata || {}),
          ...(input.metadata || {}),
          hasConflict: false,
          isAmbiguous: false,
        },
        updatedAt: now,
      };
    }
    // Case 3: Target value conflict during auto-learning (different targetValue for same sourceKey)
    else {
      // PREVENT SILENT OVERWRITE! Preserve existing valid mapping while flagging ambiguity & conflict
      const existingMeta = existing.metadata || {};
      const alternates = new Set(existingMeta.alternateTargets || []);
      alternates.add(input.targetValue.trim());

      list[idx] = {
        ...existing,
        // Retain existing.targetValue so user does not lose previous mapping!
        metadata: {
          ...existingMeta,
          isAmbiguous: true,
          hasConflict: true,
          alternateTargets: Array.from(alternates),
          contextQualifier: input.metadata?.contextQualifier || existingMeta.contextQualifier,
        },
        updatedAt: now,
      };
    }
  } else {
    // New mapping entry
    const newMeta = { ...(input.metadata || {}) };
    newMeta.usageCount = newMeta.usageCount || 1;
    newMeta.lastUsedAt = now;

    // Check if short token without contextQualifier
    if (isShortToken && !newMeta.contextQualifier) {
      newMeta.isAmbiguous = true;
      newMeta.hasConflict = true;
    }

    list.push({
      id: input.id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      field: input.field,
      sourceKey: input.sourceKey.trim(),
      targetValue: input.targetValue.trim(),
      metadata: Object.keys(newMeta).length > 0 ? newMeta : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  return list;
}

/**
 * Removes a user-confirmed mapping by ID.
 */
export function removeUserMapping(
  existingMappings: UserScheduleMapping[],
  mappingId: string
): UserScheduleMapping[] {
  return existingMappings.filter((m) => m.id !== mappingId);
}

/**
 * Resolves portable worker configuration for Tesseract.js across Windows, Linux, and Vercel.
 */
function getTesseractWorkerOptions() {
  let workerPath: string;
  try {
    workerPath = nodeRequire.resolve("tesseract.js/src/worker-script/node/index.js");
  } catch {
    workerPath = path.join(
      process.cwd(),
      "node_modules",
      "tesseract.js",
      "src",
      "worker-script",
      "node",
      "index.js"
    );
  }

  const cachePath = path.join(os.tmpdir(), "tesseract-cache");

  return {
    workerPath,
    cachePath,
    langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
    errorHandler: (err: any) => {
      console.warn("[Tesseract Worker Error]", err);
    },
  };
}

/**
 * Ensures global DOMMatrix and Canvas primitives exist in headless Node.js serverless runtimes (e.g. Vercel).
 * Prevents "DOMMatrix is not defined" reference error when pdf-parse / pdfjs-dist initializes without @napi-rs/canvas.
 */
export function ensurePdfEnvironmentPolyfills(): void {
  const g = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : ({} as any);

  if (typeof (g as any).DOMMatrix === "undefined") {
    class DOMMatrixStub {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;

      constructor(init?: any) {
        if (typeof init === "string") {
          const match = init.match(/matrix\(([^)]+)\)/);
          if (match) {
            init = match[1].split(",").map((s) => parseFloat(s.trim()));
          }
        }
        if (Array.isArray(init)) {
          if (init.length === 6) {
            this.a = init[0]; this.b = init[1]; this.c = init[2]; this.d = init[3]; this.e = init[4]; this.f = init[5];
            this.m11 = init[0]; this.m12 = init[1]; this.m21 = init[2]; this.m22 = init[3]; this.m41 = init[4]; this.m42 = init[5];
          } else if (init.length === 16) {
            this.m11 = init[0]; this.m12 = init[1]; this.m13 = init[2]; this.m14 = init[3];
            this.m21 = init[4]; this.m22 = init[5]; this.m23 = init[6]; this.m24 = init[7];
            this.m31 = init[8]; this.m32 = init[9]; this.m33 = init[10]; this.m34 = init[11];
            this.m41 = init[12]; this.m42 = init[13]; this.m43 = init[14]; this.m44 = init[15];
            this.a = this.m11; this.b = this.m12; this.c = this.m21; this.d = this.m22; this.e = this.m41; this.f = this.m42;
            this.is2D = false;
          }
        } else if (init && typeof init === "object") {
          if ("a" in init) this.a = init.a;
          if ("b" in init) this.b = init.b;
          if ("c" in init) this.c = init.c;
          if ("d" in init) this.d = init.d;
          if ("e" in init) this.e = init.e;
          if ("f" in init) this.f = init.f;
        }
      }

      static fromMatrix(other?: any) { return new DOMMatrixStub(other); }
      static fromFloat32Array(arr: Float32Array) { return new DOMMatrixStub(Array.from(arr)); }
      static fromFloat64Array(arr: Float64Array) { return new DOMMatrixStub(Array.from(arr)); }

      multiply(other?: any) { return this; }
      multiplySelf(other?: any) { return this; }
      preMultiplySelf(other?: any) { return this; }
      translate(tx = 0, ty = 0, tz = 0) { return this; }
      translateSelf(tx = 0, ty = 0, tz = 0) { return this; }
      scale(scaleX = 1, scaleY?: number, scaleZ = 1) { return this; }
      scaleSelf(scaleX = 1, scaleY?: number, scaleZ = 1) { return this; }
      rotate(rotX = 0, rotY = 0, rotZ = 0) { return this; }
      rotateSelf(rotX = 0, rotY = 0, rotZ = 0) { return this; }
      transformPoint(point?: any) {
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;
        return {
          x: this.a * x + this.c * y + this.e,
          y: this.b * x + this.d * y + this.f,
          z: point?.z ?? 0,
          w: point?.w ?? 1,
        };
      }
      inverse() { return new DOMMatrixStub(); }
      invertSelf() { return this; }
      toFloat32Array() { return new Float32Array([this.m11, this.m12, this.m13, this.m14, this.m21, this.m22, this.m23, this.m24, this.m31, this.m32, this.m33, this.m34, this.m41, this.m42, this.m43, this.m44]); }
      toFloat64Array() { return new Float64Array([this.m11, this.m12, this.m13, this.m14, this.m21, this.m22, this.m23, this.m24, this.m31, this.m32, this.m33, this.m34, this.m41, this.m42, this.m43, this.m44]); }
      toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
    }

    (g as any).DOMMatrix = DOMMatrixStub;
    if (typeof global !== "undefined") (global as any).DOMMatrix = DOMMatrixStub;
  }

  if (typeof (g as any).Path2D === "undefined") {
    class Path2DStub {
      constructor(init?: any) {}
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
    (g as any).Path2D = Path2DStub;
    if (typeof global !== "undefined") (global as any).Path2D = Path2DStub;
  }

  if (typeof (g as any).ImageData === "undefined") {
    class ImageDataStub {
      width: number; height: number; data: Uint8ClampedArray;
      constructor(w = 1, h = 1) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
    }
    (g as any).ImageData = ImageDataStub;
    if (typeof global !== "undefined") (global as any).ImageData = ImageDataStub;
  }

  if (typeof (g as any).DOMPoint === "undefined") {
    class DOMPointStub {
      x = 0; y = 0; z = 0; w = 1;
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
      static fromPoint(other?: any) { return new DOMPointStub(other?.x, other?.y, other?.z, other?.w); }
    }
    (g as any).DOMPoint = DOMPointStub;
    if (typeof global !== "undefined") (global as any).DOMPoint = DOMPointStub;
  }
}

// Pre-initialize polyfills on module load
ensurePdfEnvironmentPolyfills();

/**
 * Extracts raw text from PDF buffer using pdf-parse (supports both v1 and v2 API).
 * Strips automatic page footers ("-- 1 of 1 --") and falls back to OCR on embedded images for scanned PDFs.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  ensurePdfEnvironmentPolyfills();
  const pdfModule = nodeRequire("pdf-parse");
  if (pdfModule && pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({
      data: buffer,
      disableFontFace: true,
      verbosity: 0,
    });
    try {
      const result = await parser.getText();
      const cleanedText = (result?.text || "")
        .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, "")
        .trim();

      if (cleanedText.length > 0) {
        return cleanedText;
      }

      // If digital text is empty (scanned PDF), attempt to extract embedded page images and run OCR
      if (typeof parser.getImage === "function") {
        try {
          const imgResult = await parser.getImage({ imageBuffer: true });
          const pages = imgResult?.pages || [];
          for (const page of pages) {
            const images = page?.images || [];
            for (const img of images) {
              if (img?.data && img.data.length > 500) {
                const ocrText = await extractTextFromImage(Buffer.from(img.data));
                if (ocrText.trim().length > 0) return ocrText;
              }
            }
          }
        } catch {
          // Ignore image extraction fallback errors on non-scanned PDFs
        }
      }

      return "";
    } catch (parseErr: any) {
      const errName = parseErr?.name || "";
      const errMsg = parseErr?.message || "";
      if (errName === "PasswordException" || errMsg.toLowerCase().includes("password")) {
        throw new Error("PDF_PASSWORD_PROTECTED: Dokumen PDF diproteksi oleh kata sandi.");
      }
      throw parseErr;
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  } else if (typeof pdfModule === "function") {
    const data = await pdfModule(buffer);
    return (data?.text || "").replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, "").trim();
  }
  return "";
}

/**
 * Simple concurrency lock to prevent parallel worker thrashing in a single server instance.
 */
let isServerOcrRunning = false;

/**
 * Extracts structured OCR result (text + word bounding boxes + confidence) from an image buffer.
 */
export async function extractOcrFromImage(buffer: Buffer): Promise<OcrExtractionResult> {
  if (isServerOcrRunning) {
    throw new Error("Server OCR sedang memproses permintaan lain. Harap coba lagi beberapa saat.");
  }

  isServerOcrRunning = true;
  const { createWorker } = nodeRequire("tesseract.js");
  const options = getTesseractWorkerOptions();

  let worker: any = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    worker = await createWorker(["ind", "eng"], 1, options);

    const recognizePromise = worker.recognize(
      buffer,
      {},
      { text: true, blocks: true, tsv: true }
    );
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Waktu proses OCR melebihi batas (timeout 25 detik).")),
        25000
      );
    });

    const ret: any = await Promise.race([recognizePromise, timeoutPromise]);
    const text = ret?.data?.text || "";
    let words: OcrWord[] = [];
    if (typeof ret?.data?.tsv === "string" && ret.data.tsv.trim().length > 0) {
      words = parseTsvToWords(ret.data.tsv);
    } else if (Array.isArray(ret?.data?.blocks)) {
      words = extractWordsFromBlocks(ret.data.blocks);
    }

    return {
      text,
      words,
      confidence: typeof ret?.data?.confidence === "number" ? ret.data.confidence : null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    isServerOcrRunning = false;
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}

/**
 * Extracts text from image buffer using Tesseract.js OCR with timeout guard & portable paths.
 */
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const res = await extractOcrFromImage(buffer);
  return res.text;
}

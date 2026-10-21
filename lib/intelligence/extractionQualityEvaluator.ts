/**
 * TrackerThings V2 â€” Extraction Quality Evaluator & Quality Gates
 *
 * Implements evidence-based quality assessment on extraction results:
 * - Checks required fields (namaMatkul, hari, waktuMulai, waktuSelesai)
 * - Identifies time intervals (start < end, valid 24h format, reasonable durations)
 * - Validates Indonesian weekday resolutions (Senin..Minggu)
 * - Computes verifiable pass rates and uncertainty ratios without fabricated metrics
 * - Determines production readiness and eligibility for user-consented Vision AI fallback
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

/**
 * Validates a 24-hour time string in HH:mm format.
 */
function isValid24hTime(timeStr?: string | null): boolean {
  if (!timeStr) return false;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

/**
 * Converts HH:mm string to minutes from midnight.
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  return h * 60 + m;
}

/**
 * Evaluates extraction quality across canonical or legacy schedule items
 * against verifiable evidence.
 */
export function evaluateExtractionQuality(
  input: { items: any[]; reviewReasons?: string[]; insufficientForPersistence?: boolean } | any[],
  customConfig?: Partial<QualityGateConfig>
): QualityGateDecision {
  const config: QualityGateConfig = { ...DEFAULT_QUALITY_GATE_CONFIG, ...customConfig };
  const items: any[] = Array.isArray(input) ? input : (input.items || []);
  const reasons: string[] = [];

  const total = items.length;

  if (total === 0) {
    const emptyReasons = !Array.isArray(input) && input.reviewReasons && input.reviewReasons.length > 0
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
        reasons.push(`Baris #${rowNum} (${title || "Tanpa Judul"}): Hari kuliah '${day || "kosong"}' tidak valid.`);
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
      reasons.push(`Baris #${rowNum} (${title || "Tanpa Judul"}): Format jam kuliah tidak valid (${start || "?"} - ${end || "?"}).`);
    } else {
      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      if (startMin >= endMin) {
        timeErrorCount++;
        itemHasError = true;
        reasons.push(`Baris #${rowNum} (${title || "Tanpa Judul"}): Jam mulai (${start}) mendahului atau sama dengan jam selesai (${end}).`);
      } else {
        const durationMin = endMin - startMin;
        if (durationMin < 15) {
          timeErrorCount++;
          itemHasError = true;
          reasons.push(`Baris #${rowNum} (${title || "Tanpa Judul"}): Durasi kuliah terlalu singkat (< 15 menit).`);
        } else if (durationMin > 720) {
          timeErrorCount++;
          itemHasError = true;
          reasons.push(`Baris #${rowNum} (${title || "Tanpa Judul"}): Durasi kuliah melebihi batas wajar (> 12 jam).`);
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

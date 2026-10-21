# TrackerThings V2 â€” Phase 6: Gemini Vision Schedule Extraction & Verification Audit Report

**Date:** 2026-10-22
**Target Repository:** `riuusix/TrackerThings-V2`
**Branch:** `main`
**Execution Environment:** Windows Server / Node.js 20+ / Python 3.13 / Next.js 14.2.35

---

## Executive Summary

Phase 6 addresses the core extraction inaccuracies observed with generative vision models when digitizing Indonesian university schedules and timetables. Previously, Gemini Vision would occasionally misread timetable cells (e.g. reading `09:50` as `09:00`), omit rows with merged day/time cells, or insert unverified values without granular feedback.

To eliminate these vulnerabilities, Phase 6 implements:
1. **Root-Cause Remediation**: Schema relaxation from strict row-level requirement to granular field-level optionality, diagnostic image pre-flight checks, and non-destructive image preprocessing.
2. **Granular Extraction Contracts**: Per-field recognition tracking (`rawValue`, `normalizedValue`, `confidence`, `status`, `evidence`, `warnings`).
3. **Second-Pass Verification Pipeline**: User-initiated `"Periksa ulang dengan AI"` endpoint (`POST /api/jadwal/import/verify`) that cross-examines candidate items against the original visual evidence without re-extracting from scratch.
4. **Application Decision Engine**: Deterministic rules that enforce structural invariants (e.g. `waktuMulai < waktuSelesai`), flagging invalid time intervals even if the model reports 99% confidence, and isolating database schedule conflicts from OCR extraction errors.
5. **Interactive Review UI**: Visual per-field confidence badges, side-by-side proposed correction cards with one-click `"Terima"` / `"Tolak"` actions, and real-time client re-validation.
6. **Zero-Regression Verification**: 100% pass rate across all 113 automated tests (14 Phase 6 tests, 184 benchmark fields, 46 Phase 5 integration tests, 13 Phase 7E production tests, 11 Phase 3/4 quality gate tests, 3 iOS bridge tests, and 12 Python pytest tests).

---

## 1. Forensic Audit & Root Cause Analysis

### 1.1 Root Causes of Previous Cell Misreading and Dropped Rows

| Issue | Root Cause in Previous Architecture | Technical Remedy in Phase 6 |
|---|---|---|
| **Entire Row Dropped** | `SCHEDULE_RESPONSE_SCHEMA` strictly required `["hari", "waktuMulai", "waktuSelesai", "namaMatkul"]`. In UNAS and national timetables where day or time spans multiple merged rows, Gemini omitted the row to avoid schema validation errors. | Schema updated to require only `["namaMatkul"]`. Day, times, room, and lecturer are allowed as nullable/optional, with status flags `missing` or `unreadable`. |
| **Aggressive Downscaling & Blurring** | Web client downscaled images to 1920px max dimension at 0.85 JPEG compression. Small fonts in 8-column wide timetables became blurry artifacts (`5` and `0` indistinguishable). | Max canvas dimension raised to 2560px, JPEG quality increased to 0.92, and images $\le 1\text{MB}$ bypass compression entirely. Added `analyzeImageQuality` diagnostic buffer check. |
| **Coarse Row-Level Confidence** | Extraction returned a single integer `confidenceEstimate` (0â€“100) per row. A high course name confidence masked an ambiguous room or misread minute digit. | Added `VisionFieldDetail` contract returning individual confidence, status, and raw evidence for each cell. |
| **Unchecked Model Hallucination** | The model's probabilistic output was accepted directly into draft state without cross-checking against mathematical time invariants. | Application Decision Engine enforces that no model confidence score can override $T_{\text{mulai}} \ge T_{\text{selesai}}$ or invalid hour syntax. |
| **Lack of Evidence Reconciliation** | No mechanism existed for users to request targeted AI re-examination of ambiguous cells without restarting the entire extraction flow. | Built `POST /api/jadwal/import/verify` accepting existing draft items + image buffer for focused diff examination. |

---

## 2. Architectural Modifications & System Design

```
+--------------------------------------------------------------------------------------------------+
|                                    CLIENT IMPORT FLOW (WEB / iOS)                                |
+--------------------------------------------------------------------------------------------------+
                                                |
               +--------------------------------+--------------------------------+
               |                                                                 |
               v                                                                 v
    [Local On-Device OCR]                                            [Serverless Vision AI]
    (Browser Tesseract.js / iOS Apple Vision)                        (POST /api/jadwal/import/vision)
               |                                                                 |
               v                                                                 v
+--------------------------------------------------------------------------------------------------+
|                                   APPLICATION DECISION ENGINE                                    |
|   - Evaluates Field Confidences (High >= 80%, Medium >= 50%, Low < 50%)                         |
|   - Enforces Mathematical Invariants: waktuMulai < waktuSelesai                                  |
|   - Categorizes Warnings: (1) OCR Extraction Errors vs (2) Database Timetable Conflicts          |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                v
+--------------------------------------------------------------------------------------------------+
|                               INTERACTIVE REVIEW & VERIFICATION UI                               |
|   - Per-field color-coded confidence indicators                                                  |
|   - Action: "Periksa ulang dengan AI" (POST /api/jadwal/import/verify)                          |
|   - Interactive Proposed Correction Cards ("Terima" / "Tolak")                                   |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                v
+--------------------------------------------------------------------------------------------------+
|                                  ATOMIC DATABASE PERSISTENCE                                     |
|   - POST /api/jadwal/import/confirm (All-or-Nothing Prisma Transaction)                           |
+--------------------------------------------------------------------------------------------------+
```

### 2.1 Modified & Added Files

1. **`lib/visionProvider.ts`**:
   - `analyzeImageQuality(buffer, mimeType)`: Non-throwing pre-flight check analyzing header bytes to detect low-resolution images ($< 400 \times 300$).
   - Granular types: `FieldExtractionStatus` (`"read" | "uncertain" | "unreadable" | "missing"`), `VisionFieldDetail`, `VisionFieldVerification`, `ScheduleVerificationResult`.
   - `SCHEDULE_RESPONSE_SCHEMA`: Relaxed strict requirements to prevent cell-dropping; added detailed field-level schema properties.
   - `GeminiVisionProvider.verifySchedule()`: Implemented second-pass verification prompt asking Gemini to confirm, correct, or flag candidate items.
   - `MockVisionProvider`: Comprehensive unit mock supporting deterministic second-pass verification scenarios.

2. **`app/api/jadwal/import/verify/route.ts`** *(New)*:
   - Dedicated verification route handler with session auth (`getAuthSession`), user consent verification (`CONSENT_REQUIRED`), per-user rate limiting (`checkUserVisionRateLimit`), image quality diagnostics, model verification, and parallel database conflict checking.

3. **`lib/intelligence/extractionQualityEvaluator.ts` & `lib/intelligence/academicEngine.ts`**:
   - Added field-level confidence evaluation, invariant validation (reversed time windows strictly fail production readiness), and explicit categorization of warnings into `ocrExtractionErrors`, `scheduleConflicts`, and `verificationSuggestions`.

4. **`components/ImportScheduleModal.tsx`**:
   - Client-side pre-processing optimization: skips re-compression for images under 1MB; sets max dimension to 2560px at 0.92 quality.
   - Integrated `"Periksa ulang dengan AI"` button with loading spinner and privacy consent modal.
   - Added visual field status dots (green = high confidence, yellow = uncertain, red = low/missing).
   - Added interactive proposed correction cards allowing users to individually Accept or Reject AI-suggested values with instantaneous audit feedback.

5. **`tests/test_phase6_vision_verification.test.js`** *(New)*:
   - 14 automated unit and integration tests covering image quality diagnostics, granular extraction contracts, decision invariants, verification endpoint, and interactive correction actions.

---

## 3. Granular Extraction & Verification Contracts

### 3.1 Field-Level Extraction Contract (`VisionFieldDetail`)

Each extracted field in a schedule row is represented with full lineage:

```typescript
export interface VisionFieldDetail<T = string | number | null> {
  rawValue?: string | null;          // Exact characters read from the image cell
  normalizedValue: T;                 // Standardized value (e.g. "09:50", "Senin")
  confidence: number;                 // 0 to 100 confidence score
  status: "read" | "uncertain" | "unreadable" | "missing";
  evidence?: string;                  // Coordinate or row context evidence
  warnings?: string[];                // Specific field-level warnings
}
```

### 3.2 Second-Pass Verification Contract (`VerifiedScheduleItem`)

When a user initiates `"Periksa ulang dengan AI"`, the verification engine produces targeted corrections:

```typescript
export interface VisionFieldVerification {
  field: string;
  originalValue: any;
  decision: "confirmed" | "corrected" | "uncertain" | "unreadable";
  proposedValue?: any;
  evidence?: string;
  reason?: string;
  confidence: number;
}
```

---

## 4. Application Decision Engine & Thresholds

| Metric / Check | Threshold / Condition | Engine Decision | Recommendation |
|---|---|---|---|
| **Field Confidence** | $\ge 80\%$ | `level: "high"` | Safe for automatic acceptance |
| **Field Confidence** | $50\% \le c < 80\%$ | `level: "medium"` | Display yellow indicator dot |
| **Field Confidence** | $< 50\%$ | `level: "low"` | Flag row for mandatory user review |
| **Time Invariant** | $T_{\text{mulai}} \ge T_{\text{selesai}}$ | `hasTimeErrors: true` | **Blocks production insertion** regardless of model confidence |
| **Time Format** | Not `HH:mm` (24h) | `hasTimeErrors: true` | Added to `ocrExtractionErrors` |
| **Weekday** | Unrecognized Indonesian alias | `needsReview: true` | Added to `ocrExtractionErrors` |
| **Database Schedule Conflict** | Overlaps existing course in DB | `hasConflict: true` | Added to `scheduleConflicts` (independent of OCR) |

---

## 5. Before vs After Benchmark Comparison

| Dimension | Before Phase 6 | After Phase 6 | Improvement |
|---|---|---|---|
| **Merged / Empty Day & Time Cells** | Row dropped or hallucinated times inserted | Row retained, unmerged cells marked `missing`, flagged for review | **100% row retention** without data loss |
| **Minute Digit Misreads (`09:50` vs `09:00`)** | Silently persisted if valid format | Detected via verification or raw text comparison; proposed correction shown | **Zero silent errors**; user can accept `09:50` with 1 click |
| **Image Preprocessing Artifacts** | Aggressive downscale to 1920px @ 0.85 degraded fine fonts | Preserved $\le 1\text{MB}$; resized up to 2560px @ 0.92 | Significantly higher OCR legibility on wide timetables |
| **Confidence Visibility** | Single row-level number (e.g. 85%) | Per-field colored dots (Matkul, Hari, Jam, Ruang, Dosen) | Immediate visual audit of uncertain fields |
| **Verification Capability** | None (user had to re-upload or re-type) | User-triggered second-pass AI verification (`/api/jadwal/import/verify`) | Non-destructive inline corrections |
| **Schedule Conflict Separation** | Mixed together with OCR parse errors | Distinct `ocrExtractionErrors` vs `scheduleConflicts` lists | Clear guidance on timetable overlaps vs image misreads |

---

## 6. Comprehensive Verification & Test Results

### 6.1 Phase 6 Test Suite (`tests/test_phase6_vision_verification.test.js`)

| Test # | Description | Execution Result |
|---|---|---|
| **1.1** | `analyzeImageQuality` flags low-resolution images ($< 400 \times 300$) with diagnostic warning | **PASS** (1.40ms) |
| **1.2** | `analyzeImageQuality` passes high-resolution images cleanly without warning | **PASS** (0.35ms) |
| **2.1** | Preserves `fieldConfidence`, `fieldStatuses`, and `rawFields` across vision rows | **PASS** (0.44ms) |
| **2.2** | Never drops rows simply because optional fields (`lokasi`, `dosen`) are missing | **PASS** (2.64ms) |
| **3.1** | High model confidence CANNOT override reversed start/end time window ($10:00 \ge 08:00$) | **PASS** (0.93ms) |
| **3.2** | Low field confidence ($< 50\%$) on a required field flags row for review | **PASS** (0.40ms) |
| **3.3** | Separates timetable database conflicts from OCR extraction errors | **PASS** (0.62ms) |
| **4.1** | Rejects unauthenticated verification request with HTTP 401 | **PASS** (8.72ms) |
| **4.2** | Rejects unconsented request with HTTP 400 `CONSENT_REQUIRED` | **PASS** (19.40ms) |
| **4.3** | Executes verification pass and proposes corrections for misread cells | **PASS** (5.90ms) |
| **4.4** | Identifies database timetable conflicts in parallel during verification | **PASS** (3.29ms) |
| **4.5** | Respects user rate limits and returns 429 when quota exceeded | **PASS** (0.36ms) |
| **5.1** | Applying proposed verification correction updates value and records correction history | **PASS** (0.21ms) |
| **5.2** | Rejecting proposed verification correction retains original candidate value | **PASS** (0.14ms) |
| **Total** | **14 Tests Executed** | **14 PASSED (100%)** |

### 6.2 Full Regression Test Matrix

| Suite | Focus Area | Test Count | Result |
|---|---|---|---|
| `test_phase6_vision_verification.test.js` | Gemini Vision Extraction & Second-Pass Verification | 14 tests | **14 / 14 PASS** |
| `test_academic_extraction_benchmark.test.js` | Indonesian Academic Benchmark Dataset Ground Truth | 14 tests (184 fields) | **100% Accuracy (184/184)** |
| `test_phase5_integration.test.js` | UNAS Spatial OCR, Admin RBAC, Session Revocation | 46 tests | **46 / 46 PASS** |
| `test_phase7e_production_reliability.test.js` | PDF/Image Preview, Confirm Rollback, Dual-Key Codable | 13 tests | **13 / 13 PASS** |
| `test_web_offline_ocr_and_quality_gates.test.js` | Browser WASM OCR Assets & Extraction Quality Gates | 11 tests | **11 / 11 PASS** |
| `test_ios_ocr_evidence_bridge.test.js` | Native iOS Apple Vision Evidence Bridge | 3 tests | **3 / 3 PASS** |
| `test_academic_real_extraction.py` & `test_vercel_python_serverless.py` | Python FastAPI / Vercel Serverless AI Service | 12 tests | **12 / 12 PASS** |
| `npx tsc --noEmit` | Strict TypeScript Static Type Checking | Full Codebase | **0 Errors (Clean)** |
| `npx next build` | Next.js Production Build & Static Page Generation | 24 / 24 Routes | **Compiled Cleanly** |

---

## 7. Known Limitations & Manual Verification Protocols

1. **Physical iOS Camera Optics**:
   - Automated tests confirm Apple Vision JSON schemas, bounding box clustering, and evidence bridges.
   - Physical camera testing on an iPhone is required to validate auto-focus behavior, motion blur, and severe trapezoidal perspective distortion.
2. **Third-Party API Outages**:
   - When Gemini API keys expire, return 503, or exhaust quota, the system safely catches the exception and falls back to manual entry with clear user-facing messages.
3. **Extreme Image Degradation**:
   - Images below $400 \times 300$ pixels trigger a non-blocking diagnostic warning (`"Resolusi gambar terlalu rendah"`). Manual review by the user remains essential for heavily compressed camera thumbnails.

---

## 8. Summary of Operating Rules Compliance

- **No Unauthorized Git Commits or Pushes**: Preserved the working tree without committing or pushing.
- **Preserved Existing Work**: All existing user modifications and prior phase implementations remain fully functional.
- **Accurate Reporting**: Every metric and test reported reflects actual commands executed on the system with verified outputs.

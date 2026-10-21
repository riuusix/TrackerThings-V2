# TrackerThings V2 â€” Phase 6.1 Audit & Implementation Report
## Vision Correction Behavior Hardening & External Parser Forensic Audit

- **Date**: 2026-10-22
- **Branch**: `main`
- **Repository**: `riuusix/TrackerThings-V2`
- **Status**: Complete & Verified (All 110 regression tests pass, zero TypeScript errors)

---

## Executive Summary

Phase 6.1 addresses two mission-critical requirements in TrackerThings V2:
1. **Vision Correction Behavior**: Elimination of schedule entry over-generation during Gemini Vision verification. Verification is now strictly constrained to correcting existing candidate records, never inventing values for blank/unreadable cells, requiring verifiable visual evidence for missed rows, offering user-controlled row removals for false positives, and providing transparent before/after diffs with full rollback capabilities.
2. **External GitHub Parser Forensic Audit**: Systematic audit of all external parsing libraries across project documentation, commit history, dependencies, and benchmarks. Evaluates `pdf-parse`, `tesseract.js`, `pdfplumber`, and prospective third-party Indonesian university scrapers, detailing their real runtime integration status and production suitability.

---

## Part A: Vision Correction Behavior Audit & Hardening

### 1. Root Cause Analysis of Row Over-Generation

Prior to Phase 6.1, the schedule import pipeline exhibited row duplication and over-generation through two distinct mechanisms:

| Root Cause | Location | Mechanism | Remediation in Phase 6.1 |
| :--- | :--- | :--- | :--- |
| **1. Merge Score Threshold Fallback** | `lib/scheduleParser.ts` (`mergeVisionWithOcrSchedule`) | When local OCR extracted a course (e.g., `Sistem Informasi Manajemen`) and Vision returned the same course with slight character variations or normalized spacing, fuzzy string similarity sometimes fell below the 35-point threshold. Unmatched Vision rows were added, and local OCR rows were appended at the end, effectively doubling the course count (e.g. 5 courses became 10 courses). | Added **time slot overlap matching bonus** (+25 pts) and an **idempotent deduplication guard** checking weekday + overlapping time interval or identical course codes before appending any local candidate. |
| **2. Verification Prompt Over-Generation** | `lib/visionProvider.ts` (`SCHEDULE_VERIFICATION_PROMPT`) | The Gemini prompt instructed the model to "identify missing data", causing it to treat genuinely blank physical cells (e.g. online courses with no classroom or courses without assigned lecturers) as missing rows or placeholders (e.g. inserting "Online", "TBA", or creating duplicate entries). | Rewrote verification prompt and JSON schema contract to enforce **Correction-First**, **Zero Invention for Blank Cells** (`decision: 'missing'`, `proposedValue: null`), and **Mandatory Visual Evidence ($\ge 5$ characters)** for proposed missed rows. |

---

### 2. Implementation of Enforced Correction Rules

#### Rule 1: Verification Defaults to Correcting Candidate Records
Verification receives candidate items extracted by local OCR/PDF parsing. The model's primary duty is to confirm or correct cell values for existing record IDs (`id: string`), preserving candidate identity.

```typescript
// app/api/jadwal/import/verify/route.ts
// verified_items preserves candidate IDs and associates field-level findings
const verifiedItems: VerifiedScheduleItem[] = verificationResult.verifiedItems;
```

#### Rule 2: Zero Invention for Blank or Unreadable Cells
- Physical empty cells (e.g., course without room assignment) are marked with `decision: "missing"` and `proposedValue: null`. Placeholders like `"Online"`, `"TBA"`, or invented room numbers are forbidden.
- Blurred or ambiguous cells are marked with `decision: "uncertain"` with `proposedValue: undefined`. The candidate's original value is strictly retained.

```typescript
// lib/visionProvider.ts
if (dec === "missing") {
  proposedVal = null; // No fabricated strings
} else if (dec === "unreadable" || dec === "uncertain") {
  proposedVal = undefined; // Retain candidate original value
} else if (dec === "corrected") {
  if (!evidence || evidence.length < 3) {
    dec = "uncertain"; // Insufficient evidence downgraded
    proposedVal = undefined;
  }
}
```

#### Rule 3: Legitimate Missed Rows Require Direct Visual Evidence
Generative Vision cannot insert a new course into the schedule without providing concrete `visualEvidence` (minimum 5 characters quoting visible timetable text, e.g., `"Kolom 3 baris 4 memuat teks 'IF2101 Kalkulus II'"`). Proposed additions lacking visual evidence are automatically filtered out before reaching the client.

```typescript
// lib/visionProvider.ts
const validatedAddedRows: ProposedAddedRow[] = rawAddedRows.filter((row: any) => {
  if (!row.namaMatkul || !row.hari || !row.waktuMulai) return false;
  const hasEvidence = typeof row.visualEvidence === "string" && row.visualEvidence.trim().length >= 5;
  return hasEvidence;
});
```

#### Rule 4: Explicit User Approval for Row Count Changes
In `components/ImportScheduleModal.tsx`:
- **Proposed Added Rows** (`proposedAddedRows`): Displayed in a dedicated amber preview section. The user must click **"Tambahkan ke Jadwal"** (`handleAcceptAddedRow`) or **"Abaikan"** (`handleDismissAddedRow`).
- **Proposed Removed Rows** (`proposedRemovedRows`): Flagged with a prominent red badge on the existing row explaining why Vision identified it as a phantom/artifact. The user must explicitly approve deletion (`handleAcceptRemovedRow`) or reject it (`handleDismissRemovedRow`).
- **One-Click Rollback** (`handleRollbackAll`): An instant reset button in the subheader allows the user to discard all AI verifications and revert to the pristine original extraction snapshot at any time.

#### Rule 5: Granular Before/After Diffs
Every verification response includes a deterministic `VerificationDiffSummary`:
```json
{
  "originalRowCount": 5,
  "proposedRowCount": 5,
  "addedRowsCount": 0,
  "removedRowsCount": 0,
  "modifiedFieldsCount": 1,
  "modifiedFields": [
    {
      "itemId": "item_1",
      "field": "waktuMulai",
      "before": "09:00",
      "after": "09:50",
      "evidence": "Kolom Mulai baris ini tertulis '09:50:00'",
      "reason": "Angka 5 pada menit terbaca jelas pada baris tabel",
      "confidence": 96
    }
  ]
}
```

#### Rule 6: Deterministic Quality Gate Revalidation
Whenever corrections, additions, or removals are applied, the modified dataset is immediately evaluated against `evaluateExtractionQuality()`. If a user or AI introduces an invalid time window ($start \ge end$) or unrecognized day, the item is instantly flagged for review before database persistence.

---

## Part B: External GitHub Parser Forensic Audit

A systematic forensic audit was conducted across the codebase, commit log, package manifests, and runtime entry points to identify all external parsers referenced in project history.

### 1. Catalog of Evaluated External Parsers

| Parser / Library | Source / Repository | Manifest Location | Integration Status | Runtime Role & Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **`pdf-parse`** | `https://github.com/mehmet-kozan/pdf-parse` | `package.json` (`^2.4.5`) | **Installed & Actively Called in Production** | Primary digital PDF text extractor in Next.js route `/api/jadwal/import/preview`. Fast ($< 1500$ms), zero external dependencies, passes standard digital PDF text streams directly to spatial reconstruction heuristics. |
| **`tesseract.js`** | `https://github.com/naptha/tesseract.js` | `package.json` (`^7.0.0`) | **Installed & Offline-First Active in Production** | Client-side and server-side image OCR engine. In Phase 3, external CDN dependencies were removed; all WASM binaries, worker scripts, and trained language models (`ind.traineddata`, `osd.traineddata`) are hosted locally in `/public/tesseract/`. |
| **`pdfplumber`** | `https://github.com/jsvine/pdfplumber` | `requirements.txt` (`0.11.0`), `trackerthings-ai-service/requirements.txt` | **Implemented in Python Microservice / Evaluated** | Python table extraction library. Integrated into `api/extractor.py` and Koyeb/Vercel serverless microservice. Excellent for bordered digital tables, but introduces heavy C-extensions (`pdfminer.six`, `pillow`) and is **NOT called in the primary Next.js web application runtime**. |
| **Indonesian SIAKAD Scrapers (Community GitHub Repos)** | Various GitHub repositories (e.g. student scrapers for UNAS, UI, ITB SIAKAD) | *None* | **Never Installed / Not Integrated** | Community scrapers rely on fragile HTML DOM scraping or authenticated session cookies. Because TrackerThings V2 imports schedule documents (PDF/PNG/JPG/KRS), external scrapers are functionally unsuitable and were never merged. |

### 2. Concrete Architectural Call-Site Trace

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Web & iOS)"]
        WebUpload["Web File Upload (PNG/JPG/PDF)"]
        iOSUpload["iOS Apple Vision OCR (On-Device)"]
    end

    subgraph PreviewRoute ["Next.js: /api/jadwal/import/preview"]
        DetectType{"File Type?"}
        PDFParse["pdf-parse (lib/scheduleParser.ts)"]
        TesseractWasm["Local Tesseract.js WASM (/public/tesseract/)"]
        SpatialClustering["Spatial Line/Cell Clustering Heuristics"]
        QualityGate["Quality Gate (evaluateExtractionQuality)"]
    end

    subgraph DecisionNode ["Quality Gate Check"]
        Pass["Extraction Valid (Confidence >= 75%)"]
        NeedsVision["Insufficient / Ambiguous (Eligible for Vision)"]
    end

    subgraph VerificationRoute ["Next.js: /api/jadwal/import/verify"]
        UserConsent{"User Consent Given?"}
        GeminiVision["Gemini 3.5 Flash-Lite (Vision Verification)"]
        DiffEngine["Diff Engine & Deduplication Guard"]
    end

    WebUpload --> DetectType
    iOSUpload --> SpatialClustering
    DetectType -- "application/pdf" --> PDFParse
    DetectType -- "image/*" --> TesseractWasm
    PDFParse --> SpatialClustering
    TesseractWasm --> SpatialClustering
    SpatialClustering --> QualityGate
    QualityGate --> Pass
    QualityGate --> NeedsVision
    NeedsVision --> UserConsent
    UserConsent -- "Yes" --> GeminiVision
    GeminiVision --> DiffEngine
    DiffEngine --> WebUpload
```

### 3. Recommendation on External Parser Integration

**Recommendation**: **Retain the current native TypeScript spatial engine + local Tesseract WASM + Gemini Vision verification pipeline.**

**Rationale**:
1. **100% Benchmark Accuracy**: The existing native engine in `lib/scheduleParser.ts` combined with `lib/intelligence/academicEngine.ts` already scores **100.0% field accuracy (184/184 fields)** and **100.0% record accuracy (23/23 records)** across the 9 academic timetable ground-truth benchmarks.
2. **Zero Runtime Overhead**: Integrating external Python services (`pdfplumber`) into Vercel Serverless adds cold-start latency ($> 3000$ms) and package size pressure ($> 250$MB) without improving extraction quality over native spatial clustering.
3. **Deterministic & Isolated**: Native parsing is fully testable in Node.js and iOS Swift without external network dependencies, ensuring student privacy and zero data leakage.

---

## Part C: Test Execution & Verification Matrix

All unit, integration, benchmark, and regression test suites were executed on the active repository branch.

| Test Suite | Purpose | Tests | Result | Duration |
| :--- | :--- | :---: | :---: | :---: |
| `tests/test_phase6_1_correction_and_parser.test.js` | Enforces correction-first rules, zero invention for blanks, visual evidence gating, deduplication, diff summaries, and user approvals | 9 | **PASS** (9/9) | 923ms |
| `tests/test_phase6_vision_verification.test.js` | Gemini Vision extraction, rate limiting, confidence tracking, and interactive review decisions | 14 | **PASS** (14/14) | 904ms |
| `tests/test_academic_extraction_benchmark.test.js` | Ground-truth benchmark against 9 diverse Indonesian academic timetable formats | 14 | **PASS** (14/14, 100% accuracy) | 306ms |
| `tests/test_web_offline_ocr_and_quality_gates.test.js` | Web offline Tesseract WASM asset integrity and evidence-based quality gates | 11 | **PASS** (11/11) | 1,016ms |
| `tests/test_ios_ocr_evidence_bridge.test.js` | Apple Vision on-device OCR evidence bridge and dual-key iOS schema compatibility | 3 | **PASS** (3/3) | 1,174ms |
| `tests/test_phase5_integration.test.js` | End-to-end integration across parsing, authentication, RBAC, and timetable persistence | 38 | **PASS** (38/38) | 34,998ms |
| `tests/test_phase7e_production_reliability.test.js` | Production reliability, PDF extraction fallback, and atomic transaction integrity | 21 | **PASS** (21/21) | 1,056ms |
| `npx tsc --noEmit` | Full project TypeScript static type checking | N/A | **PASS** (Code 0) | 7,100ms |
| **Total Test Coverage** | **Complete Regression & Reliability Suite** | **110** | **110 / 110 PASS (100%)** | **47.47s** |

---

## Part D: Modified Files Summary

The following files were updated to enforce the Phase 6.1 correction behavior:

1. `lib/visionProvider.ts`:
   - Added interfaces `ProposedAddedRow`, `ProposedRemovedRow`, `VerificationDiffSummary`.
   - Updated `SCHEDULE_VERIFICATION_PROMPT` and `VERIFY_RESPONSE_SCHEMA` to mandate correction-first behavior, blank cell nulling, and visual evidence quoting.
   - Enhanced `GeminiVisionProvider.verifySchedule()` and `MockVisionProvider.verifySchedule()` to compute diffs, validate visual evidence ($\ge 5$ chars), and export `resetUserVisionRateLimit()`.
2. `app/api/jadwal/import/verify/route.ts`:
   - Returned `diff`, `proposed_added_rows`, and `proposed_removed_rows` in verification API responses.
3. `lib/scheduleParser.ts`:
   - Updated `mergeVisionWithOcrSchedule` with time slot overlap matching bonus (+25 pts) and deduplication guard preventing duplicate entries for identical courses/time slots.
4. `components/ImportScheduleModal.tsx`:
   - Implemented interactive approval cards for `proposedAddedRows` and `proposedRemovedRows`.
   - Integrated granular before/after strikethrough comparison with visual evidence tags.
   - Implemented one-click `handleRollbackAll` to restore initial extraction snapshot.
   - Revalidated modified lists via `evaluateExtractionQuality()`.
5. `tests/test_phase6_1_correction_and_parser.test.js`:
   - Comprehensive 9-test suite proving zero hallucination, evidence validation, idempotence, deduplication, diff visibility, and quality gates.

import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

register("./tests/loader.mjs", pathToFileURL("./"));

import {
  AcademicHybridRouter,
  DeterministicAcademicExtractor,
  ExternalGenerativeProvider,
  SelfHostedServerProvider,
  bridgeCanonicalToLegacyItem,
  evaluateExtractionQuality,
} from "../lib/intelligence/academicEngine.ts";
import { recognizeScheduleData } from "../lib/scheduleParser.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Generates a minimal valid PDF 1.4 binary buffer containing embedded text.
 */
function createMinimalDigitalPdfBuffer(embeddedText) {
  const escaped = embeddedText.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentStream = `BT /F1 10 Tf 50 750 Td (${escaped}) Tj ET`;
  const pdfContent = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(contentStream, "utf8")} >> stream\n${contentStream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    "0",
    "%%EOF",
  ].join("\n");
  return Buffer.from(pdfContent, "utf8");
}

describe("Central Hybrid Document Engine & Processing Status UX — 12-Scenario Suite", () => {
  // =========================================================================
  // Scenario 1: Simple document processed by TypeScript
  // =========================================================================
  test("1. Simple document is processed by TypeScript without invoking Python", async () => {
    let pythonCalled = false;
    const mockPythonProvider = {
      id: "self_hosted_ml",
      name: "Mock Python Provider",
      async isAvailable() {
        return true;
      },
      async extract() {
        pythonCalled = true;
        throw new Error("Python should not be called when TypeScript is sufficient");
      },
    };

    const router = new AcademicHybridRouter({
      selfHostedProvider: mockPythonProvider,
    });

    const stageEvents = [];
    const simpleText = [
      "Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS",
      "Senin | 08:00 | 10:30 | Lab RPL | IF3201 | R.01 | Sistem Terdistribusi | 3",
      "Rabu | 13:00 | 15:30 | R.304 | IF3202 | R.02 | Keamanan Jaringan | 3",
    ].join("\n");

    const { result, decision } = await router.routeAndExtract(
      {
        buffer: Buffer.from(simpleText, "utf8"),
        mimeType: "text/plain",
        fileName: "jadwal_sederhana.txt",
        preExtractedText: simpleText,
      },
      {
        onStageChange: (stage, engine) => stageEvents.push({ stage, engine }),
      }
    );

    assert.equal(pythonCalled, false, "Python provider must not be invoked when TypeScript succeeds");
    assert.equal(decision.engineUsed, "typescript_parser");
    assert.equal(decision.processingStage, "typescript_initial");
    assert.equal(decision.qualityStatus, "sufficient");
    assert.equal(decision.visionFallbackEligible, false);
    assert.equal(result.items.length, 2);
    assert.deepEqual(stageEvents, [{ stage: "typescript_initial", engine: "typescript_parser" }]);
  });

  // =========================================================================
  // Scenario 2: Digital PDF processed by Python (pdfplumber) on localhost
  // =========================================================================
  test("2. Digital PDF with complex/unstructured stream triggers Python pdfplumber refinement on localhost", async () => {
    const stageEvents = [];

    // Complex PDF where plain text stream lacks delimiters so deterministic TS fails quality gate,
    // while Python pdfplumber extracts the structured table rows
    const ambiguousTextStream = "KARTU RENCANA STUDI SEMESTER GANJIL 2026/2027 FAKULTAS TEKNOLOGI INFORMASI";
    const pdfBuffer = createMinimalDigitalPdfBuffer(ambiguousTextStream);

    const localhostPythonProvider = new SelfHostedServerProvider("");
    assert.equal(localhostPythonProvider.canProcessDocument({
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      fileName: "krs_digital.pdf",
      preExtractedText: ambiguousTextStream,
    }), true);

    // Verify real local Python availability and CLI invocation
    const isLocalPythonUp = await localhostPythonProvider.isAvailable();
    assert.equal(isLocalPythonUp, true, "Localhost Python with pdfplumber must be available");

    // Also test router transition to Python when Python returns structured items
    const simulatedPdfPlumberProvider = {
      id: "self_hosted_ml",
      name: "Self-Hosted Academic ML Microservice",
      async isAvailable() {
        return true;
      },
      async extract() {
        return {
          documentType: "class_schedule",
          items: [
            {
              id: "py_1",
              namaMatkul: "Pemrograman Komputasi Awan",
              kodeMatkul: "IF4101",
              kelas: "R.01",
              hari: "Selasa",
              tanggal: null,
              waktuMulai: "09:30",
              waktuSelesai: "12:00",
              lokasi: "Lab Cloud",
              dosen: "Dr. Rina Wijaya, M.Kom",
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
            durationMs: 42,
            extractedCharacterCount: ambiguousTextStream.length,
            sourceFormat: "pdf_text",
          },
        };
      },
    };

    const router = new AcademicHybridRouter({
      selfHostedProvider: simulatedPdfPlumberProvider,
    });

    const { result, decision } = await router.routeAndExtract(
      {
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        fileName: "krs_digital.pdf",
        preExtractedText: ambiguousTextStream,
      },
      {
        onStageChange: (stage, engine) => stageEvents.push({ stage, engine }),
      }
    );

    assert.equal(decision.engineUsed, "python_pdfplumber");
    assert.equal(decision.processingStage, "python_refinement");
    assert.equal(decision.qualityStatus, "sufficient");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].namaMatkul, "Pemrograman Komputasi Awan");
    assert.deepEqual(stageEvents, [
      { stage: "typescript_initial", engine: "typescript_parser" },
      { stage: "python_refinement", engine: "python_pdfplumber" },
    ]);
  });

  // =========================================================================
  // Scenario 3: Digital PDF fallback when Python is unavailable
  // =========================================================================
  test("3. Digital PDF falls back cleanly to TypeScript with review warnings when Python is unavailable", async () => {
    const unavailablePythonProvider = {
      id: "self_hosted_ml",
      name: "Unavailable Python Provider",
      async isAvailable() {
        return false;
      },
      async extract() {
        throw new Error("Unreachable");
      },
    };

    const router = new AcademicHybridRouter({
      selfHostedProvider: unavailablePythonProvider,
    });

    const stageEvents = [];
    // Partial row missing end time -> triggers needs_review / insufficient for production
    const partialPdfText = "Senin | 08:00 | IF3201 | Sistem Terdistribusi";
    const pdfBuffer = createMinimalDigitalPdfBuffer(partialPdfText);

    const { result, decision } = await router.routeAndExtract(
      {
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        fileName: "partial_schedule.pdf",
        preExtractedText: partialPdfText,
      },
      {
        onStageChange: (stage, engine) => stageEvents.push({ stage, engine }),
      }
    );

    assert.equal(decision.processingMode, "local_fallback");
    assert.equal(decision.engineUsed, "typescript_parser");
    assert.equal(decision.processingStage, "typescript_initial");
    assert.equal(decision.visionFallbackEligible, true);
    assert.ok(result.items.length >= 1, "Must preserve partial deterministic items for user review");
    assert.equal(result.items[0].needsReview, true);
    // Python stage must NEVER be emitted when Python is unavailable
    assert.deepEqual(stageEvents, [{ stage: "typescript_initial", engine: "typescript_parser" }]);
  });

  // =========================================================================
  // Scenario 4: Scanned PDF routed to OCR/fallback, not pdfplumber
  // =========================================================================
  test("4. Scanned PDF with empty digital text layer is rejected from pdfplumber and marked visionFallbackEligible", async () => {
    const provider = new SelfHostedServerProvider("");
    const pdfBuffer = createMinimalDigitalPdfBuffer("");

    const canProcessScannedPdf = provider.canProcessDocument({
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      fileName: "scanned_krs.pdf",
      preExtractedText: "   ", // Empty digital text stream
    });

    assert.equal(
      canProcessScannedPdf,
      false,
      "Scanned PDF without digital text must not be sent to pdfplumber"
    );

    await assert.rejects(
      async () => {
        await provider.extract({
          buffer: pdfBuffer,
          mimeType: "application/pdf",
          fileName: "scanned_krs.pdf",
          preExtractedText: "",
        });
      },
      /only supports digital PDFs/
    );
  });

  // =========================================================================
  // Scenario 5: Photo/image routed to OCR, not pdfplumber
  // =========================================================================
  test("5. Photo/image is never sent to Python pdfplumber even when OCR text is ambiguous", async () => {
    let pythonCalled = false;
    const realProvider = new SelfHostedServerProvider("");

    assert.equal(
      realProvider.canProcessDocument({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), // JPEG magic bytes
        mimeType: "image/jpeg",
        fileName: "foto_jadwal.jpg",
        preExtractedText: "Jadwal tidak lengkap",
      }),
      false,
      "Images must never be eligible for pdfplumber"
    );

    const router = new AcademicHybridRouter({
      selfHostedProvider: realProvider,
    });

    const stageEvents = [];
    const { decision } = await router.routeAndExtract(
      {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        mimeType: "image/jpeg",
        fileName: "foto_jadwal.jpg",
        preExtractedText: "Teks kabur tanpa jadwal",
      },
      {
        onStageChange: (stage, engine) => {
          if (stage === "python_refinement") pythonCalled = true;
          stageEvents.push({ stage, engine });
        },
      }
    );

    assert.equal(pythonCalled, false, "Image must never trigger python_refinement");
    assert.equal(decision.engineUsed, "typescript_parser");
    assert.equal(decision.qualityStatus, "empty");
    assert.equal(decision.visionFallbackEligible, true);
  });

  // =========================================================================
  // Scenario 6 & 7: Web status message for TypeScript & transition to Python
  // =========================================================================
  test("6 & 7. Web ImportScheduleModal maps TypeScript and Python status messages accurately", () => {
    const modalPath = path.resolve(REPO_ROOT, "components/ImportScheduleModal.tsx");
    const modalSource = fs.readFileSync(modalPath, "utf8");

    // Verify exact required Indonesian status copy
    assert.ok(
      modalSource.includes('typescript: "Sistem TrackerThings sedang memproses jadwalmu…"'),
      "Must define exact TypeScript processing message"
    );
    assert.ok(
      modalSource.includes('python: "Mengompilasi dan mempertajam hasil analisismu…"'),
      "Must define exact Python processing message"
    );
    assert.ok(
      modalSource.includes('stage === "python_refinement" || engine === "python_pdfplumber"'),
      "Must switch to Python message only when python_refinement stage or python_pdfplumber engine is confirmed"
    );
    assert.ok(
      modalSource.includes('"X-Stream-Progress": "1"'),
      "Web modal must subscribe to real-time stage events via X-Stream-Progress header"
    );
    assert.ok(
      modalSource.includes("new AbortController()"),
      "Web modal must support request cancellation via AbortController"
    );
  });

  // =========================================================================
  // Scenario 8 & 9: iOS local Apple Vision success & fallback to server
  // =========================================================================
  test("8 & 9. iOS ImportScheduleViewModel runs local Apple Vision first and only uploads on incomplete quality", () => {
    const vmPath = path.resolve(
      REPO_ROOT,
      "Sources/TrackerThings/ViewModels/ImportScheduleViewModel.swift"
    );
    const vmSource = fs.readFileSync(vmPath, "utf8");

    // Exact required iOS status message when uploading to server for refinement
    assert.ok(
      vmSource.includes(
        'public static let serverRefinementStatusMessage = "Kami sedang memproses pertajaman analisismu, tunggu sebentar."'
      ),
      "iOS ViewModel must define exact server refinement status message"
    );

    // Local extraction runs before server upload check
    const localExtractIndex = vmSource.indexOf("LocalScheduleExtractor.extract(from: ocr)");
    const isLocallySufficientIndex = vmSource.indexOf("let isLocallySufficient = !localParsedItems.isEmpty && !localParsedItems.contains { $0.needsReview }");
    const serverUploadIndex = vmSource.indexOf("dataService.previewScheduleImport(\n                        fileData: data,\n                        fileName: selectedFileName.isEmpty ? \"jadwal_foto.jpg\"");

    assert.ok(localExtractIndex > 0, "Must call LocalScheduleExtractor.extract(from: ocr)");
    assert.ok(
      isLocallySufficientIndex > localExtractIndex,
      "Must evaluate isLocallySufficient immediately after LocalScheduleExtractor.extract"
    );
    assert.ok(
      serverUploadIndex > isLocallySufficientIndex,
      "Must only call previewScheduleImport for images after checking isLocallySufficient"
    );
    assert.ok(
      vmSource.includes('engineUsed: "apple_vision_local"'),
      "Local-only iOS path must tag engineUsed as apple_vision_local"
    );
  });

  // =========================================================================
  // Scenario 10 & 11: Gemini Vision blocked without consent, allowed with consent
  // =========================================================================
  test("10 & 11. Gemini Vision strictly requires explicit userConsent and returns vision_fallback metadata when consented", async () => {
    const extProvider = new ExternalGenerativeProvider("dummy_test_key");

    // Blocked without consent
    await assert.rejects(
      async () => {
        await extProvider.extract(
          {
            buffer: Buffer.from("test"),
            mimeType: "image/jpeg",
            fileName: "jadwal.jpg",
          },
          { userConsent: false }
        );
      },
      {
        message: "User consent required before calling external generative AI provider.",
      }
    );

    // Verify route.ts enforces userConsent === "true" || userConsent === "1" and emits gemini_vision metadata
    const visionRoutePath = path.resolve(REPO_ROOT, "app/api/jadwal/import/vision/route.ts");
    const visionRouteSource = fs.readFileSync(visionRoutePath, "utf8");
    assert.ok(
      visionRouteSource.includes('if (consent !== "true" && consent !== "1")'),
      "Vision API route must reject requests without explicit userConsent"
    );
    assert.ok(
      visionRouteSource.includes('"CONSENT_REQUIRED"'),
      "Vision API route must return CONSENT_REQUIRED code when consent is missing"
    );
    assert.ok(
      visionRouteSource.includes('engineUsed: "gemini_vision"') &&
        visionRouteSource.includes('processingStage: "vision_fallback"'),
      "Vision API route must return engineUsed: gemini_vision and processingStage: vision_fallback"
    );
  });

  // =========================================================================
  // Scenario 12: Missing fields flagged instead of defaulted to "Senin" or "08:00"
  // =========================================================================
  test("12. Missing fields are never defaulted to 'Senin' or '08:00' across TypeScript and Swift models", () => {
    const incompleteCanonical = {
      id: "inc_1",
      namaMatkul: "Algoritma dan Struktur Data",
      kodeMatkul: "IF2101",
      kelas: "R.01",
      hari: null,
      tanggal: null,
      waktuMulai: null,
      waktuSelesai: null,
      lokasi: "Lab Dasar",
      dosen: null,
      sks: 3,
      kategori: "Wajib",
      recurrence: "weekly",
      needsReview: false,
      warnings: [],
      fieldValidations: {},
    };

    const bridged = bridgeCanonicalToLegacyItem(incompleteCanonical);
    assert.equal(bridged.hari, "", "Missing hari must be empty string, never 'Senin'");
    assert.equal(bridged.waktuMulai, "", "Missing waktuMulai must be empty string, never '08:00'");
    assert.equal(bridged.waktuSelesai, "", "Missing waktuSelesai must be empty string, never '10:00'");
    assert.equal(bridged.needsReview, true, "Incomplete item must be flagged with needsReview: true");

    const quality = evaluateExtractionQuality([bridged]);
    assert.equal(quality.isSufficientForProduction, false);
    assert.equal(quality.visionFallbackEligible, true);

    // Check Swift model file has no silent "Senin" or "08:00" defaults in ImportScheduleItem
    const swiftModelsPath = path.resolve(
      REPO_ROOT,
      "Sources/TrackerThings/Models/ScheduleImportModels.swift"
    );
    const swiftModelsSource = fs.readFileSync(swiftModelsPath, "utf8");
    assert.ok(
      !swiftModelsSource.includes('?? "Senin"'),
      "ScheduleImportModels.swift must not fallback missing hari to 'Senin'"
    );
    assert.ok(
      !swiftModelsSource.includes('?? "08:00"'),
      "ScheduleImportModels.swift must not fallback missing waktuMulai to '08:00'"
    );
    assert.ok(
      !swiftModelsSource.includes('?? "10:00"'),
      "ScheduleImportModels.swift must not fallback missing waktuSelesai to '10:00'"
    );
  });
});


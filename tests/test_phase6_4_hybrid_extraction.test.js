/**
 * TrackerThings V2 — Phase 6.4: Hybrid Extraction & Layout-Aware Root Cause Fixes Suite
 *
 * Verifies:
 * 1. Banning silent fake value defaults (hari || "Senin", waktuMulai || "08:00")
 * 2. Merged-day table parsing preserves leading delimiters without column shift
 * 3. Spatial clustering handles normalized unit coordinates [0.0 ... 1.0] without collapsing
 * 4. Compound headers ("Mata Kuliah & Kode") split course code and course title
 * 5. Empty schedule returns explicit error code and triggers vision fallback eligibility
 * 6. Real complex PDF timetable extraction produces 100% complete courses
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const {
  groupWordsIntoVisualLines,
  parseScheduleText,
  parseScheduleFromWords,
  recognizeScheduleData,
  detectTableHeaderFromLines,
} = await import("../lib/scheduleParser.ts");

const {
  bridgeCanonicalToLegacyItem,
  AcademicHybridRouter,
  DeterministicAcademicExtractor,
  SelfHostedServerProvider,
} = await import("../lib/intelligence/academicEngine.ts");

const { evaluateExtractionQuality } = await import(
  "../lib/intelligence/extractionQualityEvaluator.ts"
);

test.describe("Phase 6.4: Hybrid Extraction & Layout-Aware Root Cause Fixes Suite", () => {
  // =========================================================================
  // 1. Data Integrity: Ban Silent Fake Value Fabrication
  // =========================================================================
  test.describe("1. Banning Silent Fake Defaults in Bridging", () => {
    test("1.1 Leaves missing hari, waktuMulai, and waktuSelesai empty (never defaults to Senin or 08:00)", () => {
      const canonicalItem = {
        id: "item_frag_1",
        namaMatkul: "Studio A",
        kodeMatkul: null,
        kelas: null,
        hari: null,
        tanggal: null,
        waktuMulai: null,
        waktuSelesai: null,
        lokasi: null,
        dosen: null,
        sks: null,
        kategori: "Wajib",
        recurrence: "none",
        needsReview: false,
        warnings: [],
        fieldValidations: {
          namaMatkul: { status: "valid" },
        },
      };

      const bridged = bridgeCanonicalToLegacyItem(canonicalItem);

      assert.strictEqual(bridged.hari, "", "hari must be empty string, NOT 'Senin'");
      assert.strictEqual(bridged.waktuMulai, "", "waktuMulai must be empty string, NOT '08:00'");
      assert.strictEqual(bridged.waktuSelesai, "", "waktuSelesai must be empty string, NOT '10:00'");
      assert.strictEqual(bridged.needsReview, true, "Missing required fields must force needsReview = true");
      assert.strictEqual(bridged.recognitionStatus, "needs_review");
      assert.ok(
        bridged.warnings.some((w) => w.includes("belum lengkap")),
        "Must record explanatory warning"
      );
    });

    test("1.2 Correctly preserves genuinely extracted schedule fields without alteration", () => {
      const canonicalItem = {
        id: "item_valid_1",
        namaMatkul: "Kalkulus Lanjut",
        kodeMatkul: "MAT-201",
        kelas: "A",
        hari: "Selasa",
        tanggal: null,
        waktuMulai: "10:00",
        waktuSelesai: "12:30",
        lokasi: "R.101",
        dosen: "Dr. Budi",
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
      };

      const bridged = bridgeCanonicalToLegacyItem(canonicalItem);
      assert.strictEqual(bridged.namaMatkul, "Kalkulus Lanjut");
      assert.strictEqual(bridged.hari, "Selasa");
      assert.strictEqual(bridged.waktuMulai, "10:00");
      assert.strictEqual(bridged.waktuSelesai, "12:30");
      assert.strictEqual(bridged.needsReview, false);
      assert.strictEqual(bridged.recognitionStatus, "high_confidence");
    });
  });

  // =========================================================================
  // 2. Merged Day Parsing & Leading Delimiter Preservation
  // =========================================================================
  test.describe("2. Merged Day Parsing & Column Alignment", () => {
    test("2.1 Preserves leading tab delimiter and propagates day to merged-cell rows", () => {
      const tsvTable = [
        "Hari\tWaktu\tMata Kuliah\tRuang",
        "Senin\t08:00 - 10:30\tStruktur Bangunan\tR. G301",
        "\t13:00 - 15:30\tSejarah Arsitektur\tR. G302",
        "Selasa\t08:00 - 13:00\tStudio Perancangan\tStudio A",
      ].join("\n");

      const parsed = parseScheduleText(tsvTable, [], []);

      assert.strictEqual(parsed.length, 3, "Must parse all 3 distinct courses without collapsing row 2");
      assert.strictEqual(parsed[0].namaMatkul, "Struktur Bangunan");
      assert.strictEqual(parsed[0].hari, "Senin");
      assert.strictEqual(parsed[0].waktuMulai, "08:00");

      assert.strictEqual(parsed[1].namaMatkul, "Sejarah Arsitektur");
      assert.strictEqual(parsed[1].hari, "Senin", "Row 2 must inherit 'Senin' from row 1");
      assert.strictEqual(parsed[1].waktuMulai, "13:00");
      assert.strictEqual(parsed[1].waktuSelesai, "15:30");

      assert.strictEqual(parsed[2].namaMatkul, "Studio Perancangan");
      assert.strictEqual(parsed[2].hari, "Selasa");
    });
  });

  // =========================================================================
  // 3. Coordinate Scaling for Apple Vision OCR Normalized Unit Bounding Boxes
  // =========================================================================
  test.describe("3. Coordinate Scaling in Visual Line Clustering", () => {
    test("3.1 Normalizes unit coordinates [0.0 ... 1.0] without collapsing words into 1 single line", () => {
      // 3 words across 3 separate vertical lines in unit space (y: 0.10, 0.25, 0.40)
      const unitWords = [
        { text: "Senin", bbox: { x0: 0.05, y0: 0.10, x1: 0.15, y1: 0.12 } },
        { text: "08:00", bbox: { x0: 0.20, y0: 0.10, x1: 0.30, y1: 0.12 } },
        { text: "Selasa", bbox: { x0: 0.05, y0: 0.25, x1: 0.15, y1: 0.27 } },
        { text: "09:00", bbox: { x0: 0.20, y0: 0.25, x1: 0.30, y1: 0.27 } },
        { text: "Rabu", bbox: { x0: 0.05, y0: 0.40, x1: 0.15, y1: 0.42 } },
        { text: "10:00", bbox: { x0: 0.20, y0: 0.40, x1: 0.30, y1: 0.42 } },
      ];

      const lines = groupWordsIntoVisualLines(unitWords);

      assert.strictEqual(lines.length, 3, "Words across 3 vertical tiers must form exactly 3 lines");
      assert.strictEqual(lines[0].words.map((w) => w.text).join(" "), "Senin 08:00");
      assert.strictEqual(lines[1].words.map((w) => w.text).join(" "), "Selasa 09:00");
      assert.strictEqual(lines[2].words.map((w) => w.text).join(" "), "Rabu 10:00");
    });
  });

  // =========================================================================
  // 4. Compound Header & Embedded Course Code Recognition
  // =========================================================================
  test.describe("4. Compound Header & Course Code Extraction", () => {
    test("4.1 Extracts course code and title from compound 'Mata Kuliah & Kode' column", () => {
      const tableWithCompoundHeader = [
        "Hari\tWaktu\tMata Kuliah & Kode\tRuang\tSKS",
        "Senin\t08:00 - 10:30\tARS-301 Struktur Bangunan 2\tR. G301\t3",
        "Selasa\t13:00 - 15:30\tSejarah Arsitektur 2 ARS-303\tR. G302\t3",
      ].join("\n");

      const parsed = parseScheduleText(tableWithCompoundHeader, [], []);

      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].kodeMatkul, "ARS-301");
      assert.strictEqual(parsed[0].namaMatkul, "Struktur Bangunan 2");
      assert.strictEqual(parsed[0].sks, 3);

      assert.strictEqual(parsed[1].kodeMatkul, "ARS-303");
      assert.strictEqual(parsed[1].namaMatkul, "Sejarah Arsitektur 2");
      assert.strictEqual(parsed[1].sks, 3);
    });
  });

  // =========================================================================
  // 5. Explicit Machine-Readable Failure for Zero Usable Items
  // =========================================================================
  test.describe("5. Machine-Readable Zero Extraction Gate", () => {
    test("5.1 Signals vision fallback eligibility when zero usable courses are extracted", () => {
      const emptyRecog = recognizeScheduleData({ text: "Nama: Budi\nFakultas Teknik\nUniversitas\n" });
      const quality = evaluateExtractionQuality(emptyRecog.items);

      assert.strictEqual(quality.score.validItemsCount, 0, "No confident valid items extracted from non-schedule metadata");
      assert.strictEqual(quality.isSufficientForProduction, false);
      assert.strictEqual(quality.visionFallbackEligible, true);
      assert.ok(quality.reasons.length > 0);

      const pureEmptyRecog = recognizeScheduleData({ text: "" });
      assert.strictEqual(pureEmptyRecog.items.length, 0);
    });
  });

  // =========================================================================
  // 6. Real Document Benchmark Invariant: Architecture Timetable (24 SKS)
  // =========================================================================
  test.describe("6. Real Document Validation on Complex Timetable", () => {
    test("6.1 Layout-aware table extraction parses all 8 courses and 24 SKS from Jadwal_Kuliah_Arsitektur.pdf", async () => {
      const realPdfPath = "C:/Users/Budy/Downloads/Jadwal_Kuliah_Arsitektur.pdf";
      if (!fs.existsSync(realPdfPath)) {
        return; // Skip if run in CI without local downloads
      }

      const { execFileSync } = await import("child_process");
      const rawOutput = execFileSync(
        "python",
        ["-m", "api.extractor", realPdfPath, "--mime", "application/pdf"],
        { encoding: "utf8", timeout: 15000 }
      );

      const lines = rawOutput.trim().split("\n");
      const json = JSON.parse(lines[lines.length - 1]);

      assert.strictEqual(json.totalItems, 8, "Must extract exactly 8 courses");
      assert.strictEqual(json.needsReviewCount, 0, "All courses must be confident");

      const totalSks = json.items.reduce((acc, it) => acc + (it.sks || 0), 0);
      assert.strictEqual(totalSks, 24, "Total SKS must equal 24");

      const days = json.items.map((it) => it.hari);
      assert.deepStrictEqual(days, [
        "Senin",
        "Senin",
        "Selasa",
        "Rabu",
        "Rabu",
        "Kamis",
        "Kamis",
        "Jumat",
      ]);

      const codes = json.items.map((it) => it.kodeMatkul);
      assert.deepStrictEqual(codes, [
        "ARS-301",
        "ARS-303",
        "ARS-305",
        "ARS-307",
        "ARS-309",
        "ARS-311",
        "MKU-104",
        "ARS-313",
      ]);
    });
  });

  // =========================================================================
  // 7. Vercel Production Runtime Gate & Hybrid Provider Resolution
  // =========================================================================
  test.describe("7. Vercel Production Runtime Gate & Microservice Routing", () => {
    test("7.1 SelfHostedServerProvider normalizes endpoints to /api/python correctly", () => {
      const p1 = new SelfHostedServerProvider("https://trackerthings.vercel.app");
      assert.strictEqual(
        p1.getEffectiveEndpointUrl(),
        "https://trackerthings.vercel.app/api/python"
      );

      const p2 = new SelfHostedServerProvider("https://trackerthings.vercel.app/api/python");
      assert.strictEqual(
        p2.getEffectiveEndpointUrl(),
        "https://trackerthings.vercel.app/api/python"
      );

      const p3 = new SelfHostedServerProvider("https://trackerthings.vercel.app/api/python/");
      assert.strictEqual(
        p3.getEffectiveEndpointUrl(),
        "https://trackerthings.vercel.app/api/python"
      );
    });

    test("7.2 In serverless environment (VERCEL=1), local python subprocess is strictly disabled", async () => {
      const originalVercel = process.env.VERCEL;
      try {
        process.env.VERCEL = "1";
        const provider = new SelfHostedServerProvider("http://invalid-unreachable-domain-xyz.internal");
        const isLocalAvailable = await provider.checkLocalPythonAvailable();
        assert.strictEqual(
          isLocalAvailable,
          false,
          "checkLocalPythonAvailable must return false when VERCEL=1"
        );
      } finally {
        if (originalVercel !== undefined) {
          process.env.VERCEL = originalVercel;
        } else {
          delete process.env.VERCEL;
        }
      }
    });

    test("7.3 SelfHostedServerProvider connects to live Vercel Python service health check", async () => {
      const provider = new SelfHostedServerProvider("https://trackerthings.vercel.app/api/python");
      const available = await provider.isAvailable();
      assert.strictEqual(available, true, "Live Vercel Python endpoint /health must return 200 OK");
    });

    test("7.4 Live Vercel Python endpoint extracts digital_schedule.pdf via multipart contract", async () => {
      const pdfPath = "datasets/test_set/digital_schedule.pdf";
      if (!fs.existsSync(pdfPath)) return;

      const provider = new SelfHostedServerProvider("https://trackerthings.vercel.app/api/python");
      const pdfBuffer = fs.readFileSync(pdfPath);

      const result = await provider.extract({
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        fileName: "digital_schedule.pdf",
      });

      assert.strictEqual(result.totalItems, 4, "Must extract 4 courses from digital_schedule.pdf");
      assert.strictEqual(result.insufficientForPersistence, false);
      assert.strictEqual(result.items[0].namaMatkul, "Rekayasa Perangkat Lunak");
      assert.strictEqual(result.items[0].hari, "Senin");
      assert.strictEqual(result.items[0].waktuMulai, "08:00");
    });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const TEST_USER_ID = 99992;

// Isolated in-memory Prisma mock setup BEFORE importing routes
globalThis.prisma = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === TEST_USER_ID) {
        return {
          id: TEST_USER_ID,
          username: "quality_tester",
          email: "quality@trackerthings.local",
          role: "student",
          passwordChangedAt: null,
        };
      }
      return null;
    },
  },
  jadwal: {
    findMany: async () => [],
    create: async ({ data }) => ({ id: 1, ...data }),
  },
  systemSetting: {
    findUnique: async () => ({
      settingKey: `schedule_mappings_user_${TEST_USER_ID}`,
      settingValue: JSON.stringify([]),
    }),
    upsert: async () => ({}),
  },
  $transaction: async (operations) => Promise.all(operations),
};

// Dynamically import tested modules
const {
  evaluateExtractionQuality,
  DEFAULT_QUALITY_GATE_CONFIG,
} = await import("../lib/intelligence/extractionQualityEvaluator.ts");
const {
  bridgeCanonicalToLegacyItem,
} = await import("../lib/intelligence/academicEngine.ts");
const { LOCAL_OCR_CONFIG } = await import("../lib/ocr/browserOcr.ts");
const { POST: visionPost } = await import("../app/api/jadwal/import/vision/route.ts");
const { POST: previewPost } = await import("../app/api/jadwal/import/preview/route.ts");
const { signSessionToken } = await import("../lib/auth.ts");
const { NextRequest } = await import("next/server");
const { setVisionProviderOverride, MockVisionProvider } = await import("../lib/visionProvider.ts");

test.describe("Phase 3 & 4: Web Offline OCR & Quality Gates Suite", () => {
  let testUserToken = "";

  test.before(async () => {
    testUserToken = await signSessionToken({
      userId: TEST_USER_ID,
      username: "quality_tester",
      role: "student",
    });
  });

  test.beforeEach(() => {
    setVisionProviderOverride(null);
  });

  function createNextRequest(url, method = "POST", formData = null, headers = {}) {
    const defaultHeaders = {
      Authorization: `Bearer ${testUserToken}`,
      ...headers,
    };
    return new NextRequest(url, {
      method,
      headers: defaultHeaders,
      body: formData,
    });
  }

  // =========================================================================
  // 1. Phase 3 — Local Web OCR Asset Integrity
  // =========================================================================
  test.describe("1. Local Web OCR Asset Integrity", () => {
    test("1.1 LOCAL_OCR_CONFIG uses origin paths and zero external CDNs", () => {
      assert.equal(LOCAL_OCR_CONFIG.workerPath, "/tesseract/worker.min.js");
      assert.equal(LOCAL_OCR_CONFIG.corePath, "/tesseract/core");
      assert.equal(LOCAL_OCR_CONFIG.langPath, "/tesseract/lang");
      assert.equal(LOCAL_OCR_CONFIG.gzip, true);

      // Verify no CDN strings exist in configuration
      for (const val of Object.values(LOCAL_OCR_CONFIG)) {
        if (typeof val === "string") {
          assert.ok(!val.includes("cdn.jsdelivr.net"), "Must not use CDN URLs");
          assert.ok(!val.includes("unpkg.com"), "Must not use unpkg URLs");
          assert.ok(!val.includes("http://") && !val.includes("https://"), "Must use origin-relative paths");
        }
      }
    });

    test("1.2 Required local worker, WASM core, and traineddata files exist with verified sizes", () => {
      const publicDir = path.resolve("public/tesseract");

      const workerPath = path.join(publicDir, "worker.min.js");
      assert.ok(fs.existsSync(workerPath), "worker.min.js must exist");
      assert.ok(fs.statSync(workerPath).size > 100000, "worker.min.js must be > 100 KB");

      // Modern browser preferred Relaxed-SIMD core
      const relaxedSimdCorePath = path.join(publicDir, "core", "tesseract-core-relaxedsimd-lstm.wasm.js");
      assert.ok(fs.existsSync(relaxedSimdCorePath), "Relaxed-SIMD LSTM core must exist");
      assert.ok(fs.statSync(relaxedSimdCorePath).size > 3500000, "Relaxed-SIMD LSTM core must be > 3.5 MB");

      const simdCorePath = path.join(publicDir, "core", "tesseract-core-simd-lstm.wasm.js");
      assert.ok(fs.existsSync(simdCorePath), "SIMD core must exist");
      assert.ok(fs.statSync(simdCorePath).size > 3500000, "SIMD core must be > 3.5 MB");

      const lstmCorePath = path.join(publicDir, "core", "tesseract-core-lstm.wasm.js");
      assert.ok(fs.existsSync(lstmCorePath), "LSTM core fallback must exist");
      assert.ok(fs.statSync(lstmCorePath).size > 3500000, "LSTM core fallback must be > 3.5 MB");

      // Full/combined model fallbacks
      const relaxedSimdFullPath = path.join(publicDir, "core", "tesseract-core-relaxedsimd.wasm.js");
      assert.ok(fs.existsSync(relaxedSimdFullPath), "Relaxed-SIMD full core must exist");
      assert.ok(fs.statSync(relaxedSimdFullPath).size > 4000000, "Relaxed-SIMD full core must be > 4.0 MB");

      const simdFullPath = path.join(publicDir, "core", "tesseract-core-simd.wasm.js");
      assert.ok(fs.existsSync(simdFullPath), "SIMD full core must exist");
      assert.ok(fs.statSync(simdFullPath).size > 4000000, "SIMD full core must be > 4.0 MB");

      const genericFullPath = path.join(publicDir, "core", "tesseract-core.wasm.js");
      assert.ok(fs.existsSync(genericFullPath), "Generic full core must exist");
      assert.ok(fs.statSync(genericFullPath).size > 4000000, "Generic full core must be > 4.0 MB");

      const indLangPath = path.join(publicDir, "lang", "ind.traineddata.gz");
      assert.ok(fs.existsSync(indLangPath), "ind.traineddata.gz must exist");
      assert.ok(fs.statSync(indLangPath).size > 1000000, "ind.traineddata.gz must be > 1 MB");

      const engLangPath = path.join(publicDir, "lang", "eng.traineddata.gz");
      assert.ok(fs.existsSync(engLangPath), "eng.traineddata.gz must exist");
      assert.ok(fs.statSync(engLangPath).size > 2500000, "eng.traineddata.gz must be > 2.5 MB");
    });
  });

  // =========================================================================
  // 2. Phase 4 — Evidence-Based Quality Gates
  // =========================================================================
  test.describe("2. Evidence-Based Quality Gates", () => {
    test("2.1 High quality extraction with complete required fields passes quality gate", () => {
      const validItems = [
        { namaMatkul: "Rekayasa Perangkat Lunak", hari: "Senin", waktuMulai: "08:00", waktuSelesai: "10:30", sks: 3 },
        { namaMatkul: "Sistem Basis Data", hari: "Selasa", waktuMulai: "10:30", waktuSelesai: "13:00", sks: 3 },
        { namaMatkul: "Kecerdasan Buatan", hari: "Rabu", waktuMulai: "13:30", waktuSelesai: "15:10", sks: 2 },
        { namaMatkul: "Jaringan Komputer", hari: "Kamis", waktuMulai: "08:00", waktuSelesai: "10:30", sks: 3 },
      ];

      const decision = evaluateExtractionQuality(validItems);
      assert.equal(decision.isSufficientForProduction, true, "Valid batch must be sufficient for production");
      assert.equal(decision.visionFallbackEligible, false, "Valid batch does not require vision fallback");
      assert.equal(decision.score.passRatePercent, 100);
      assert.equal(decision.score.hasTimeErrors, false);
      assert.equal(decision.score.hasWeekdayErrors, false);
      assert.equal(decision.recommendation, "accept");
    });

    test("2.2 Extraction with invalid time intervals (start >= end) fails quality gate and is flagged", () => {
      const itemsWithTimeError = [
        { namaMatkul: "Algoritma Pemrograman", hari: "Senin", waktuMulai: "11:00", waktuSelesai: "08:00" }, // inverted!
        { namaMatkul: "Matematika Diskrit", hari: "Selasa", waktuMulai: "10:00", waktuSelesai: "12:00" },
      ];

      const decision = evaluateExtractionQuality(itemsWithTimeError);
      assert.equal(decision.isSufficientForProduction, false);
      assert.equal(decision.visionFallbackEligible, true);
      assert.equal(decision.score.hasTimeErrors, true);
      assert.equal(decision.score.timeErrorCount, 1);
      assert.ok(decision.reasons.some((r) => r.includes("mendahului atau sama dengan jam selesai")));
      assert.equal(decision.recommendation, "offer_vision_fallback");
    });

    test("2.3 Extraction with unresolvable weekdays triggers review and vision fallback eligibility", () => {
      const itemsWithBadWeekday = [
        { namaMatkul: "Pemrograman Web", hari: "UnknownDay123", waktuMulai: "08:00", waktuSelesai: "10:00" },
        { namaMatkul: "Etika Profesi", hari: "Senin", waktuMulai: "10:00", waktuSelesai: "12:00" },
      ];

      const decision = evaluateExtractionQuality(itemsWithBadWeekday);
      assert.equal(decision.isSufficientForProduction, false);
      assert.equal(decision.visionFallbackEligible, true);
      assert.equal(decision.score.hasWeekdayErrors, true);
      assert.equal(decision.score.weekdayErrorCount, 1);
      assert.ok(decision.reasons.some((r) => r.includes("tidak valid")));
    });

    test("2.4 Zero extracted items triggers immediate vision fallback recommendation", () => {
      const decision = evaluateExtractionQuality([]);
      assert.equal(decision.isSufficientForProduction, false);
      assert.equal(decision.visionFallbackEligible, true);
      assert.equal(decision.score.totalItems, 0);
      assert.equal(decision.recommendation, "offer_vision_fallback");
    });

    test("2.5 Quality threshold is configurable and respects custom config", () => {
      const halfUncertainItems = [
        { namaMatkul: "Mata Kuliah 1", hari: "Senin", waktuMulai: "08:00", waktuSelesai: "10:00", needsReview: false },
        { namaMatkul: "Mata Kuliah 2", hari: "Selasa", waktuMulai: "10:00", waktuSelesai: "12:00", needsReview: true },
      ];

      // Default threshold requires 75% pass rate (this has 50%)
      const defaultDecision = evaluateExtractionQuality(halfUncertainItems);
      assert.equal(defaultDecision.isSufficientForProduction, false);

      // Relaxed threshold allowing 50% pass rate and 0.50 uncertain ratio
      const relaxedDecision = evaluateExtractionQuality(halfUncertainItems, {
        minPassRatePercent: 50,
        maxUncertainRatio: 0.50,
      });
      assert.equal(relaxedDecision.isSufficientForProduction, true);
    });
  });

  // =========================================================================
  // 3. Vision Fallback Consent Guards
  // =========================================================================
  test.describe("3. Vision Fallback Consent Enforcement", () => {
    test("3.1 Vision endpoint rejects upload if userConsent is missing (HTTP 400)", async () => {
      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from("dummy-image-data")], { type: "image/jpeg" }), "test.jpg");
      // userConsent missing

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/vision", "POST", formData);
      const res = await visionPost(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.equal(json.success, false);
      assert.equal(json.error, "CONSENT_REQUIRED");
      assert.ok(json.message.includes("Persetujuan"));
    });

    test("3.2 Vision endpoint processes with explicit userConsent='true'", async () => {
      setVisionProviderOverride(new MockVisionProvider());

      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from("dummy-image-data")], { type: "image/jpeg" }), "test.jpg");
      formData.append("userConsent", "true");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/vision", "POST", formData);
      const res = await visionPost(req);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.items), "Must return extracted preview items");
    });
  });

  // =========================================================================
  // 4. Canonical & Legacy Response Compatibility
  // =========================================================================
  test.describe("4. Canonical and Legacy Response Compatibility", () => {
    test("4.1 bridgeCanonicalToLegacyItem generates dual keys for iOS Codable and Web UI", () => {
      const canonicalItem = {
        id: "item_test_101",
        namaMatkul: "Sistem Terdistribusi",
        kodeMatkul: "IF320",
        kelas: "A",
        hari: "Rabu",
        tanggal: null,
        waktuMulai: "09:00",
        waktuSelesai: "11:30",
        lokasi: "Lab-4",
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

      // Verify dual-key naming for Swift Codable & Web camelCase
      assert.equal(bridged.namaMatkul, "Sistem Terdistribusi");
      assert.equal(bridged.nama_matkul, "Sistem Terdistribusi");
      assert.equal(bridged.waktuMulai, "09:00");
      assert.equal(bridged.waktu_mulai, "09:00");
      assert.equal(bridged.waktuSelesai, "11:30");
      assert.equal(bridged.waktu_selesai, "11:30");
      assert.equal(bridged.lokasi, "Lab-4");
      assert.equal(bridged.ruang, "Lab-4");
      assert.equal(bridged.needsReview, false);
      assert.equal(bridged.needs_review, false);
      assert.equal(bridged.fieldConfidence.namaMatkul.level, "high");
      assert.equal(bridged.field_confidence.namaMatkul, 0.95);
    });
  });

  // =========================================================================
  // 5. Preview Route with Evaluated Quality Gates
  // =========================================================================
  test.describe("5. Preview Route with Evaluated Quality Gates", () => {
    test("5.1 Preview route evaluates quality gates and surfaces insufficiency reasons", async () => {
      const rawText = [
        "KRS MAHASISWA",
        "1 SISTEM DIGITAL SENIN 08:00 - 10:00 LAB-1 3 SKS",
        "2 PENGANTAR AI KAMIS 14:00 - 09:00 LAB-2 3 SKS" // time inversion!
      ].join("\n");

      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from("dummy-image-bytes")], { type: "image/jpeg" }), "schedule.jpg");
      formData.append("rawText", rawText);
      formData.append("ocrWords", JSON.stringify([]));

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.equal(json.data.insufficient_for_production, true);
      assert.equal(json.data.vision_fallback_eligible, true);
      assert.ok(json.data.insufficiency_reasons.length > 0);
    });
  });
});

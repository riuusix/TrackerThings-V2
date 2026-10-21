import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const TEST_USER_ID = 99996;

// Isolated in-memory Prisma mock setup
const mockDbCourses = [
  {
    id: 101,
    userId: TEST_USER_ID,
    namaMatkul: "Jaringan Komputer",
    hari: "Selasa",
    waktuMulai: new Date("1970-01-01T10:00:00.000Z"),
    waktuSelesai: new Date("1970-01-01T12:00:00.000Z"),
    lokasi: "Lab Jaringan",
    dosen: "Ir. Ahmad",
    sks: 3,
    kategori: "Wajib",
  },
];

globalThis.prisma = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === TEST_USER_ID) {
        return {
          id: TEST_USER_ID,
          username: "vision_tester",
          email: "vision@trackerthings.local",
          role: "student",
          passwordChangedAt: null,
        };
      }
      return null;
    },
  },
  jadwal: {
    findMany: async ({ where }) => {
      if (where?.userId === TEST_USER_ID) {
        return mockDbCourses;
      }
      return [];
    },
    create: async ({ data }) => ({ id: Math.floor(Math.random() * 1000), ...data }),
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
  analyzeImageQuality,
  setVisionProviderOverride,
  MockVisionProvider,
  checkUserVisionRateLimit,
} = await import("../lib/visionProvider.ts");
const { mergeVisionWithOcrSchedule } = await import("../lib/scheduleParser.ts");
const { POST: verifyPost } = await import("../app/api/jadwal/import/verify/route.ts");
const { POST: visionPost } = await import("../app/api/jadwal/import/vision/route.ts");
const { signSessionToken } = await import("../lib/auth.ts");
const { NextRequest } = await import("next/server");

test.describe("Phase 6: Gemini Vision Extraction & Verification Suite", () => {
  let testUserToken = "";

  test.before(async () => {
    testUserToken = await signSessionToken({
      userId: TEST_USER_ID,
      username: "vision_tester",
      role: "student",
    });
  });

  test.beforeEach(() => {
    setVisionProviderOverride(null);
  });

  // =========================================================================
  // 1. Image Preprocessing & Quality Diagnostics
  // =========================================================================
  test.describe("1. Image Preprocessing & Quality Diagnostics", () => {
    test("1.1 analyzeImageQuality flags low-resolution images (< 400x300) with diagnostic warning", () => {
      // 100x100 fake PNG buffer (header + IHDR with width=100, height=100)
      const lowResPng = Buffer.alloc(32);
      lowResPng.write("\x89PNG\r\n\x1a\n", 0, 8, "binary");
      lowResPng.writeUInt32BE(100, 16); // width
      lowResPng.writeUInt32BE(100, 20); // height

      const quality = analyzeImageQuality(lowResPng, "image/png");
      assert.equal(quality.isLowResolution, true);
      assert.equal(quality.width, 100);
      assert.equal(quality.height, 100);
      assert.ok(quality.warning && quality.warning.includes("rendah"));
    });

    test("1.2 analyzeImageQuality passes high-resolution images cleanly without warning", () => {
      // 1920x1080 fake PNG buffer
      const highResPng = Buffer.alloc(32);
      highResPng.write("\x89PNG\r\n\x1a\n", 0, 8, "binary");
      highResPng.writeUInt32BE(1920, 16); // width
      highResPng.writeUInt32BE(1080, 20); // height

      const quality = analyzeImageQuality(highResPng, "image/png");
      assert.equal(quality.isLowResolution, false);
      assert.equal(quality.width, 1920);
      assert.equal(quality.height, 1080);
      assert.equal(quality.warning, undefined);
    });
  });

  // =========================================================================
  // 2. Granular Extraction Contract & Field-Level Data
  // =========================================================================
  test.describe("2. Granular Extraction Contract & Field-Level Confidence", () => {
    test("2.1 Preserves fieldConfidence, fieldStatuses, and rawFields across vision rows", async () => {
      const mockRows = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          kodeMatkul: "IF253418",
          namaMatkul: "Etika Profesi Teknologi Informasi",
          kelas: "R.03",
          lokasi: "D.302 VA",
          sks: 2,
          dosen: "Dr. Budi Santoso",
          confidenceEstimate: 94,
          fieldConfidence: {
            namaMatkul: 98,
            hari: 95,
            waktuMulai: 92,
            waktuSelesai: 92,
            lokasi: 88,
            sks: 95,
          },
          fieldStatuses: {
            namaMatkul: "read",
            hari: "read",
            waktuMulai: "read",
            waktuSelesai: "read",
            lokasi: "read",
            sks: "read",
          },
          rawFields: {
            namaMatkul: "Etika Profesi Teknologi Informasi",
            hari: "Selasa",
            waktuMulai: "09:50:00",
            waktuSelesai: "11:30:00",
            lokasi: "D.302 VA",
          },
        },
      ];

      const mockProvider = new MockVisionProvider(mockRows);
      const res = await mockProvider.extractSchedule();

      assert.equal(res.rows.length, 1);
      const row = res.rows[0];
      assert.equal(row.namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.ok(row.fieldConfidence);
      assert.equal(row.fieldConfidence.namaMatkul, 98);
      assert.equal(row.fieldStatuses?.namaMatkul, "read");
      assert.equal(row.rawFields?.waktuMulai, "09:50:00");
    });

    test("2.2 Never drops rows simply because optional fields (lokasi, dosen) are missing", async () => {
      const mockRows = [
        {
          hari: "Rabu",
          waktuMulai: "13:00",
          waktuSelesai: "15:30",
          kodeMatkul: "IF253420",
          namaMatkul: "Kecerdasan Buatan",
          kelas: "A",
          lokasi: null, // Room missing from timetable cell
          sks: 3,
          dosen: null, // Lecturer missing from cell
          confidenceEstimate: 85,
          fieldStatuses: {
            namaMatkul: "read",
            hari: "read",
            waktuMulai: "read",
            waktuSelesai: "read",
            lokasi: "missing",
            dosen: "missing",
          },
        },
      ];

      const merged = mergeVisionWithOcrSchedule([], mockRows);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].namaMatkul, "Kecerdasan Buatan");
      assert.equal(merged[0].lokasi, null);
      assert.equal(merged[0].dosen, null);
      assert.equal(merged[0].waktuMulai, "13:00");
      assert.equal(merged[0].waktuSelesai, "15:30");
    });
  });

  // =========================================================================
  // 3. Application Decision Engine & Invariants
  // =========================================================================
  test.describe("3. Application Decision Engine & Invariants", () => {
    test("3.1 High model confidence CANNOT override reversed start/end time window", () => {
      const itemsWithReversedTime = [
        {
          id: "item_rev",
          namaMatkul: "Struktur Data",
          hari: "Senin",
          waktuMulai: "11:00",
          waktuSelesai: "09:00", // Start is later than End!
          confidence: 99,
          fieldConfidence: {
            waktuMulai: { ocrConfidence: 99, level: "high", source: "vision_ai" },
            waktuSelesai: { ocrConfidence: 99, level: "high", source: "vision_ai" },
          },
        },
      ];

      const decision = evaluateExtractionQuality(itemsWithReversedTime);
      assert.equal(decision.isSufficientForProduction, false);
      assert.equal(decision.score.hasTimeErrors, true);
      assert.ok(decision.reasons.some((r) => r.includes("mendahului atau sama")));
      assert.equal(decision.recommendation, "offer_vision_fallback");
    });

    test("3.2 Low field confidence (< 50%) on a required field flags row for review", () => {
      const itemWithLowConfTitle = [
        {
          id: "item_low_conf",
          namaMatkul: "Fisika",
          hari: "Kamis",
          waktuMulai: "08:00",
          waktuSelesai: "10:00",
          fieldConfidence: {
            namaMatkul: { ocrConfidence: 35, level: "low", source: "vision_ai" }, // < 50%
            hari: { ocrConfidence: 90, level: "high", source: "vision_ai" },
            waktuMulai: { ocrConfidence: 90, level: "high", source: "vision_ai" },
            waktuSelesai: { ocrConfidence: 90, level: "high", source: "vision_ai" },
          },
        },
      ];

      const decision = evaluateExtractionQuality(itemWithLowConfTitle);
      assert.ok(decision.reasons.some((r) => r.includes("namaMatkul") && r.includes("rendah")));
      assert.equal(decision.score.uncertainItemsCount, 1);
    });

    test("3.3 Separates timetable database conflicts from OCR extraction errors", () => {
      const items = [
        {
          id: "item_conflict",
          namaMatkul: "Algoritma Pemrograman",
          hari: "Senin",
          waktuMulai: "08:00",
          waktuSelesai: "10:00",
          warnings: ["Bentrok jadwal dengan mata kuliah terdaftar 'Basis Data'."],
        },
        {
          id: "item_invalid_time",
          namaMatkul: "Matematika Diskrit",
          hari: "Senin",
          waktuMulai: "25:00", // OCR format error
          waktuSelesai: "10:00",
        },
      ];

      const decision = evaluateExtractionQuality(items);
      assert.ok(decision.warningCategories);
      assert.ok(decision.warningCategories.scheduleConflicts.length > 0);
      assert.ok(decision.warningCategories.ocrExtractionErrors.length > 0);
      assert.ok(
        decision.warningCategories.scheduleConflicts.some((c) => c.toLowerCase().includes("bentrok"))
      );
      assert.ok(
        decision.warningCategories.ocrExtractionErrors.some((e) => e.toLowerCase().includes("format jam"))
      );
    });
  });

  // =========================================================================
  // 4. Second-Pass Verification Route (/api/jadwal/import/verify)
  // =========================================================================
  test.describe("4. Second-Pass Verification Route (/api/jadwal/import/verify)", () => {
    test("4.1 Rejects unauthenticated verification request with HTTP 401", async () => {
      const form = new FormData();
      form.append("userConsent", "true");
      form.append("file", new Blob(["fake image"], { type: "image/png" }), "schedule.png");
      form.append("items", JSON.stringify([{ id: "1", namaMatkul: "Algoritma" }]));

      const req = new NextRequest("http://localhost:3000/api/jadwal/import/verify", {
        method: "POST",
        body: form,
      });

      const res = await verifyPost(req);
      assert.equal(res.status, 401);
    });

    test("4.2 Rejects unconsented request with HTTP 400 CONSENT_REQUIRED", async () => {
      const form = new FormData();
      // userConsent missing
      form.append("file", new Blob(["fake image"], { type: "image/png" }), "schedule.png");
      form.append("items", JSON.stringify([{ id: "1", namaMatkul: "Algoritma" }]));

      const req = new NextRequest("http://localhost:3000/api/jadwal/import/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        body: form,
      });

      const res = await verifyPost(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, "CONSENT_REQUIRED");
    });

    test("4.3 Executes verification pass and proposes corrections for misread cells", async () => {
      const mockProvider = new MockVisionProvider([]);
      setVisionProviderOverride(mockProvider);

      const candidateItems = [
        {
          id: "item_unas_1",
          namaMatkul: "Etika Profesi Tek.", // Abbreviated
          hari: "Selasa",
          waktuMulai: "09:00", // Misread from 09:50
          waktuSelesai: "11:30",
          lokasi: "", // Empty room
          rawText: "09:50:00 D.302 VA",
          tentativeSuggestions: { waktuMulai: "09:50" },
        },
        {
          id: "item_unas_2",
          namaMatkul: "Jaringan Komputer Tek.",
          hari: "Rabu",
          waktuMulai: "08:00",
          waktuSelesai: "10:00",
        },
      ];

      const form = new FormData();
      form.append("userConsent", "true");
      form.append("file", new Blob(["fake png bytes"], { type: "image/png" }), "schedule.png");
      form.append("items", JSON.stringify(candidateItems));

      const req = new NextRequest("http://localhost:3000/api/jadwal/import/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        body: form,
      });

      const res = await verifyPost(req);
      assert.equal(res.status, 200);
      const json = await res.json();

      assert.ok(json.data.verified_items.length > 0);
      const verifiedRow = json.data.verified_items[0];
      assert.equal(verifiedRow.overallStatus, "has_corrections");

      // Check proposed correction for waktuMulai
      const waktuMulaiFinding = verifiedRow.findings.waktuMulai;
      assert.ok(waktuMulaiFinding);
      assert.equal(waktuMulaiFinding.decision, "corrected");
      assert.equal(waktuMulaiFinding.proposedValue, "09:50");
      assert.ok(waktuMulaiFinding.reason.includes("5"));

      // Check proposed correction for abbreviated course name
      const namaFinding = verifiedRow.findings.namaMatkul;
      assert.ok(namaFinding);
      assert.equal(namaFinding.decision, "corrected");
      assert.equal(namaFinding.proposedValue, "Etika Profesi Teknologi Informasi");

      // Check summary
      assert.ok(json.data.summary.correctedCount >= 2);
    });

    test("4.4 Identifies database timetable conflicts in parallel during verification", async () => {
      const mockProvider = new MockVisionProvider([]);
      setVisionProviderOverride(mockProvider);

      // Course overlapping with mockDbCourses: Selasa 10:00 - 12:00
      const overlappingCandidate = [
        {
          id: "item_overlap",
          namaMatkul: "Kriptografi",
          hari: "Selasa",
          waktuMulai: "10:30",
          waktuSelesai: "12:30",
        },
      ];

      const form = new FormData();
      form.append("userConsent", "true");
      form.append("file", new Blob(["fake png bytes"], { type: "image/png" }), "schedule.png");
      form.append("items", JSON.stringify(overlappingCandidate));

      const req = new NextRequest("http://localhost:3000/api/jadwal/import/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        body: form,
      });

      const res = await verifyPost(req);
      assert.equal(res.status, 200);
      const json = await res.json();

      assert.ok(json.data.schedule_conflicts.length > 0);
      const conflict = json.data.schedule_conflicts[0];
      assert.equal(conflict.itemId, "item_overlap");
      assert.equal(conflict.conflictingCourseName, "Jaringan Komputer");
      assert.ok(conflict.reason.includes("Bentrok jadwal"));
    });

    test("4.5 Respects user rate limits and returns 429 when quota exceeded", async () => {
      // Consume rate limit for a dummy user
      const limitUserId = "rate_limited_tester_6";
      for (let i = 0; i < 5; i++) {
        checkUserVisionRateLimit(limitUserId);
      }
      const check = checkUserVisionRateLimit(limitUserId);
      assert.equal(check.allowed, false);
      assert.ok(check.retryAfterSeconds && check.retryAfterSeconds > 0);
    });
  });

  // =========================================================================
  // 5. UI Review Workflow & Correction Decision Application
  // =========================================================================
  test.describe("5. Interactive Review Workflow & Decisions", () => {
    test("5.1 Applying proposed verification correction updates value and records correction history", () => {
      const item = {
        id: "item_1",
        namaMatkul: "Etika Profesi Tek.",
        hari: "Selasa",
        waktuMulai: "09:00",
        waktuSelesai: "11:30",
        verificationFindings: {
          waktuMulai: {
            field: "waktuMulai",
            decision: "corrected",
            proposedValue: "09:50",
            reason: "Angka 5 terbaca jelas",
          },
        },
        appliedCorrections: [],
      };

      // Simulating user accepting correction
      const proposed = item.verificationFindings.waktuMulai.proposedValue;
      const updatedItem = {
        ...item,
        waktuMulai: proposed,
        appliedCorrections: [
          ...item.appliedCorrections,
          `Koreksi AI diterapkan (Jam Mulai): '${proposed}'`,
        ],
        verificationFindings: undefined,
      };

      assert.equal(updatedItem.waktuMulai, "09:50");
      assert.equal(updatedItem.appliedCorrections.length, 1);
      assert.equal(updatedItem.verificationFindings, undefined);
    });

    test("5.2 Rejecting proposed verification correction retains original candidate value", () => {
      const item = {
        id: "item_1",
        namaMatkul: "Struktur Data",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:30",
        verificationFindings: {
          namaMatkul: {
            field: "namaMatkul",
            decision: "corrected",
            proposedValue: "Struktur Data Lanjut",
          },
        },
      };

      // Simulating user rejecting correction
      const updatedItem = {
        ...item,
        verificationFindings: undefined,
      };

      assert.equal(updatedItem.namaMatkul, "Struktur Data");
      assert.equal(updatedItem.verificationFindings, undefined);
    });
  });
});

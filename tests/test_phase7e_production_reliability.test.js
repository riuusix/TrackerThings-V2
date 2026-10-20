import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const TEST_USER_ID = 88888;
let savedDatabaseRecords = [];
let userScheduleMappingsStore = [];

// Isolated in-memory Prisma mock setup BEFORE importing routes
globalThis.prisma = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === TEST_USER_ID) {
        return {
          id: TEST_USER_ID,
          username: "integration_tester",
          email: "tester@trackerthings.local",
          role: "student",
          passwordChangedAt: null,
        };
      }
      return null;
    },
  },
  jadwal: {
    findMany: async () => [],
    create: async ({ data }) => {
      savedDatabaseRecords.push(data);
      return { id: savedDatabaseRecords.length, ...data };
    },
  },
  systemSetting: {
    findUnique: async () => ({
      settingKey: `schedule_mappings_user_${TEST_USER_ID}`,
      settingValue: JSON.stringify(userScheduleMappingsStore),
    }),
    upsert: async ({ update, create }) => {
      userScheduleMappingsStore = JSON.parse(update?.settingValue || create?.settingValue || "[]");
      return {
        settingKey: `schedule_mappings_user_${TEST_USER_ID}`,
        settingValue: JSON.stringify(userScheduleMappingsStore),
      };
    },
  },
  $transaction: async (operations) => {
    return Promise.all(operations);
  },
};

// Dynamically import route handlers and auth utilities
const { POST: previewPost } = await import("../app/api/jadwal/import/preview/route.ts");
const { POST: visionPost } = await import("../app/api/jadwal/import/vision/route.ts");
const { POST: confirmPost } = await import("../app/api/jadwal/import/confirm/route.ts");
const { signSessionToken } = await import("../lib/auth.ts");
const { NextRequest } = await import("next/server");
const {
  upsertUserMapping,
  applyConfirmedMappings,
} = await import("../lib/scheduleParser.ts");
const {
  setVisionProviderOverride,
  MockVisionProvider,
} = await import("../lib/visionProvider.ts");

test.describe("Phase 7E: End-to-End Route Execution & Integration Verification Suite", () => {
  let testUserToken = "";

  test.before(async () => {
    testUserToken = await signSessionToken({
      userId: TEST_USER_ID,
      username: "integration_tester",
      role: "student",
    });
  });

  test.beforeEach(() => {
    savedDatabaseRecords = [];
    userScheduleMappingsStore = [];
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
  // 1. Digital PDF vs Scanned PDF Actual Execution
  // =========================================================================
  test.describe("1. Real Route Execution: PDF Text Extraction & Error Recovery", () => {
    test("1.1 Digital PDF with selectable text stream processes successfully (HTTP 200)", async () => {
      // Valid PDF with selectable font stream
      const rawPdf =
        "%PDF-1.4\n" +
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
        "4 0 obj\n<< /Length 180 >>\nstream\n" +
        "BT\n/F1 14 Tf\n72 700 Td\n(JADWAL KULIAH SEMESTER GENAP) Tj\n" +
        "0 -25 Td\n(1. Rekayasa Perangkat Lunak) Tj\n" +
        "0 -20 Td\n(Senin 08:00 - 10:30 3 SKS Ruang Lab-1 Dosen: Dr. Sutrisno) Tj\nET\n" +
        "endstream\nendobj\n" +
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
        "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000234 00000 n \n0000000465 00000 n \n" +
        "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n540\n%%EOF";

      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from(rawPdf)], { type: "application/pdf" }), "digital_krs.pdf");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 200, "Digital PDF must return HTTP 200");
      assert.equal(json.success, true);
      assert.ok(json.data.items.length >= 1, "Must extract at least one course row");

      const firstItem = json.data.items[0];
      assert.equal(firstItem.namaMatkul, "Rekayasa Perangkat Lunak");
      assert.equal(firstItem.hari, "Senin");
      assert.equal(firstItem.waktuMulai, "08:00");
      assert.equal(firstItem.waktuSelesai, "10:30");

      // Verify no records were saved into database during preview
      assert.equal(savedDatabaseRecords.length, 0, "Preview must never save to database");
    });

    test("1.2 Scanned PDF (no digital text layer) returns HTTP 422 with SCANNED_PDF_NO_TEXT recovery guidance", async () => {
      // PDF without selectable text (container with no font operators)
      const scannedPdfBuffer = Buffer.from(
        "%PDF-1.4\n" +
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n" +
        "xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n" +
        "trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n193\n%%EOF"
      );

      const formData = new FormData();
      formData.append("file", new Blob([scannedPdfBuffer], { type: "application/pdf" }), "scanned_krs.pdf");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 422, "Scanned PDF without text layer must return HTTP 422");
      assert.equal(json.success, false);
      assert.equal(json.error, "SCANNED_PDF_NO_TEXT");
      assert.equal(json.file_type, "pdf");
      assert.equal(json.recovery_action, "CONVERT_TO_IMAGE");
      assert.equal(json.vision_fallback_eligible, false, "PDFs are not sent directly to vision AI");
      assert.ok(
        json.message.includes("scan/gambar tanpa lapisan teks digital"),
        "Message must instruct user to upload as image"
      );
    });

    test("1.3 PDF extraction exception (e.g. serverless runtime / canvas failure) returns HTTP 422 with vision_fallback_eligible: true", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([Buffer.from("invalid binary data not conforming to pdf structure")], { type: "application/pdf" }),
        "corrupted.pdf"
      );

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 422, "Failed PDF parse must return HTTP 422");
      assert.equal(json.success, false);
      assert.equal(json.error, "PDF_EXTRACTION_FAILED");
      assert.equal(
        json.extra?.vision_fallback_eligible ?? json.vision_fallback_eligible,
        true,
        "Must offer vision_fallback_eligible: true so user can recover via Vision AI"
      );
      assert.equal(
        json.extra?.insufficient_for_production ?? json.insufficient_for_production,
        true,
        "Must flag insufficient_for_production: true on extraction exception"
      );
      assert.equal(
        json.extra?.recovery_action ?? json.recovery_action,
        "TRY_VISION_AI"
      );
    });
  });

  // =========================================================================
  // 2. Image OCR Failures & Vision Eligibility
  // =========================================================================
  test.describe("2. Image OCR Execution & Vision Fallback Eligibility", () => {
    test("2.1 Image with Empty OCR returns HTTP 422 with EMPTY_OCR_IMAGE and vision_fallback_eligible: true", async () => {
      const formData = new FormData();
      // Client OCR returned empty string (e.g. low-contrast scan)
      formData.append("rawText", "");
      formData.append("ocrTsv", "");
      formData.append("fileName", "low_contrast_krs.jpg");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 422, "Empty image OCR must return HTTP 422");
      assert.equal(json.success, false);
      assert.equal(json.error, "EMPTY_OCR_IMAGE");
      assert.equal(json.file_type, "image");
      assert.equal(json.vision_fallback_eligible, true, "Must flag vision_fallback_eligible: true for images");
      assert.equal(json.recovery_action, "TRY_VISION_AI");
    });

    test("2.2 Unsupported format returns HTTP 400 with UNSUPPORTED_FORMAT", async () => {
      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from("dummy word data")], { type: "application/msword" }), "krs.docx");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.equal(json.error, "UNSUPPORTED_FORMAT");
    });

    test("2.3 Image upload producing parsedItems > 0 with needsReview or insufficientForProduction returns HTTP 200 with vision_fallback_eligible: true", async () => {
      const formData = new FormData();
      // Client OCR returned an ambiguous row with reversed/invalid time that needs review
      formData.append(
        "rawText",
        "Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS\n" +
        "Senin | 14:00 | 10:00 | Lab RPL | IF3201 | R.01 | Sistem Terdistribusi | 3"
      );
      formData.append("fileName", "camera_schedule.png");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.ok(json.data.items.length >= 1, "Must have parsedItems > 0");
      assert.equal(json.data.requires_review, true, "Must flag requires_review: true");
      assert.equal(
        json.data.vision_fallback_eligible,
        true,
        "Must offer vision_fallback_eligible: true when items require review or are insufficient"
      );
      assert.equal(
        json.data.insufficient_for_production,
        true,
        "Must flag insufficient_for_production: true when items require review"
      );
    });
  });

  // =========================================================================
  // 3. Vision Fallback Consent Guard & Non-Persistence in Preview
  // =========================================================================
  test.describe("3. Vision Fallback Route Execution & Consent Guards", () => {
    test("3.1 Vision Route rejects request without explicit user consent (HTTP 400 CONSENT_REQUIRED)", async () => {
      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from("image_bytes")], { type: "image/png" }), "krs.png");
      // Omit userConsent

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/vision", "POST", formData);
      const res = await visionPost(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.equal(json.error, "CONSENT_REQUIRED");
      assert.ok(json.message.includes("Persetujuan"));
    });

    test("3.2 Vision Route processes valid consented request and returns preview without mutating database", async () => {
      // Mock Vision Provider returning structured rows
      const mockRows = [
        {
          namaMatkul: "Kecerdasan Buatan Terapan",
          hari: "Kamis",
          waktuMulai: "13:30",
          waktuSelesai: "16:00",
          lokasi: "D.401",
          kodeMatkul: "IF253419",
          kelas: "R.02",
          sks: 3,
        },
      ];
      setVisionProviderOverride(new MockVisionProvider(mockRows));

      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from("image_bytes")], { type: "image/png" }), "krs.png");
      formData.append("userConsent", "true");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/vision", "POST", formData);
      const res = await visionPost(req);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.equal(json.data.items.length, 1);
      assert.equal(json.data.items[0].namaMatkul, "Kecerdasan Buatan Terapan");

      // Verify ZERO records saved to database during vision extraction
      assert.equal(savedDatabaseRecords.length, 0, "Vision fallback must only populate preview, never save to database");
    });
  });

  // =========================================================================
  // 4. Confirm Route: Atomic Saving & Rejection on Invalid Rows
  // =========================================================================
  test.describe("4. Confirm Route Execution & Atomic Transaction Integrity", () => {
    test("4.1 Saves valid schedule batch atomically and learns user corrections", async () => {
      const confirmPayload = {
        items: [
          {
            namaMatkul: "Pemrograman Web Lanjut",
            hari: "Selasa",
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            lokasi: "Lab. Komputer 1",
            sks: 3,
          },
          {
            namaMatkul: "Rekayasa Kebutuhan Perangkat Lunak",
            hari: "Rabu",
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            lokasi: "R.204",
            sks: 3,
          },
        ],
        learnCorrections: true,
      };

      const req = new NextRequest("http://localhost:3000/api/jadwal/import/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(confirmPayload),
      });

      const res = await confirmPost(req);
      const json = await res.json();

      assert.equal(res.status, 201);
      assert.equal(json.data.count, 2);
      assert.equal(savedDatabaseRecords.length, 2, "Both records must be saved atomically");
    });

    test("4.2 Rejects entire batch if any row has invalid time order (start >= end) with zero records saved", async () => {
      const invalidPayload = {
        items: [
          {
            namaMatkul: "Basis Data I",
            hari: "Senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:00",
            lokasi: "Lab. Basis Data",
            sks: 3,
          },
          {
            namaMatkul: "Grafika Komputer",
            hari: "Jumat",
            waktuMulai: "14:00",
            waktuSelesai: "12:00", // Invalid: waktu selesai < waktu mulai
            lokasi: "R.101",
            sks: 3,
          },
        ],
      };

      const req = new NextRequest("http://localhost:3000/api/jadwal/import/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidPayload),
      });

      const res = await confirmPost(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.ok(json.message.includes("Waktu selesai harus lebih lambat dari waktu mulai"));
      assert.equal(savedDatabaseRecords.length, 0, "No records should be saved if any row fails validation");
    });
  });

  // =========================================================================
  // 5. Mapping Conflict Resolution & Ambiguity Guard (Phase 7B)
  // =========================================================================
  test.describe("5. Phase 7B Mapping Ambiguity & Conflict Protection", () => {
    test("Conflicting targetValue for same sourceKey preserves original mapping and flags hasConflict", () => {
      let mappings = [];

      // Step 1: User maps "LAB" -> "Lab Komputer 1"
      mappings = upsertUserMapping(mappings, {
        field: "lokasi",
        sourceKey: "LAB",
        targetValue: "Lab Komputer 1",
      });
      assert.equal(mappings[0].targetValue, "Lab Komputer 1");

      // Step 2: Conflicting input "LAB" -> "Lab Bahasa" without explicit ID
      mappings = upsertUserMapping(mappings, {
        field: "lokasi",
        sourceKey: "LAB",
        targetValue: "Lab Bahasa",
      });

      // Proof: Original mapping is NOT blindly overwritten!
      assert.equal(mappings[0].targetValue, "Lab Komputer 1", "Must preserve existing target value");
      assert.equal(mappings[0].metadata?.hasConflict, true, "Must flag hasConflict: true");
      assert.equal(mappings[0].metadata?.isAmbiguous, true, "Must flag isAmbiguous: true");
      assert.ok(mappings[0].metadata?.alternateTargets?.includes("Lab Bahasa"));

      // Proof: applyConfirmedMappings demotes ambiguous mapping to tentative suggestion
      const item = {
        id: "conflict_item",
        namaMatkul: "Pemrograman Visual",
        lokasi: "LAB",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:00",
        needsReview: false,
        warnings: [],
      };
      const result = applyConfirmedMappings(item, mappings);
      assert.equal(result.lokasi, "LAB", "Must NOT silently replace location on conflict");
      assert.equal(result.needsReview, true);
      assert.equal(result.tentativeSuggestions?.lokasi, "Lab Komputer 1");
    });
  });

  // =========================================================================
  // 6. Dual-Key API Contracts for Web & Native iOS
  // =========================================================================
  test.describe("6. Native iOS & Web Dual-Key Compatibility", () => {
    test("Preview and Confirm responses provide dual-key casing for iOS Codable", async () => {
      const formData = new FormData();
      formData.append(
        "rawText",
        "Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS\n" +
        "Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2"
      );
      formData.append("fileName", "dual_key_test.txt");

      const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
      const res = await previewPost(req);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.ok(json.data.items.length >= 1);

      const item = json.data.items[0];
      // Web casing
      assert.equal(item.namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.equal(item.waktuMulai, "09:50");
      assert.equal(item.waktuSelesai, "11:30");
      // iOS snake_case fallback
      assert.equal(item.nama_matkul, "Etika Profesi Teknologi Informasi");
      assert.equal(item.waktu_mulai, "09:50");
      assert.equal(item.waktu_selesai, "11:30");

      // Root response dual keys
      assert.equal(typeof json.data.requires_review, "boolean");
      assert.equal(typeof json.data.insufficient_for_production, "boolean");
      assert.equal(typeof json.data.vision_fallback_eligible, "boolean");
    });
  });
});

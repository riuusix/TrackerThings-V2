import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const TEST_USER_ID = 99991;
let userScheduleMappingsStore = [];

// Isolated in-memory Prisma mock setup BEFORE importing routes
globalThis.prisma = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === TEST_USER_ID) {
        return {
          id: TEST_USER_ID,
          username: "ios_student_tester",
          email: "ios@trackerthings.local",
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

// Dynamically import route handler and utilities
const { POST: previewPost } = await import("../app/api/jadwal/import/preview/route.ts");
const { signSessionToken } = await import("../lib/auth.ts");
const { NextRequest } = await import("next/server");

test.describe("iOS On-Device Apple Vision Evidence Bridge Suite", () => {
  let testUserToken = "";

  test.before(async () => {
    testUserToken = await signSessionToken({
      userId: TEST_USER_ID,
      username: "ios_student_tester",
      role: "student",
    });
  });

  test.beforeEach(() => {
    userScheduleMappingsStore = [];
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

  test("1. iOS OCR Bridge accepts rawText and ocrWords JSON produced by AppleVisionOcrService", async () => {
    const rawText = [
      "NO KODE MK MATA KULIAH SKS HARI WAKTU RUANG DOSEN",
      "1 IF253418 REKAYASA PERANGKAT LUNAK 3 SKS SENIN 08:00 - 10:30 LAB D.302 Dr. Ir. Budi",
      "2 CS201 STRUKTUR DATA 3 SKS RABU 10:30 - 13:00 R.201 Dra. Siti M.Kom"
    ].join("\n");

    // Realistic OCR words matching AppleVisionOcrService normalized coordinate conversion (y0, y1 from top-left)
    const ocrWords = [
      { text: "IF253418", confidence: 0.98, bbox: { x0: 0.05, y0: 0.15, x1: 0.15, y1: 0.18 } },
      { text: "REKAYASA", confidence: 0.95, bbox: { x0: 0.18, y0: 0.15, x1: 0.28, y1: 0.18 } },
      { text: "PERANGKAT", confidence: 0.96, bbox: { x0: 0.29, y0: 0.15, x1: 0.39, y1: 0.18 } },
      { text: "LUNAK", confidence: 0.94, bbox: { x0: 0.40, y0: 0.15, x1: 0.46, y1: 0.18 } },
      { text: "3", confidence: 0.92, bbox: { x0: 0.48, y0: 0.15, x1: 0.50, y1: 0.18 } },
      { text: "SKS", confidence: 0.95, bbox: { x0: 0.51, y0: 0.15, x1: 0.54, y1: 0.18 } },
      { text: "SENIN", confidence: 0.99, bbox: { x0: 0.55, y0: 0.15, x1: 0.62, y1: 0.18 } },
      { text: "08:00", confidence: 0.98, bbox: { x0: 0.63, y0: 0.15, x1: 0.69, y1: 0.18 } },
      { text: "-", confidence: 0.99, bbox: { x0: 0.70, y0: 0.15, x1: 0.71, y1: 0.18 } },
      { text: "10:30", confidence: 0.98, bbox: { x0: 0.72, y0: 0.15, x1: 0.78, y1: 0.18 } },
      { text: "LAB", confidence: 0.91, bbox: { x0: 0.80, y0: 0.15, x1: 0.84, y1: 0.18 } },
      { text: "D.302", confidence: 0.93, bbox: { x0: 0.85, y0: 0.15, x1: 0.92, y1: 0.18 } }
    ];

    const formData = new FormData();
    // Simulate iOS sending original image file + client extracted rawText and ocrWords
    const dummyImageBuffer = Buffer.from("fake-jpeg-binary-header");
    formData.append("file", new Blob([dummyImageBuffer], { type: "image/jpeg" }), "jadwal_foto.jpg");
    formData.append("rawText", rawText);
    formData.append("ocrWords", JSON.stringify(ocrWords));

    const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
    const res = await previewPost(req);
    const json = await res.json();

    assert.equal(res.status, 200, "Must return HTTP 200 for valid OCR evidence");
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.items), "Items must be an array");
    assert.ok(json.data.items.length >= 2, "Must extract both course items from client OCR text");

    const rpl = json.data.items.find((i) => i.namaMatkul.toLowerCase().includes("rekayasa perangkat lunak"));
    assert.ok(rpl, "Should find 'Rekayasa Perangkat Lunak'");
    assert.equal(rpl.hari, "Senin");
    assert.equal(rpl.waktuMulai, "08:00");
    assert.equal(rpl.waktuSelesai, "10:30");
  });

  test("2. Ambiguous or incomplete client OCR triggers review flag and vision fallback eligibility", async () => {
    const rawText = [
      "KRS MAHASISWA",
      "KECERDASAN BUATAN - RUANG LAB KOMPUTER" // missing day and time
    ].join("\n");

    const formData = new FormData();
    const dummyImageBuffer = Buffer.from("fake-jpeg-binary");
    formData.append("file", new Blob([dummyImageBuffer], { type: "image/jpeg" }), "schedule_blurred.jpg");
    formData.append("rawText", rawText);
    formData.append("ocrWords", JSON.stringify([]));

    const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
    const res = await previewPost(req);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    const fallbackEligible = json.data.vision_fallback_eligible ?? json.data.visionFallbackEligible;
    assert.equal(fallbackEligible, true, "Must flag vision_fallback_eligible when OCR is incomplete");
    if (json.data.items && json.data.items.length > 0) {
      assert.ok(json.data.items.some((i) => i.needsReview === true), "Incomplete item must require review");
    }
  });

  test("3. Missing both file and rawText evidence returns HTTP 400 Bad Request", async () => {
    const formData = new FormData();
    // No file, no rawText

    const req = createNextRequest("http://localhost:3000/api/jadwal/import/preview", "POST", formData);
    const res = await previewPost(req);
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.ok(json.error.includes("wajib diunggah") || json.error.includes("dokumen"));
  });
});
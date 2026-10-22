import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

register("./tests/loader.mjs", pathToFileURL("./"));

const { parseScheduleText, recognizeScheduleData } = await import("../lib/scheduleParser.ts");
const { apiSuccess, apiError } = await import("../lib/apiResponse.ts");
const {
  bridgeCanonicalToLegacyItem,
  evaluateExtractionQuality,
  detectDocumentCategory,
} = await import("../lib/intelligence/academicEngine.ts");

describe("PDF Import Cross-Platform Contract & Harmonization Suite", () => {
  describe("1. Next.js apiSuccess Response Envelope for PDF Import", () => {
    test("POST /api/jadwal/import/preview returns standardized envelope compatible with both Web and iOS", async () => {
      const samplePdfText = `
Hari | Jam Mulai | Jam Akhir | Ruang | Kode MK | Kls | Nama Mata Kuliah | SKS
Senin | 08:00 | 09:40 | R.301 | IF2110 | A | Algoritma dan Pemrograman | 3
Selasa | 10:00 | 11:40 | Lab. 2 | IF2120 | B | Struktur Data | 3
`;
      const recognition = recognizeScheduleData({ text: samplePdfText }, [], []);
      assert.strictEqual(recognition.items.length, 2, "Harus mengekstrak 2 baris jadwal dari PDF text");

      const previewPayload = {
        draft_id: "draft-mock-123",
        draftId: "draft-mock-123",
        draft_version: 1,
        draftVersion: 1,
        version: "2.0",
        document_type: "class_schedule",
        processing_mode: "deterministic",
        engineUsed: "typescript_parser",
        engine_used: "typescript_parser",
        processingStage: "typescript_initial",
        processing_stage: "typescript_initial",
        qualityStatus: "sufficient",
        quality_status: "sufficient",
        warnings: [],
        visionFallbackEligible: false,
        vision_fallback_eligible: false,
        items: recognition.items,
        total: recognition.items.length,
        requires_review: false,
        layout: recognition.layout,
        insufficient_for_production: false,
        filename: "jadwal_kuliah.pdf",
      };

      const res = apiSuccess(
        `Ekstraksi jadwal berhasil. Ditemukan ${recognition.items.length} mata kuliah.`,
        previewPayload,
        200
      );

      assert.strictEqual(res.status, 200);
      const json = await res.json();

      // Top-level standardized envelope
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.code, 200);
      assert.ok(json.data, "Payload harus memiliki field 'data'");

      // Web consumption contract: json.data.items
      assert.ok(Array.isArray(json.data.items), "Web mengharapkan json.data.items berupa Array");
      assert.strictEqual(json.data.items.length, 2);
      assert.strictEqual(json.data.items[0].namaMatkul, "Algoritma dan Pemrograman");
      assert.strictEqual(json.data.items[0].hari, "Senin");
      assert.strictEqual(json.data.items[0].waktuMulai, "08:00");
      assert.strictEqual(json.data.items[0].waktuSelesai, "09:40");
      assert.strictEqual(json.data.items[0].sks, 3);
      assert.strictEqual(json.data.items[0].ruang, "R.301");

      // iOS consumption contract:
      // iOS NetworkService unwraps json.data directly into ScheduleImportPreviewResponse,
      // and ScheduleImportPreviewResponse also supports self-unwrapping rootContainer.contains(.data).
      assert.strictEqual(json.data.total, 2);
      assert.strictEqual(json.data.draft_id, "draft-mock-123");
      assert.strictEqual(json.data.draftId, "draft-mock-123");
      assert.strictEqual(json.data.layout.kind, "unas_8col_table");
      assert.strictEqual(json.data.vision_fallback_eligible, false);
      assert.strictEqual(json.data.visionFallbackEligible, false);
    });
  });

  describe("2. Canonical Item Bridge Field Completeness", () => {
    test("bridgeCanonicalToLegacyItem maps all canonical properties without losing hari, ruang, or sks", () => {
      const canonicalItem = {
        rowId: "row_1_1",
        namaMatkul: "Sistem Operasi",
        kodeMatkul: "IF2230",
        kelas: "K-01",
        hari: "Kamis",
        tanggal: null,
        waktuMulai: "13:00",
        waktuSelesai: "15:30",
        dosen: "Dr. Eng. Ahmad",
        lokasi: "Gedung A R.204",
        sks: 3,
        kategori: "Wajib",
        recurrence: "weekly",
        docType: "class_schedule",
        needsReview: false,
        reviewReasons: [],
        confidenceScore: 0.95,
        fieldValidations: {},
        provenance: {
          rawSnippet: "Kamis 13:00-15:30 IF2230 Sistem Operasi",
          pageNumber: 1,
          extractionMethod: "pdf_plumber",
        },
      };

      const bridged = bridgeCanonicalToLegacyItem(canonicalItem);

      assert.strictEqual(bridged.namaMatkul, "Sistem Operasi");
      assert.strictEqual(bridged.hari, "Kamis");
      assert.strictEqual(bridged.waktuMulai, "13:00");
      assert.strictEqual(bridged.waktuSelesai, "15:30");
      assert.strictEqual(bridged.lokasi, "Gedung A R.204");
      assert.strictEqual(bridged.ruang, "Gedung A R.204");
      assert.strictEqual(bridged.dosen, "Dr. Eng. Ahmad");
      assert.strictEqual(bridged.kodeMatkul, "IF2230");
      assert.strictEqual(bridged.kelas, "K-01");
      assert.strictEqual(bridged.sks, 3);
      assert.strictEqual(bridged.needsReview, false);
      assert.strictEqual(bridged.recognitionStatus, "high_confidence");
    });
  });

  describe("3. Data Quality & Zero False Defaults", () => {
    test("Incomplete PDF schedule lines do not hallucinate fake defaults (Senin, 08:00)", () => {
      const incompleteLine = `
Hari | Jam | Mata Kuliah
 | | Tugas Akhir
`;
      const items = parseScheduleText(incompleteLine);
      if (items.length > 0) {
        // Must NOT invent "Senin" or "08:00"
        assert.notStrictEqual(items[0].hari, "Senin", "Jangan memberi nilai default palsu 'Senin'");
        assert.notStrictEqual(items[0].waktuMulai, "08:00", "Jangan memberi nilai default palsu '08:00'");
        assert.strictEqual(items[0].needsReview, true, "Item dengan kolom hilang wajib ditandai needsReview");
      }
    });
  });
});

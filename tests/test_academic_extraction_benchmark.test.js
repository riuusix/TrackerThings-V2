import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateCanonicalAcademicItem,
  isValidIndonesianDay,
  isValidTimeString,
  isValidCalendarDate,
  DeterministicAcademicExtractor,
  detectDocumentCategory,
  normalizeIndonesianDay,
  normalizeTimeString,
  parseDateFromIndonesianText,
  MockAcademicProvider,
} from "../lib/intelligence/academicEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

describe("Academic Intelligence Engine — Extraction & Benchmark Suite (Phase 1)", () => {
  // =========================================================================
  // 1. Canonical Schema & Runtime Validation Tests
  // =========================================================================
  describe("1. Canonical Schema & Runtime Validation", () => {
    it("validates compliant CanonicalAcademicItem with weekly recurrence", () => {
      const raw = {
        id: "item_1",
        namaMatkul: "Sistem Terdistribusi",
        kodeMatkul: "IF3201",
        kelas: "R.01",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:30",
        lokasi: "Lab RPL",
        dosen: "Dr. Budi Santoso",
        sks: 3,
        kategori: "Wajib",
        recurrence: "weekly",
      };

      const res = validateCanonicalAcademicItem(raw);
      assert.equal(res.valid, true);
      assert.equal(res.errors.length, 0);
      assert.ok(res.validatedItem);
      assert.equal(res.validatedItem.namaMatkul, "Sistem Terdistribusi");
      assert.equal(res.validatedItem.needsReview, false);
    });

    it("flags item with missing time or invalid day for manual review without throwing", () => {
      const raw = {
        id: "item_2",
        namaMatkul: "Kalkulus",
        hari: "HariKiamat", // Invalid day
        waktuMulai: "25:99", // Invalid time
        waktuSelesai: "08:00",
        recurrence: "weekly",
      };

      const res = validateCanonicalAcademicItem(raw);
      assert.equal(res.valid, false);
      assert.ok(res.errors.length >= 2);
      assert.ok(res.validatedItem);
      assert.equal(res.validatedItem.needsReview, true);
      assert.ok(res.validatedItem.warnings.length >= 2);
    });

    it("strictly rejects reversed start/end time windows", () => {
      const raw = {
        id: "item_3",
        namaMatkul: "Fisika Dasar",
        hari: "Selasa",
        waktuMulai: "14:00",
        waktuSelesai: "10:00", // Earlier than start time!
        recurrence: "weekly",
      };

      const res = validateCanonicalAcademicItem(raw);
      assert.equal(res.valid, false);
      assert.match(res.errors.join(" "), /strictly earlier than end time/);
    });

    it("validates specific calendar date format (YYYY-MM-DD) for exam schedules", () => {
      assert.equal(isValidCalendarDate("2026-10-26"), true);
      assert.equal(isValidCalendarDate("2026-02-29"), false); // 2026 is non-leap
      assert.equal(isValidCalendarDate("2024-02-29"), true); // 2024 is leap
      assert.equal(isValidCalendarDate("2026-13-01"), false);
      assert.equal(isValidCalendarDate("not-a-date"), false);
    });
  });

  // =========================================================================
  // 2. Multi-Format Layout Classification & Extraction Unit Tests
  // =========================================================================
  describe("2. Multi-Format Layout Classification & Extraction", () => {
    it("detects document category based on internal keyword semantics", () => {
      assert.equal(
        detectDocumentCategory("Jadwal Ujian Akhir Semester (UAS) Genap Fakultas Ilmu Komputer"),
        "exam_schedule"
      );
      assert.equal(
        detectDocumentCategory("Pemberitahuan Kelas Pengganti Kuliah Pemrograman Web"),
        "replacement_class"
      );
      assert.equal(
        detectDocumentCategory("Kartu Rencana Studi (KRS) Mahasiswa Semester Ganjil"),
        "course_registration_krs"
      );
      assert.equal(
        detectDocumentCategory("Jadwal Kuliah Mingguan Semester Ganjil 2026"),
        "class_schedule"
      );
    });

    it("normalizes Indonesian day variations and aliases without day drift", () => {
      assert.equal(normalizeIndonesianDay("Senin"), "Senin");
      assert.equal(normalizeIndonesianDay("sen1n"), "Senin");
      assert.equal(normalizeIndonesianDay("Jum'at"), "Jumat");
      assert.equal(normalizeIndonesianDay("Friday"), "Jumat");
      assert.equal(normalizeIndonesianDay("R4bu"), "Rabu");
      assert.equal(normalizeIndonesianDay("UnknownDay"), null);
    });

    it("parses diverse date strings from Indonesian text", () => {
      assert.equal(parseDateFromIndonesianText("26 Oktober 2026"), "2026-10-26");
      assert.equal(parseDateFromIndonesianText("1 Januari 2027"), "2027-01-01");
      assert.equal(parseDateFromIndonesianText("28-10-2026"), "2026-10-28");
      assert.equal(parseDateFromIndonesianText("2026-10-30"), "2026-10-30");
    });
  });

  // =========================================================================
  // 3. Evaluation Benchmark Harness (against Manifest & Ground Truth)
  // =========================================================================
  describe("3. Dataset Manifest & Ground-Truth Benchmark Evaluation", () => {
    const manifestPath = path.resolve(REPO_ROOT, "datasets/academic_manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const extractor = new DeterministicAcademicExtractor();

    it("verifies manifest completeness and split integrity", () => {
      assert.equal(manifest.version, "1.0.0");
      assert.ok(Array.isArray(manifest.entries));
      assert.ok(manifest.entries.length >= 5);

      for (const entry of manifest.entries) {
        assert.ok(entry.id);
        assert.ok(entry.source_file);
        assert.ok(entry.ground_truth_file);
        assert.ok(fs.existsSync(path.resolve(REPO_ROOT, entry.source_file)));
        assert.ok(fs.existsSync(path.resolve(REPO_ROOT, entry.ground_truth_file)));
      }
    });

    it("evaluates exact field and record accuracy against verified ground truth", async () => {
      let totalFieldsChecked = 0;
      let totalFieldsMatched = 0;
      let totalRecordsChecked = 0;
      let totalRecordsMatched = 0;
      const benchmarkStats = [];

      for (const entry of manifest.entries) {
        const fixturePath = path.resolve(REPO_ROOT, entry.source_file);
        const groundTruthPath = path.resolve(REPO_ROOT, entry.ground_truth_file);

        const rawText = fs.readFileSync(fixturePath, "utf8");
        const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, "utf8"));

        const startT = performance.now();
        const result = await extractor.extract({
          buffer: Buffer.from(rawText, "utf8"),
          mimeType: "text/plain",
          fileName: path.basename(fixturePath),
          preExtractedText: rawText,
        });
        const duration = performance.now() - startT;

        // Verify Document Type
        assert.equal(
          result.documentType,
          groundTruth.documentType,
          `Document type mismatch on ${entry.id}`
        );

        // Verify count
        assert.equal(
          result.items.length,
          groundTruth.items.length,
          `Record count mismatch on ${entry.id}`
        );

        let docFieldsMatched = 0;
        let docFieldsTotal = 0;
        let docRecordsMatched = 0;

        for (let i = 0; i < groundTruth.items.length; i++) {
          const expected = groundTruth.items[i];
          const actual = result.items[i];
          totalRecordsChecked++;

          let recordAllMatched = true;

          // Check fields
          const checkFields = [
            "namaMatkul",
            "kodeMatkul",
            "hari",
            "tanggal",
            "waktuMulai",
            "waktuSelesai",
            "sks",
            "recurrence",
          ];

          for (const f of checkFields) {
            totalFieldsChecked++;
            docFieldsTotal++;
            if (expected[f] === actual[f]) {
              totalFieldsMatched++;
              docFieldsMatched++;
            } else {
              recordAllMatched = false;
            }
          }

          if (recordAllMatched) {
            totalRecordsMatched++;
            docRecordsMatched++;
          }
        }

        benchmarkStats.push({
          id: entry.id,
          template: entry.template_family,
          fieldAccuracy: ((docFieldsMatched / docFieldsTotal) * 100).toFixed(1) + "%",
          recordsMatched: `${docRecordsMatched}/${groundTruth.items.length}`,
          durationMs: duration.toFixed(2),
        });
      }

      const overallFieldAccuracy = (totalFieldsMatched / totalFieldsChecked) * 100;
      const overallRecordAccuracy = (totalRecordsMatched / totalRecordsChecked) * 100;

      // Report benchmark metrics to stdout
      console.log("\n================ ACADEMIC EXTRACTION BENCHMARK RESULTS ================");
      console.table(benchmarkStats);
      console.log(`Overall Field Accuracy: ${overallFieldAccuracy.toFixed(2)}% (${totalFieldsMatched}/${totalFieldsChecked})`);
      console.log(`Overall Record Accuracy: ${overallRecordAccuracy.toFixed(2)}% (${totalRecordsMatched}/${totalRecordsChecked})`);
      console.log("=======================================================================\n");

      // Baseline target: > 95% on supported synthetic ground-truth
      assert.ok(overallFieldAccuracy >= 95.0, `Expected field accuracy >= 95%, got ${overallFieldAccuracy}%`);
      assert.ok(overallRecordAccuracy >= 90.0, `Expected record accuracy >= 90%, got ${overallRecordAccuracy}%`);
    });
  });

  // =========================================================================
  // 4. Provider Lifecycle & Mock Engine Tests
  // =========================================================================
  describe("4. Provider Lifecycle & Isolation", () => {
    it("MockAcademicProvider operates in memory without external calls", async () => {
      const mockProvider = new MockAcademicProvider();
      assert.equal(await mockProvider.isAvailable(), true);

      const res = await mockProvider.extract({
        buffer: Buffer.alloc(10),
        mimeType: "application/pdf",
        fileName: "unknown.pdf",
      });

      assert.equal(res.documentType, "class_schedule");
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].namaMatkul, "Sistem Terdistribusi");
    });
  });
});

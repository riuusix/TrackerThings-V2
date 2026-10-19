import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  normalizeHari,
  normalizeTime,
  normalizeCourseCode,
  normalizeClassLabel,
  parseScheduleText,
  parseScheduleFromWords,
  recognizeScheduleData,
  detectScheduleLayout,
  applyConfirmedMappings,
  deriveMappingsFromConfirmedItems,
  upsertUserMapping,
  removeUserMapping,
  extractOcrFromImage,
} from "../lib/scheduleParser.ts";

/**
 * ============================================================================
 * TRACKERTHINGS V2 — PHASE 7A: BASELINE BENCHMARK SUITE
 * ============================================================================
 * Measures the baseline performance of the current schedule parser across:
 * 1. Text & Delimited Parser (KRS, UNAS 8-col text, Combined-time table)
 * 2. Spatial TSV Word Parser (Bounding-box alignment, Multi-line cells)
 * 3. Real OCR Engine Pipeline (Tesseract.js on rendered bitmap)
 * 4. Multi-Domain Support (University, School, Weekly Course, Date-Specific)
 * 5. Mapping Ambiguity, Conflicts, and Silent Wrong Replacement Rate
 * ============================================================================
 */

// Helper: Make synthetic OCR word with bounding box
function makeWord(text, x0, y0, x1, y1, conf = 92) {
  return {
    text,
    confidence: conf,
    bbox: { x0, y0, x1, y1 },
  };
}

// Helper: Create 24-bit uncompressed BMP buffer in memory for real OCR test
function createRenderedTableBmp(lines, width = 1350, height = 360) {
  const rowStride = Math.floor((width * 3 + 3) / 4) * 4;
  const imageSize = rowStride * height;
  const fileSize = 54 + imageSize;
  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(imageSize, 34);

  // Background white
  buf.fill(255, 54);

  const FONT = {
    A: ["01110", "10001", "11111", "10001", "10001", "10001", "10001"],
    B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
    C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
    F: ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
    G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    H: ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
    I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    K: ["10001", "10010", "11100", "10100", "10010", "10001", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "11110", "10000", "10000", "10000", "10000"],
    R: ["11110", "10001", "11110", "10100", "10010", "10001", "10001"],
    S: ["01111", "10000", "01110", "00001", "00001", "10001", "01110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10101", "10101", "10101", "01010", "00100"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  };

  const setPixel = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const offset = 54 + y * rowStride + x * 3;
    buf[offset] = 0;
    buf[offset + 1] = 0;
    buf[offset + 2] = 0;
  };

  const scale = 3;
  lines.forEach((lineObj, idx) => {
    const yStart = lineObj.y || 35 + idx * 60;
    for (const seg of lineObj.segments) {
      let xCursor = seg.x;
      const text = seg.text.toUpperCase();
      for (const ch of text) {
        const glyph = FONT[ch];
        if (glyph) {
          for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 5; c++) {
              if (glyph[r][c] === "1") {
                for (let sy = 0; sy < scale; sy++) {
                  for (let sx = 0; sx < scale; sx++) {
                    setPixel(xCursor + c * scale + sx, yStart + r * scale + sy);
                  }
                }
              }
            }
          }
        }
        xCursor += 6 * scale + 3;
      }
    }
  });

  return buf;
}

/**
 * Evaluates actual parsed items against independent Ground Truth records.
 */
function evaluateBenchmark(actualItems, groundTruthList, evaluatedFields = ["hari", "waktuMulai", "waktuSelesai", "namaMatkul", "lokasi"]) {
  const gtCount = groundTruthList.length;
  const actualCount = actualItems.length;

  let matchedRows = 0;
  let correctFields = 0;
  let totalEvaluatedFields = gtCount * evaluatedFields.length;
  let itemsRequiringReview = 0;
  let silentWrongReplacements = 0;

  for (let i = 0; i < gtCount; i++) {
    const gt = groundTruthList[i];
    // Find matching item by course name or index
    const act = actualItems[i] || actualItems.find(a => (a.namaMatkul || "").toLowerCase() === (gt.namaMatkul || "").toLowerCase());

    if (!act) {
      continue; // Row completely missing
    }
    matchedRows++;

    let hasFieldDiscrepancy = false;
    for (const field of evaluatedFields) {
      const actVal = act[field] !== undefined && act[field] !== null ? String(act[field]).trim().toLowerCase() : "";
      const gtVal = gt[field] !== undefined && gt[field] !== null ? String(gt[field]).trim().toLowerCase() : "";

      if (actVal === gtVal) {
        correctFields++;
      } else {
        hasFieldDiscrepancy = true;
        // Check if silent wrong replacement occurred (error made without flagging needsReview)
        if (act.needsReview === false) {
          silentWrongReplacements++;
        }
      }
    }

    if (act.needsReview === true || hasFieldDiscrepancy) {
      itemsRequiringReview++;
    }
  }

  const parseFailureRate = gtCount > 0 ? ((gtCount - matchedRows) / gtCount) * 100 : 0;
  const fieldLevelAccuracy = totalEvaluatedFields > 0 ? (correctFields / totalEvaluatedFields) * 100 : 0;
  const correctionRate = actualCount > 0 ? (itemsRequiringReview / actualCount) * 100 : 0;
  const silentWrongRate = actualCount > 0 ? (silentWrongReplacements / (actualCount * evaluatedFields.length)) * 100 : 0;

  return {
    gtCount,
    actualCount,
    matchedRows,
    correctFields,
    totalEvaluatedFields,
    fieldLevelAccuracy: Number(fieldLevelAccuracy.toFixed(2)),
    parseFailureRate: Number(parseFailureRate.toFixed(2)),
    correctionRate: Number(correctionRate.toFixed(2)),
    silentWrongReplacements,
    silentWrongRate: Number(silentWrongRate.toFixed(2)),
  };
}

test.describe("Phase 7A: Schedule Parser Baseline Benchmark Suite", () => {
  // =========================================================================
  // Layer 1: Text & Delimited KRS Parser Benchmark
  // =========================================================================
  test.describe("Layer 1: Text & Delimited KRS Parser Baseline", () => {
    test("Benchmark UNAS 8-Column Tabular Delimited Text (Standard University Timetable)", () => {
      const groundTruth = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          lokasi: "D.302 VA",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          namaMatkul: "Etika Profesi Teknologi Informasi",
          sks: 2,
        },
        {
          hari: "Rabu",
          waktuMulai: "10:40",
          waktuSelesai: "13:10",
          lokasi: "Lab. Data Science",
          kodeMatkul: "IF253417",
          kelas: "R.01",
          namaMatkul: "Rekayasa Perangkat Lunak Informatika",
          sks: 3,
        },
        {
          hari: "Kamis",
          waktuMulai: "13:30",
          waktuSelesai: "16:00",
          lokasi: "D.401",
          kodeMatkul: "IF253419",
          kelas: "R.02",
          namaMatkul: "Kecerdasan Buatan Terapan",
          sks: 3,
        },
      ];

      const inputRawText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2
        Rabu | 10:40:00 | 13:10:00 | Lab. Data Science | IF253417 | R.01 | Rekayasa Perangkat Lunak Informatika | 3
        Kamis | 13:30:00 | 16:00:00 | D.401 | IF253419 | R.02 | Kecerdasan Buatan Terapan | 3
      `;

      const t0 = performance.now();
      const result = recognizeScheduleData({ text: inputRawText }, []);
      const latencyMs = Number((performance.now() - t0).toFixed(2));

      assert.equal(result.layout.kind, "unas_8col_table");
      const metrics = evaluateBenchmark(result.items, groundTruth, [
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "namaMatkul",
        "lokasi",
        "kodeMatkul",
        "kelas",
        "sks",
      ]);

      assert.equal(metrics.parseFailureRate, 0, "Parse failure rate must be 0% for clean tabular text");
      assert.equal(metrics.fieldLevelAccuracy, 100, "Clean delimited UNAS text must reach 100% field-level accuracy");
      assert.equal(metrics.silentWrongReplacements, 0, "Silent wrong replacements must be 0");
      assert.ok(latencyMs < 30, `Latency must be < 30ms (actual: ${latencyMs}ms)`);
    });

    test("Benchmark Traditional KRS Text with Inconsistent White-spacing and Compact Delimiters", () => {
      const groundTruth = [
        {
          hari: "Senin",
          waktuMulai: "08:00",
          waktuSelesai: "09:40",
          lokasi: "R.301",
          namaMatkul: "Matematika Diskrit",
          sks: 2,
        },
        {
          hari: "Kamis",
          waktuMulai: "14:00",
          waktuSelesai: "16:30",
          lokasi: "Lab. Komputer 2",
          namaMatkul: "Pemrograman Berorientasi Objek",
          sks: 3,
        },
      ];

      const krsText = `
        KARTU RENCANA STUDI (KRS)
        No   Mata Kuliah                     SKS   Hari    Jam            Ruang
        1    Matematika Diskrit              2     Senin   08:00-09:40    R.301
        2    Pemrograman Berorientasi Objek  3     Kamis   14:00-16:30    Lab. Komputer 2
      `;

      const t0 = performance.now();
      const result = recognizeScheduleData({ text: krsText }, []);
      const latencyMs = Number((performance.now() - t0).toFixed(2));

      const metrics = evaluateBenchmark(result.items, groundTruth, [
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "namaMatkul",
        "lokasi",
        "sks",
      ]);

      console.log("\n[DEBUG KRS Items]:", JSON.stringify(result.items.map(it => ({
        namaMatkul: it.namaMatkul,
        hari: it.hari,
        waktuMulai: it.waktuMulai,
        waktuSelesai: it.waktuSelesai,
        lokasi: it.lokasi,
        sks: it.sks
      })), null, 2));

      console.log("[METRICS KRS]:", metrics);
      assert.equal(metrics.parseFailureRate, 0, "Parse failure rate must be 0% for traditional KRS");
      assert.ok(metrics.fieldLevelAccuracy >= 40, `Recorded baseline field accuracy: ${metrics.fieldLevelAccuracy}%`);
      assert.ok(latencyMs < 30, `Latency must be < 30ms (actual: ${latencyMs}ms)`);
    });
  });

  // =========================================================================
  // Layer 2: Spatial & Bounding Box Layout Parser Benchmark
  // =========================================================================
  test.describe("Layer 2: Spatial & Bounding Box Layout Parser Baseline", () => {
    test("Benchmark Spatial Word Alignment with Multi-Line Cells and Column Offsets", () => {
      const groundTruth = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          lokasi: "D.302 VA",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          namaMatkul: "Etika Profesi Teknologi Informasi",
          sks: 2,
        },
        {
          hari: "Rabu",
          waktuMulai: "10:40",
          waktuSelesai: "13:10",
          lokasi: "Lab. Data Science",
          kodeMatkul: "IF253417",
          kelas: "R.01",
          namaMatkul: "Rekayasa Perangkat Lunak Informatika",
          sks: 3,
        },
      ];

      // Simulated spatial words as extracted from layout TSV
      const words = [
        // Headers
        makeWord("HARI", 20, 30, 80, 50),
        makeWord("MULAI", 110, 30, 180, 50),
        makeWord("AKHIR", 210, 30, 280, 50),
        makeWord("RUANG", 310, 30, 420, 50),
        makeWord("KODE MK", 450, 30, 550, 50),
        makeWord("KLS", 570, 30, 620, 50),
        makeWord("NAMA MK", 650, 30, 950, 50),
        makeWord("SKS", 980, 30, 1020, 50),

        // Row 1: Multi-line course name
        makeWord("Selasa", 20, 85, 80, 105),
        makeWord("09:50:00", 110, 85, 190, 105),
        makeWord("11:30:00", 210, 85, 290, 105),
        makeWord("D.302 VA", 310, 85, 410, 105),
        makeWord("IF253418", 450, 85, 540, 105),
        makeWord("R.03", 570, 85, 615, 105),
        makeWord("Etika", 650, 75, 710, 95),
        makeWord("Profesi", 720, 75, 800, 95),
        makeWord("Teknologi", 650, 100, 760, 120),
        makeWord("Informasi", 770, 100, 870, 120),
        makeWord("2", 985, 85, 1000, 105),

        // Row 2: Multi-line room AND multi-line course name
        makeWord("Rabu", 20, 155, 75, 175),
        makeWord("10:40:00", 110, 155, 190, 175),
        makeWord("13:10:00", 210, 155, 290, 175),
        makeWord("Lab. Data", 310, 145, 420, 165),
        makeWord("Science", 310, 170, 395, 190),
        makeWord("IF253417", 450, 155, 540, 175),
        makeWord("R.01", 570, 155, 615, 175),
        makeWord("Rekayasa", 650, 145, 755, 165),
        makeWord("Perangkat", 765, 145, 875, 165),
        makeWord("Lunak Informatika", 650, 170, 860, 190),
        makeWord("3", 985, 155, 1000, 175),
      ];

      const t0 = performance.now();
      const items = parseScheduleFromWords(words, [], []);
      const latencyMs = Number((performance.now() - t0).toFixed(2));

      const metrics = evaluateBenchmark(items, groundTruth, [
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "namaMatkul",
        "lokasi",
        "kodeMatkul",
        "kelas",
        "sks",
      ]);

      assert.equal(metrics.parseFailureRate, 0, "Spatial bounding-box parser must not lose rows");
      assert.equal(metrics.fieldLevelAccuracy, 100, "Spatial multi-line merging must achieve 100% field accuracy");
      assert.ok(latencyMs < 25, `Spatial parse latency must be < 25ms (actual: ${latencyMs}ms)`);
    });
  });

  // =========================================================================
  // Layer 3: Real OCR Engine Pipeline Benchmark
  // =========================================================================
  test.describe("Layer 3: Real OCR Engine Pipeline Baseline (Actual Tesseract Worker)", () => {
    test("End-to-end Benchmark: Synthetic Bitmap Rendering -> Tesseract OCR -> Recognize Schedule", async () => {
      // Create synthetic clean bitmap table with 2 courses
      const bmpBuffer = createRenderedTableBmp([
        {
          y: 30,
          segments: [
            { x: 20, text: "HARI" },
            { x: 160, text: "MULAI" },
            { x: 330, text: "AKHIR" },
            { x: 500, text: "RUANG" },
            { x: 690, text: "KODE MK" },
            { x: 870, text: "KLS" },
            { x: 980, text: "NAMA MK" },
            { x: 1180, text: "SKS" },
          ],
        },
        {
          y: 110,
          segments: [
            { x: 20, text: "SELASA" },
            { x: 160, text: "09.50.00" },
            { x: 330, text: "11.30.00" },
            { x: 500, text: "D.302" },
            { x: 690, text: "IF253418" },
            { x: 870, text: "R.03" },
            { x: 980, text: "ETIKA" },
            { x: 1180, text: "2" },
          ],
        },
        {
          y: 190,
          segments: [
            { x: 20, text: "RABU" },
            { x: 160, text: "10.40.00" },
            { x: 330, text: "13.10.00" },
            { x: 500, text: "LAB" },
            { x: 690, text: "IF253417" },
            { x: 870, text: "R.01" },
            { x: 980, text: "REKAYASA" },
            { x: 1180, text: "3" },
          ],
        },
      ]);

      const groundTruth = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          lokasi: "D.302",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          namaMatkul: "ETIKA",
          sks: 2,
        },
        {
          hari: "Rabu",
          waktuMulai: "10:40",
          waktuSelesai: "13:10",
          lokasi: "LAB",
          kodeMatkul: "IF253417",
          kelas: "R.01",
          namaMatkul: "REKAYASA",
          sks: 3,
        },
      ];

      const t0 = performance.now();
      const ocrResult = await extractOcrFromImage(bmpBuffer);
      const ocrDurationMs = Number((performance.now() - t0).toFixed(2));

      assert.ok(ocrResult.text.length > 0, "OCR engine must extract text from bitmap");
      assert.ok(ocrResult.words.length > 0, "OCR engine must extract spatial words with bounding boxes");

      const tParse = performance.now();
      const recognition = recognizeScheduleData(ocrResult, []);
      const parseDurationMs = Number((performance.now() - tParse).toFixed(2));

      const metrics = evaluateBenchmark(recognition.items, groundTruth, [
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "kodeMatkul",
        "kelas",
        "sks",
      ]);

      console.log("\n[DEBUG Real OCR Text]:", ocrResult.text);
      console.log("[DEBUG Real OCR Items]:", JSON.stringify(recognition.items, null, 2));
      console.log("[METRICS Real OCR]:", metrics);

      // Record baseline bounds for real OCR on synthetic bitmap
      assert.ok(ocrResult.text.length > 0, "OCR engine must extract text from bitmap");
      assert.ok(ocrDurationMs < 10000, `OCR pipeline latency must be < 10s (actual: ${ocrDurationMs}ms)`);
      assert.ok(typeof metrics.fieldLevelAccuracy === "number", "Field level accuracy must be calculated");
    });
  });

  // =========================================================================
  // Layer 4: Multi-Domain Schedule Format Baseline
  // =========================================================================
  test.describe("Layer 4: Multi-Domain Schedule Format Baseline", () => {
    test("Audit Domain 1: Weekly Course / Extracurricular (Fits Weekly Recurring Model)", () => {
      const groundTruth = [
        {
          hari: "Selasa",
          waktuMulai: "19:00",
          waktuSelesai: "21:00",
          namaMatkul: "Kursus Bahasa Inggris TOEFL",
          lokasi: "Ruang C.12",
        },
        {
          hari: "Sabtu",
          waktuMulai: "09:00",
          waktuSelesai: "12:00",
          namaMatkul: "Workshop UI UX Design",
          lokasi: "Lab Multimedia",
        },
      ];

      const courseScheduleText = `
        Hari | Jam | Kegiatan / Kursus | Lokasi
        Selasa | 19:00 - 21:00 | Kursus Bahasa Inggris TOEFL | Ruang C.12
        Sabtu | 09:00 - 12:00 | Workshop UI UX Design | Lab Multimedia
      `;

      const result = recognizeScheduleData({ text: courseScheduleText }, []);
      const metrics = evaluateBenchmark(result.items, groundTruth, [
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "namaMatkul",
        "lokasi",
      ]);

      console.log("\n[DEBUG Course Items]:", JSON.stringify(result.items.map(it => ({
        namaMatkul: it.namaMatkul,
        hari: it.hari,
        waktuMulai: it.waktuMulai,
        waktuSelesai: it.waktuSelesai,
        lokasi: it.lokasi
      })), null, 2));
      console.log("[METRICS Course]:", metrics);

      assert.equal(metrics.parseFailureRate, 0, "Weekly course schedule must parse cleanly");
      assert.ok(metrics.fieldLevelAccuracy >= 75, `Recorded baseline field accuracy: ${metrics.fieldLevelAccuracy}%`);
    });

    test("Audit Domain 2: High School Timetable (Lesson Period vs Clock Hours)", () => {
      // High school schedule often uses "Jam Ke-1" or periods. Let's document current behavior!
      const schoolText = `
        Hari | Jam Pelajaran | Mata Pelajaran | Ruang | Guru
        Senin | Jam 1 (07:00 - 07:45) | Matematika Wajib | Kelas XII IPA 1 | Drs. Supriyanto
        Senin | Jam 2 (07:45 - 08:30) | Fisika Dasar | Lab Fisika | Dra. Maryati
      `;

      const result = recognizeScheduleData({ text: schoolText }, []);

      // Document current gap: Current parser regex extracts HH:mm inside parentheses if present,
      // but without clock times, pure period numbers ("Jam 1") fail to normalize.
      assert.ok(result.items.length >= 1, "Parser extracts rows containing recognizable times");
      if (result.items.length > 0) {
        assert.equal(result.items[0].hari, "Senin");
        assert.equal(result.items[0].waktuMulai, "07:00");
        assert.equal(result.items[0].waktuSelesai, "07:45");
      }
    });

    test("Audit Domain 3: Single-Date Calendar Event (Identifies Gap vs Weekly Recurring Model)", () => {
      // Single date event (e.g. 25 Oktober 2026) does not fit recurring weekly schema prisma.jadwal
      const singleDateText = `
        Tanggal: 25 Oktober 2026
        Waktu: 09:00 - 11:00
        Acara: Seminar Nasional AI
        Ruang: Auditorium Utama
      `;

      const result = recognizeScheduleData({ text: singleDateText }, []);
      // Current schedule parser expects day name (Senin-Minggu). Since "25 Oktober 2026" has no weekday name,
      // the items will either have needsReview = true or fail day normalization.
      if (result.items.length > 0) {
        assert.equal(result.items[0].needsReview, true, "Items without recognized weekly day must flag needsReview");
      }
    });
  });

  // =========================================================================
  // Layer 5: Mapping Ambiguity, Conflicts, and Silent Wrong Replacement Baseline
  // =========================================================================
  test.describe("Layer 5: Mapping Ambiguity, Conflicts, and Silent Wrong Replacement Baseline", () => {
    test("Measures Current applyConfirmedMappings(): Verifies Exact & Fuzzy Thresholds", () => {
      const userMappings = [
        {
          id: "m1",
          field: "namaMatkul",
          sourceKey: "Rekayasa Lunak",
          targetValue: "Rekayasa Perangkat Lunak Informatika",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m2",
          field: "lokasi",
          sourceKey: "D.3O2 VA",
          targetValue: "D.302 VA",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const item = {
        id: "1",
        namaMatkul: "Rekayasa Lunak", // Exact match with sourceKey
        lokasi: "D.3O2 VA",
        hari: "Rabu",
        waktuMulai: "10:40",
        waktuSelesai: "13:10",
        needsReview: false,
        warnings: [],
      };

      const updated = applyConfirmedMappings(item, userMappings);

      assert.equal(updated.namaMatkul, "Rekayasa Perangkat Lunak Informatika");
      assert.equal(updated.lokasi, "D.302 VA");
      assert.ok((updated.appliedCorrections || []).length === 2);
    });

    test("Phase 7B Conflict Resolution: Prevents Blind Overwriting Same sourceKey with Different targetValue", () => {
      let mappings = [];

      // Initial user confirmation in Document A: "LAB" -> "Lab Komputer 1"
      mappings = upsertUserMapping(mappings, {
        field: "lokasi",
        sourceKey: "LAB",
        targetValue: "Lab Komputer 1",
      });
      assert.equal(mappings.length, 1);
      assert.equal(mappings[0].targetValue, "Lab Komputer 1");

      // In Document B, user confirms "LAB" -> "Lab Bahasa" without specifying existing ID
      mappings = upsertUserMapping(mappings, {
        field: "lokasi",
        sourceKey: "LAB",
        targetValue: "Lab Bahasa",
      });

      // Phase 7B Guard: Blind overwrite is blocked!
      assert.equal(mappings.length, 1);
      assert.equal(mappings[0].targetValue, "Lab Komputer 1", "Preserves existing targetValue instead of silently overwriting");
      assert.equal(mappings[0].metadata?.hasConflict, true, "Flags hasConflict = true");
      assert.equal(mappings[0].metadata?.isAmbiguous, true, "Flags isAmbiguous = true");
      assert.ok(
        mappings[0].metadata?.alternateTargets?.includes("Lab Bahasa"),
        "Stores conflicting candidate in alternateTargets"
      );

      // Verify applyConfirmedMappings demotes ambiguous/conflicted mapping to tentative suggestion
      const item = {
        id: "lab_item_1",
        namaMatkul: "Pemrograman Web",
        lokasi: "LAB",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:00",
        needsReview: false,
        warnings: [],
      };
      const applied = applyConfirmedMappings(item, mappings);
      assert.equal(applied.lokasi, "LAB", "Must NOT silently replace location when mapping has conflict");
      assert.equal(applied.needsReview, true, "Must flag needsReview = true");
      assert.equal(applied.tentativeSuggestions?.lokasi, "Lab Komputer 1", "Provides tentative suggestion for review");
    });

    test("Phase 7B Explicit Edit: User Editing Mapping by ID Clears Conflict", () => {
      let mappings = [
        {
          id: "m_lab",
          field: "lokasi",
          sourceKey: "LAB",
          targetValue: "Lab Komputer 1",
          metadata: {
            hasConflict: true,
            isAmbiguous: true,
            alternateTargets: ["Lab Bahasa"],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Explicit edit in settings with mapping ID provided
      mappings = upsertUserMapping(mappings, {
        id: "m_lab",
        field: "lokasi",
        sourceKey: "LAB",
        targetValue: "Lab Riset Informatika",
      });

      assert.equal(mappings.length, 1);
      assert.equal(mappings[0].targetValue, "Lab Riset Informatika");
      assert.equal(mappings[0].metadata?.hasConflict, false, "Clears hasConflict on explicit edit");
      assert.equal(mappings[0].metadata?.isAmbiguous, false, "Clears isAmbiguous on explicit edit");
    });

    test("Phase 7B Context Qualifier: Matches Context or Demotes to Tentative Suggestion", () => {
      const qualifiedMappings = [
        {
          id: "m_lab_qual",
          field: "lokasi",
          sourceKey: "LAB",
          targetValue: "Lab Komputer 1",
          metadata: {
            contextQualifier: "IF253418",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Case A: Matching context qualifier
      const matchingItem = {
        id: "match_item",
        kodeMatkul: "IF253418",
        namaMatkul: "Jaringan Komputer",
        lokasi: "LAB",
        hari: "Selasa",
        waktuMulai: "10:00",
        waktuSelesai: "12:00",
        needsReview: false,
        warnings: [],
      };
      const matchResult = applyConfirmedMappings(matchingItem, qualifiedMappings);
      assert.equal(matchResult.lokasi, "Lab Komputer 1", "Applies correction when contextQualifier matches");

      // Case B: Non-matching context qualifier
      const nonMatchingItem = {
        id: "non_match_item",
        kodeMatkul: "ES101010",
        namaMatkul: "Ekonomi Syariah",
        lokasi: "LAB",
        hari: "Kamis",
        waktuMulai: "13:00",
        waktuSelesai: "15:00",
        needsReview: false,
        warnings: [],
      };
      const nonMatchResult = applyConfirmedMappings(nonMatchingItem, qualifiedMappings);
      assert.equal(nonMatchResult.lokasi, "LAB", "Must not auto-replace short token when context does not match");
      assert.equal(nonMatchResult.needsReview, true);
      assert.equal(nonMatchResult.tentativeSuggestions?.lokasi, "Lab Komputer 1");
    });

    test("Phase 7B Backward Compatibility: Handles Legacy Mappings with undefined metadata", () => {
      const legacyMappings = [
        {
          id: "legacy_1",
          field: "namaMatkul",
          sourceKey: "BASISDATA",
          targetValue: "Basis Data",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const item = {
        id: "item_leg",
        namaMatkul: "BASISDATA",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "09:40",
        needsReview: false,
        warnings: [],
      };

      const result = applyConfirmedMappings(item, legacyMappings);
      assert.equal(result.namaMatkul, "Basis Data", "Legacy mappings without metadata still apply seamlessly");
    });

    test("Audits Silent Wrong Replacement Risk: Course Code Conflict vs OCR Course Name", () => {
      // User previously confirmed IF253418 as "Etika Profesi Teknologi Informasi"
      const userMappings = [
        {
          id: "m_code",
          field: "courseByCode",
          sourceKey: "IF253418",
          targetValue: "Etika Profesi Teknologi Informasi",
          metadata: {
            namaMatkul: "Etika Profesi Teknologi Informasi",
            sks: 2,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Now incoming row has code "IF253418", BUT OCR course name clearly says "Kecerdasan Buatan"
      // Expected behavior: Must NOT silently overwrite "Kecerdasan Buatan" into "Etika Profesi"!
      const conflictingItem = {
        id: "conflict_1",
        kodeMatkul: "IF253418",
        namaMatkul: "Kecerdasan Buatan",
        hari: "Selasa",
        waktuMulai: "09:50",
        waktuSelesai: "11:30",
        needsReview: false,
        warnings: [],
      };

      const result = applyConfirmedMappings(conflictingItem, userMappings);

      // Verify that current parser protects against silent wrong replacement
      assert.equal(result.namaMatkul, "Kecerdasan Buatan", "Must not silently overwrite conflicting course name");
      assert.equal(result.needsReview, true, "Must flag needsReview = true on conflict");
      assert.equal(result.tentativeSuggestions?.namaMatkul, "Etika Profesi Teknologi Informasi");
    });
  });
});


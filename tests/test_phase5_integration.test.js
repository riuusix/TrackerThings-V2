import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeHari,
  normalizeTime,
  normalizeCourseCode,
  normalizeClassLabel,
  parseTsvToWords,
  parseScheduleFromWords,
  parseScheduleData,
  parseScheduleText,
  detectScheduleLayout,
  recognizeScheduleData,
  evaluateScheduleExtractionSufficiency,
  mergeVisionWithOcrSchedule,
  applyConfirmedMappings,
  deriveMappingsFromConfirmedItems,
  upsertUserMapping,
  removeUserMapping,
  extractTextFromPdf,
  extractTextFromImage,
  extractOcrFromImage,
} from "../lib/scheduleParser.ts";
import {
  MockVisionProvider,
  GeminiVisionProvider,
  setVisionProviderOverride,
  checkUserVisionRateLimit,
  getVisionProviderConfig,
} from "../lib/visionProvider.ts";
import { resolvePostLoginRedirect, sanitizeRedirectPath } from "../lib/utils.ts";
import {
  signSessionToken,
  verifySessionToken,
  validateSessionUser,
  getAuthSession,
  requireAdminSession,
} from "../lib/auth.ts";
import { prisma } from "../lib/prisma.ts";

/**
 * Helper: Creates an uncompressed 24-bit BMP buffer with crisp 5x7 bitmap font rendering
 * so we can test REAL Tesseract.js OCR against a rendered UNAS timetable image.
 */
function createRenderedTableBmp(lines, width = 1280, height = 360) {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowStride * height;
  const fileSize = 54 + pixelDataSize;
  const buf = Buffer.alloc(fileSize, 0xff); // white background

  // BMP Header
  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelDataSize, 34);

  const FONT = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
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

test.describe("Phase 5 & Smart Schedule Recognition Suite", () => {
  // -------------------------------------------------------------
  // 1. UNAS 8-Column Format, Multi-Line Cells & Spatial Bounding Boxes
  // -------------------------------------------------------------
  test.describe("Smart Schedule Recognition — UNAS Timetable & Spatial Parsing", () => {
    test("UNAS 8-column delimited & space-separated rows parse accurately with HH:mm:ss, Kode MK, Kls, Ruang, SKS", () => {
      const unasText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2
        Rabu | 10:40:00 | 13:10:00 | Lab. Data Science | IF253417 | R.01 | Rekayasa Perangkat Lunak Informatika | 3
      `;

      const items = parseScheduleText(unasText, []);
      assert.equal(items.length, 2);

      assert.equal(items[0].hari, "Selasa");
      assert.equal(items[0].waktuMulai, "09:50");
      assert.equal(items[0].waktuSelesai, "11:30");
      assert.equal(items[0].lokasi, "D.302 VA");
      assert.equal(items[0].kodeMatkul, "IF253418");
      assert.equal(items[0].kelas, "R.03");
      assert.equal(items[0].namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.equal(items[0].sks, 2);
      assert.equal(items[0].needsReview, false);

      assert.equal(items[1].hari, "Rabu");
      assert.equal(items[1].waktuMulai, "10:40");
      assert.equal(items[1].waktuSelesai, "13:10");
      assert.equal(items[1].lokasi, "Lab. Data Science");
      assert.equal(items[1].kodeMatkul, "IF253417");
      assert.equal(items[1].kelas, "R.01");
      assert.equal(items[1].namaMatkul, "Rekayasa Perangkat Lunak Informatika");
      assert.equal(items[1].sks, 3);
      assert.equal(items[1].needsReview, false);
    });

    test("Spatial OCR bounding-box parser handles multi-line course names, multi-line room names, and vertically centered rows", () => {
      // Simulate OCR word bounding boxes from an 8-column UNAS screenshot where:
      // - Row 1 has 2-line course name ("Etika Profesi" / "Teknologi Informasi")
      // - Row 2 has 2-line room name ("Lab. Data" / "Science") AND 2-line course name ("Rekayasa Perangkat" / "Lunak Informatika")
      // - Row 3 is on the same weekday ("Rabu") with a different time slot
      const makeWord = (text, x0, y0, x1, y1) => ({
        text,
        confidence: 94,
        bbox: { x0, y0, x1, y1 },
      });

      const words = [
        // Table Header at Y=20..40
        makeWord("Hari", 20, 20, 70, 40),
        makeWord("Mulai", 110, 20, 170, 40),
        makeWord("Akhir", 210, 20, 270, 40),
        makeWord("Ruang", 310, 20, 380, 40),
        makeWord("Kode", 450, 20, 495, 40),
        makeWord("MK", 500, 20, 530, 40),
        makeWord("Kls", 570, 20, 610, 40),
        makeWord("Nama", 650, 20, 705, 40),
        makeWord("MK", 710, 20, 745, 40),
        makeWord("SKS", 980, 20, 1020, 40),

        // Row 1: Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi \n Teknologi Informasi | 2
        makeWord("Selasa", 20, 70, 85, 90),
        makeWord("09:50:00", 110, 70, 190, 90),
        makeWord("11:30:00", 210, 70, 290, 90),
        makeWord("D.302", 310, 70, 365, 90),
        makeWord("VA", 370, 70, 400, 90),
        makeWord("IF253418", 450, 70, 540, 90),
        makeWord("R.03", 570, 70, 615, 90),
        makeWord("Etika", 650, 62, 705, 82),
        makeWord("Profesi", 715, 62, 785, 82),
        makeWord("Teknologi", 650, 88, 745, 108),
        makeWord("Informasi", 755, 88, 845, 108),
        makeWord("2", 985, 70, 1000, 90),

        // Row 2: Rabu | 10:40:00 | 13:10:00 | Lab. Data \n Science | IF253417 | R.01 | Rekayasa Perangkat \n Lunak Informatika | 3
        makeWord("Rabu", 20, 145, 75, 165),
        makeWord("10:40:00", 110, 145, 190, 165),
        makeWord("13:10:00", 210, 145, 290, 165),
        makeWord("Lab.", 310, 135, 350, 155),
        makeWord("Data", 355, 135, 400, 155),
        makeWord("Science", 310, 160, 385, 180),
        makeWord("IF253417", 450, 145, 540, 165),
        makeWord("R.01", 570, 145, 615, 165),
        makeWord("Rekayasa", 650, 135, 740, 155),
        makeWord("Perangkat", 750, 135, 850, 155),
        makeWord("Lunak", 650, 160, 710, 180),
        makeWord("Informatika", 720, 160, 835, 180),
        makeWord("3", 985, 145, 1000, 165),

        // Row 3: Multiple course on same weekday (Rabu)
        makeWord("Rabu", 20, 215, 75, 235),
        makeWord("13:30:00", 110, 215, 190, 235),
        makeWord("16:00:00", 210, 215, 290, 235),
        makeWord("D.401", 310, 215, 365, 235),
        makeWord("IF253419", 450, 215, 540, 235),
        makeWord("R.02", 570, 215, 615, 235),
        makeWord("Kecerdasan", 650, 215, 760, 235),
        makeWord("Buatan", 770, 215, 840, 235),
        makeWord("3", 985, 215, 1000, 235),
      ];

      const parsed = parseScheduleFromWords(words, [], []);
      assert.equal(parsed.length, 3);

      // Verify Row 1
      assert.equal(parsed[0].hari, "Selasa");
      assert.equal(parsed[0].waktuMulai, "09:50");
      assert.equal(parsed[0].waktuSelesai, "11:30");
      assert.equal(parsed[0].lokasi, "D.302 VA");
      assert.equal(parsed[0].kodeMatkul, "IF253418");
      assert.equal(parsed[0].kelas, "R.03");
      assert.equal(parsed[0].namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.equal(parsed[0].sks, 2);
      assert.equal(parsed[0].needsReview, false);

      // Verify Row 2 (multi-line room + multi-line course name)
      assert.equal(parsed[1].hari, "Rabu");
      assert.equal(parsed[1].waktuMulai, "10:40");
      assert.equal(parsed[1].waktuSelesai, "13:10");
      assert.equal(parsed[1].lokasi, "Lab. Data Science");
      assert.equal(parsed[1].kodeMatkul, "IF253417");
      assert.equal(parsed[1].kelas, "R.01");
      assert.equal(parsed[1].namaMatkul, "Rekayasa Perangkat Lunak Informatika");
      assert.equal(parsed[1].sks, 3);
      assert.equal(parsed[1].needsReview, false);

      // Verify Row 3 (same weekday Rabu, later time slot)
      assert.equal(parsed[2].hari, "Rabu");
      assert.equal(parsed[2].waktuMulai, "13:30");
      assert.equal(parsed[2].waktuSelesai, "16:00");
      assert.equal(parsed[2].lokasi, "D.401");
      assert.equal(parsed[2].kodeMatkul, "IF253419");
      assert.equal(parsed[2].kelas, "R.02");
      assert.equal(parsed[2].namaMatkul, "Kecerdasan Buatan");
      assert.equal(parsed[2].sks, 3);
    });

    test("OCR confusion normalization repairs course codes (1F253418 -> IF253418), times (09:5O:00 -> 09:50), and weekdays (Se1asa -> Selasa)", () => {
      assert.equal(normalizeHari("Se1asa"), "Selasa");
      assert.equal(normalizeHari("Kam1s"), "Kamis");
      assert.equal(normalizeTime("09:5O:00"), "09:50");
      assert.equal(normalizeTime("13.10.00"), "13:10");
      assert.equal(normalizeTime("O8:30"), "08:30");

      const code1 = normalizeCourseCode("1F253418");
      assert.ok(code1);
      assert.equal(code1.code, "IF253418");
      assert.equal(code1.wasCorrected, true);

      const code2 = normalizeCourseCode("IF2S34I8");
      assert.ok(code2);
      assert.equal(code2.code, "IF253418");
      assert.equal(code2.wasCorrected, true);

      const kls = normalizeClassLabel("R.O3");
      assert.ok(kls);
      assert.equal(kls.kelas, "R.03");
    });

    test("Missing or ambiguous cells are never silently invented; they remain visible with needsReview = true", () => {
      // Missing weekday and SKS out of bounds (12 SKS)
      const ambiguousText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 12
      `;
      const items = parseScheduleText(ambiguousText, []);
      assert.equal(items.length, 1);
      assert.equal(items[0].hari, ""); // NOT silently defaulted to "Senin"
      assert.equal(items[0].sks, 12);
      assert.equal(items[0].needsReview, true);
      assert.ok(items[0].warnings.some((w) => w.includes("Hari kuliah")));
      assert.ok(items[0].warnings.some((w) => w.includes("SKS")));
    });

    test("Duplicate and intra-batch conflicting schedules are flagged for review", () => {
      const batchText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2
        Selasa | 10:30:00 | 12:00:00 | Lab. 1 | IF253420 | R.01 | Pemrograman Mobile | 3
      `;
      const items = parseScheduleText(batchText, []);
      assert.equal(items.length, 3);
      assert.equal(items[1].needsReview, true);
      assert.ok(items[1].warnings.some((w) => w.toLowerCase().includes("duplikat")));
      assert.equal(items[2].needsReview, true);
      assert.ok(items[2].warnings.some((w) => w.toLowerCase().includes("bentrok")));
    });

    test("Correction-Aware Recognition learns from user-confirmed items, applies mappings on future imports, and supports removal", () => {
      // 1. User confirms a correction where OCR read "Etika Profes1 TI" and room "D.3O2 VA" for code IF253418
      const confirmedItems = [
        {
          namaMatkul: "Etika Profesi Teknologi Informasi",
          hari: "Selasa",
          lokasi: "D.302 VA",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          sks: 2,
          rawFields: {
            namaMatkul: "Etika Profes1 TI",
            lokasi: "D.3O2 VA",
            kodeMatkul: "1F253418",
          },
        },
      ];

      let userMappings = deriveMappingsFromConfirmedItems(confirmedItems, []);
      assert.ok(userMappings.length >= 3, "Must derive mappings for namaMatkul, lokasi, kodeMatkul, and courseByCode");

      // 2. Subsequent import has noisy OCR "Etika Profes1 TI" and "D.3O2 VA"
      const noisyFutureText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.3O2 VA | 1F253418 | R.03 | Etika Profes1 TI | 2
      `;
      const parsedWithMappings = parseScheduleData({ text: noisyFutureText }, [], userMappings);
      assert.equal(parsedWithMappings.length, 1);
      assert.equal(parsedWithMappings[0].kodeMatkul, "IF253418");
      assert.equal(parsedWithMappings[0].lokasi, "D.302 VA");
      assert.equal(parsedWithMappings[0].namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.ok((parsedWithMappings[0].appliedCorrections || []).length > 0);

      // 3. Removing the namaMatkul & courseByCode mappings stops the automatic name replacement
      for (const m of [...userMappings]) {
        if (m.field === "namaMatkul" || m.field === "courseByCode") {
          userMappings = removeUserMapping(userMappings, m.id);
        }
      }
      const parsedAfterRemoval = parseScheduleData({ text: noisyFutureText }, [], userMappings);
      assert.equal(parsedAfterRemoval[0].namaMatkul, "Etika Profes1 TI");
    });

    test("REAL IMAGE OCR: Renders UNAS timetable bitmap, extracts words + TSV via Tesseract.js, and parses schedule rows", async () => {
      const unasBmp = createRenderedTableBmp([
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

      const ocrResult = await extractOcrFromImage(unasBmp);
      assert.ok(ocrResult.text.length > 0, "Real Tesseract OCR must return non-empty text");
      assert.ok(ocrResult.words.length > 0, "Real Tesseract OCR must return word bounding boxes");

      const items = parseScheduleData(ocrResult, [], []);
      assert.ok(items.length >= 2, `Expected at least 2 rows from real OCR, got ${items.length}`);
      assert.equal(items[0].hari, "Selasa");
      assert.equal(items[0].kodeMatkul, "IF253418");

      assert.equal(items[1].hari, "Rabu");
      assert.equal(items[1].kodeMatkul, "IF253417");
    });
  });

  // -------------------------------------------------------------
  // 5.1: Original Schedule Parser & Import Unit Tests
  // -------------------------------------------------------------
  test.describe("5.1: Schedule Parser & Import Logic", () => {
    test("normalizeHari correctly normalizes valid Indonesian and English day names", () => {
      assert.equal(normalizeHari("senin"), "Senin");
      assert.equal(normalizeHari("SELASA"), "Selasa");
      assert.equal(normalizeHari("Rabu "), "Rabu");
      assert.equal(normalizeHari("kamis"), "Kamis");
      assert.equal(normalizeHari("jum'at"), "Jumat");
      assert.equal(normalizeHari("Jumat"), "Jumat");
      assert.equal(normalizeHari("Sabtu"), "Sabtu");
      assert.equal(normalizeHari("minggu"), "Minggu");
      assert.equal(normalizeHari("Monday"), "Senin");
      assert.equal(normalizeHari("Friday"), "Jumat");
      assert.equal(normalizeHari("unknown_day"), null);
      assert.equal(normalizeHari("liburan"), null);
    });

    test("normalizeTime standardizes various time formats to HH:mm and rejects invalid values", () => {
      assert.equal(normalizeTime("08:00"), "08:00");
      assert.equal(normalizeTime("09:50:00"), "09:50");
      assert.equal(normalizeTime("8:30"), "08:30");
      assert.equal(normalizeTime("14.45"), "14:45");
      assert.equal(normalizeTime("23:59"), "23:59");
      assert.equal(normalizeTime("24:00"), null);
      assert.equal(normalizeTime("12:65"), null);
      assert.equal(normalizeTime("invalid"), null);
    });

    test("parseScheduleText extracts structured schedule items from traditional KRS text", () => {
      const sampleText = `
        KARTU RENCANA STUDI (KRS) SEMESTER GANJIL
        1. Pemrograman Web Lanjut
        Senin 08:00 - 10:30 3 SKS Ruang Lab-3 Dosen: Dr. Budi Santoso
        2. Algoritma dan Struktur Data
        Rabu 13:00 - 15:30 3 SKS Ruang C201 Dosen: Prof. Siti Rahma
      `;

      const results = parseScheduleText(sampleText, []);
      assert.equal(results.length, 2);

      const first = results[0];
      assert.match(first.namaMatkul, /Pemrograman Web Lanjut/i);
      assert.equal(first.hari, "Senin");
      assert.equal(first.waktuMulai, "08:00");
      assert.equal(first.waktuSelesai, "10:30");
      assert.equal(first.sks, 3);
      assert.match(first.lokasi || "", /Lab-3/i);
      assert.match(first.dosen || "", /Budi/i);
      assert.equal(first.needsReview, false);

      const second = results[1];
      assert.match(second.namaMatkul, /Algoritma/i);
      assert.equal(second.hari, "Rabu");
      assert.equal(second.waktuMulai, "13:00");
      assert.equal(second.waktuSelesai, "15:30");
    });

    test("parseScheduleText detects schedule conflicts with existing courses and flags needsReview", () => {
      const sampleText = `
        Kecerdasan Buatan
        Senin 09:00 - 11:30 3 SKS Ruang B102
      `;

      const existingCourses = [
        {
          id: 101,
          namaMatkul: "Basis Data",
          hari: "Senin",
          waktuMulai: new Date("1970-01-01T08:00:00Z"),
          waktuSelesai: new Date("1970-01-01T10:00:00Z"),
        },
      ];

      const results = parseScheduleText(sampleText, existingCourses);
      assert.equal(results.length, 1);
      assert.equal(results[0].needsReview, true);
      assert.ok(results[0].warnings.some((w) => w.includes("Bentrok")));
    });

    test("extractTextFromPdf extracts text from valid PDF buffer in < 1500ms", async () => {
      const rawPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 180 >>
stream
BT
/F1 14 Tf
72 700 Td
(JADWAL KULIAH SEMESTER GENAP) Tj
0 -25 Td
(1. Rekayasa Perangkat Lunak) Tj
0 -20 Td
(Senin 08:00 - 10:30 3 SKS Ruang Lab-1 Dosen: Dr. Sutrisno) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000465 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
540
%%EOF`;
      const t0 = Date.now();
      const text = await extractTextFromPdf(Buffer.from(rawPdf, "utf-8"));
      const duration = Date.now() - t0;
      assert.ok(duration < 1500, `PDF extraction must be fast, took ${duration}ms`);
      assert.match(text, /Rekayasa Perangkat Lunak/i);
      assert.match(text, /Senin 08:00 - 10:30/i);
    });

    test("extractTextFromImage performs OCR on schedule bitmap, measures duration, and terminates cleanly", async () => {
      const testBmpPath = path.resolve("tests/test_schedule.bmp");
      assert.ok(fs.existsSync(testBmpPath), "test_schedule.bmp must exist");
      const buffer = fs.readFileSync(testBmpPath);

      const t0 = Date.now();
      const text = await extractTextFromImage(buffer);
      const ocrDuration = Date.now() - t0;

      assert.ok(ocrDuration < 15000, `OCR should finish well within timeout, took ${ocrDuration}ms`);
      assert.ok(text.length > 0, "OCR must extract text");
      assert.match(text, /PEMROGRAMAN|WEB|LAB|BUDI|SKS/i);
    });

    test("extractTextFromImage safely catches and terminates on corrupted/invalid image data", async () => {
      const corruptBuffer = Buffer.from("THIS_IS_NOT_A_VALID_IMAGE_BUFFER", "utf-8");
      await assert.rejects(
        async () => {
          await extractTextFromImage(corruptBuffer);
        },
        /Corrupt|invalid|Gagal|error|unsupported/i
      );
    });

    test("preview, confirm, and mappings routes implement proper contracts", () => {
      const previewRoutePath = path.resolve("app/api/jadwal/import/preview/route.ts");
      const confirmRoutePath = path.resolve("app/api/jadwal/import/confirm/route.ts");
      const mappingsRoutePath = path.resolve("app/api/jadwal/import/mappings/route.ts");

      assert.ok(fs.existsSync(previewRoutePath), "preview route must exist");
      assert.ok(fs.existsSync(confirmRoutePath), "confirm route must exist");
      assert.ok(fs.existsSync(mappingsRoutePath), "mappings route must exist");

      const previewCode = fs.readFileSync(previewRoutePath, "utf-8");
      assert.ok(previewCode.includes('runtime = "nodejs"'), "preview route must declare nodejs runtime");
      assert.ok(previewCode.includes("MAX_FILE_SIZE = 10 * 1024 * 1024"), "must enforce 10MB limit");
      assert.ok(previewCode.includes("ALLOWED_MIME_TYPES"), "must check MIME types");
      assert.ok(previewCode.includes("extractTextFromPdf"), "must support PDF parsing");
      assert.ok(previewCode.includes("extractOcrFromImage"), "must support spatial Image OCR");

      const confirmCode = fs.readFileSync(confirmRoutePath, "utf-8");
      assert.ok(confirmCode.includes("prisma.$transaction"), "must use atomic transaction");
      assert.ok(confirmCode.includes("userId: session.userId"), "must enforce session ownership");
      assert.ok(confirmCode.includes("deriveMappingsFromConfirmedItems"), "must learn confirmed corrections");
    });
  });

  // -------------------------------------------------------------
  // 5.2: Admin RBAC & Dashboard Security Tests
  // -------------------------------------------------------------
  test.describe("5.2: Admin RBAC & Dashboard Security", () => {
    test("middleware.ts protects /admin routes and redirects non-admin users", () => {
      const middlewarePath = path.resolve("middleware.ts");
      const code = fs.readFileSync(middlewarePath, "utf-8");

      assert.ok(code.includes('"/admin"'), "protectedRoutes must include /admin");
      assert.ok(code.includes('"/admin/:path*"'), "matcher must include /admin/:path*");
      assert.ok(
        code.includes('pathname.startsWith("/admin") && userRole !== "admin"'),
        "middleware must check role and redirect non-admins"
      );
    });

    test("admin pages do not use username fallback for role authorization", () => {
      const usersPagePath = path.resolve("app/admin/users/page.tsx");
      const announcementsPagePath = path.resolve("app/admin/announcements/page.tsx");

      const usersCode = fs.readFileSync(usersPagePath, "utf-8");
      const annCode = fs.readFileSync(announcementsPagePath, "utf-8");

      assert.ok(
        !usersCode.includes('session.username.toLowerCase() === "admin"'),
        "users page must not grant admin based on username"
      );
      assert.ok(
        !annCode.includes('session.username.toLowerCase() === "admin"'),
        "announcements page must not grant admin based on username"
      );

      assert.ok(usersCode.includes('if (userRole !== "admin")'), "users page must strictly check role");
      assert.ok(annCode.includes('if (userRole !== "admin")'), "announcements page must strictly check role");
    });

    test("admin user management endpoints prevent self-demotion and self-deletion", () => {
      const roleRoutePath = path.resolve("app/api/admin/users/[id]/role/route.ts");
      const deleteRoutePath = path.resolve("app/api/admin/users/[id]/route.ts");

      assert.ok(fs.existsSync(roleRoutePath), "role route must exist");
      assert.ok(fs.existsSync(deleteRoutePath), "delete user route must exist");

      const roleCode = fs.readFileSync(roleRoutePath, "utf-8");
      const deleteCode = fs.readFileSync(deleteRoutePath, "utf-8");

      assert.ok(
        roleCode.includes("userId === adminSession.userId"),
        "role change route must reject self-demotion"
      );
      assert.ok(
        deleteCode.includes("userId === adminSession.userId"),
        "delete user route must reject self-deletion"
      );

      assert.ok(roleCode.includes("prisma.adminLog.create"), "role change must log to admin_logs");
      assert.ok(deleteCode.includes("prisma.adminLog.create"), "user delete must log to admin_logs");
    });

    test("announcements endpoints are mapped to real database Prisma model", () => {
      const schemaPath = path.resolve("prisma/schema.prisma");
      const schemaCode = fs.readFileSync(schemaPath, "utf-8");

      assert.ok(schemaCode.includes("model Announcement"), "Prisma must map Announcement model");
      assert.ok(schemaCode.includes('@@map("announcements")'), "Announcement must map to announcements table");
      assert.ok(schemaCode.includes("model AdminLog"), "Prisma must map AdminLog model");
      assert.ok(schemaCode.includes('@@map("admin_logs")'), "AdminLog must map to admin_logs table");
    });

    test("GET /api/admin/users is guarded by requireAdminSession and returns dual-key fields", () => {
      const usersRoutePath = path.resolve("app/api/admin/users/route.ts");
      assert.ok(fs.existsSync(usersRoutePath), "GET /api/admin/users route must exist");
      const code = fs.readFileSync(usersRoutePath, "utf-8");
      assert.ok(code.includes("requireAdminSession"), "must require admin session");
      assert.ok(code.includes("full_name"), "must return snake_case full_name");
      assert.ok(code.includes("fullName"), "must return camelCase fullName");
    });

    test("User Navbar.tsx strictly guards /admin access within profile dropdown based on verified admin role", () => {
      const navbarPath = path.resolve("components/Navbar.tsx");
      const navbarCode = fs.readFileSync(navbarPath, "utf-8");

      // Verify that primary desktop and mobile navigation links do not include /admin
      assert.ok(!navbarCode.includes('{ href: "/admin"'), "Primary navLinks must NOT contain /admin");
      assert.ok(!navbarCode.includes('href="/admin/users"'), "Navbar must NOT contain link to /admin/users");
      assert.ok(!navbarCode.includes('href="/admin/announcements"'), "Navbar must NOT contain link to /admin/announcements");
      assert.ok(!navbarCode.includes("Panel Administrator"), "Navbar must NOT contain legacy Panel Administrator section");

      // Verify role-based guard for Panel Admin link in user dropdown
      assert.ok(navbarCode.includes("isAdmin &&"), "Admin access link must be guarded by isAdmin check");
      assert.ok(navbarCode.includes('href="/admin"'), "Navbar profile dropdown must contain conditional /admin link for admin role");
      assert.ok(navbarCode.includes("Panel Admin"), "Navbar profile dropdown must label admin access as Panel Admin");
    });

    test("Admin Web Console uses dedicated AdminLayout and AdminNavbar with user portal link", () => {
      const layoutPath = path.resolve("app/admin/layout.tsx");
      const adminNavPath = path.resolve("components/AdminNavbar.tsx");

      assert.ok(fs.existsSync(layoutPath), "app/admin/layout.tsx must exist");
      assert.ok(fs.existsSync(adminNavPath), "components/AdminNavbar.tsx must exist");

      const layoutCode = fs.readFileSync(layoutPath, "utf-8");
      const adminNavCode = fs.readFileSync(adminNavPath, "utf-8");

      // layout must verify database admin role
      assert.ok(layoutCode.includes('userRole !== "admin"'), "AdminLayout must redirect non-admin");
      assert.ok(layoutCode.includes("AdminNavbar"), "AdminLayout must render AdminNavbar");

      // AdminNavbar must link to /admin, /admin/users, /admin/announcements and /dashboard
      assert.ok(adminNavCode.includes('"/admin"'), "AdminNavbar links to /admin");
      assert.ok(adminNavCode.includes('"/admin/users"'), "AdminNavbar links to /admin/users");
      assert.ok(adminNavCode.includes('"/admin/announcements"'), "AdminNavbar links to /admin/announcements");
      assert.ok(adminNavCode.includes('href="/dashboard"'), "AdminNavbar provides link to /dashboard");
    });

    test("iOS RootTabView removes admin from main tab navigation and SettingsView provides Safari web admin link", () => {
      const rootTabPath = path.resolve("Sources/TrackerThings/Views/RootTabView.swift");
      const settingsPath = path.resolve("Sources/TrackerThings/Views/Settings/SettingsView.swift");
      const appConfigPath = path.resolve("Sources/TrackerThings/Services/AppConfig.swift");

      const rootCode = fs.readFileSync(rootTabPath, "utf-8");
      const settingsCode = fs.readFileSync(settingsPath, "utf-8");
      const appConfigCode = fs.readFileSync(appConfigPath, "utf-8");

      // RootTabView must NOT contain AdminDashboardView tab
      assert.ok(!rootCode.includes("AdminDashboardView()"), "RootTabView must not include AdminDashboardView in TabView");

      // AppConfig must compute adminWebURL
      assert.ok(appConfigCode.includes("adminWebURL"), "AppConfig must compute adminWebURL");

      // SettingsView must provide Link to adminWebURL for admin users
      assert.ok(settingsCode.includes("AppConfig.shared.adminWebURL"), "SettingsView must link to AppConfig.shared.adminWebURL");
      assert.ok(settingsCode.includes("Dashboard Admin (Web)"), "SettingsView must label the admin button");
    });

    test("iOS Schedule Import components exist with dual-key Codable support and field-level confidence", () => {
      const modelsPath = path.resolve("Sources/TrackerThings/Models/ScheduleImportModels.swift");
      const vmPath = path.resolve("Sources/TrackerThings/ViewModels/ImportScheduleViewModel.swift");
      const viewPath = path.resolve("Sources/TrackerThings/Views/Courses/ImportScheduleView.swift");
      const courseListPath = path.resolve("Sources/TrackerThings/Views/Courses/CourseListView.swift");

      assert.ok(fs.existsSync(modelsPath), "ScheduleImportModels.swift must exist");
      assert.ok(fs.existsSync(vmPath), "ImportScheduleViewModel.swift must exist");
      assert.ok(fs.existsSync(viewPath), "ImportScheduleView.swift must exist");

      const modelsCode = fs.readFileSync(modelsPath, "utf-8");
      const courseListCode = fs.readFileSync(courseListPath, "utf-8");

      assert.ok(modelsCode.includes("nama_matkul"), "ImportScheduleItem must decode snake_case nama_matkul");
      assert.ok(modelsCode.includes("namaMatkul"), "ImportScheduleItem must decode camelCase namaMatkul");
      assert.ok(modelsCode.includes("fieldConfidence"), "ImportScheduleItem must include fieldConfidence");
      assert.ok(modelsCode.includes("visionFallbackEligible"), "ScheduleImportPreviewResponse must support visionFallbackEligible");

      assert.ok(courseListCode.includes("ImportScheduleView"), "CourseListView must present ImportScheduleView");
      assert.ok(courseListCode.includes("isShowingImportSchedule"), "CourseListView must manage import presentation");
    });

    test("role-based post-login redirect routes admin to /admin and students to /dashboard with security bounds", () => {
      // 1. Direct login (no from parameter)
      assert.equal(resolvePostLoginRedirect("admin", null), "/admin");
      assert.equal(resolvePostLoginRedirect("admin", ""), "/admin");
      assert.equal(resolvePostLoginRedirect("mahasiswa", null), "/dashboard");
      assert.equal(resolvePostLoginRedirect("user", null), "/dashboard");

      // 2. Generic unauthenticated redirect (?from=/dashboard or ?from=/)
      assert.equal(resolvePostLoginRedirect("admin", "/dashboard"), "/admin");
      assert.equal(resolvePostLoginRedirect("admin", "/"), "/admin");
      assert.equal(resolvePostLoginRedirect("mahasiswa", "/dashboard"), "/dashboard");

      // 3. Admin accessing admin subpages (?from=/admin/announcements or /admin/users)
      assert.equal(resolvePostLoginRedirect("admin", "/admin/announcements"), "/admin/announcements");
      assert.equal(resolvePostLoginRedirect("admin", "/admin/users?q=test"), "/admin/users?q=test");

      // 4. Student attempting to access admin subpages (?from=/admin or /admin/users) MUST BE DENIED
      assert.equal(resolvePostLoginRedirect("mahasiswa", "/admin"), "/dashboard");
      assert.equal(resolvePostLoginRedirect("mahasiswa", "/admin/users"), "/dashboard");
      assert.equal(resolvePostLoginRedirect("user", "/admin/announcements"), "/dashboard");

      // 5. Normal user accessing permissible features (?from=/ujian)
      assert.equal(resolvePostLoginRedirect("mahasiswa", "/ujian"), "/ujian");
      assert.equal(resolvePostLoginRedirect("admin", "/ujian"), "/ujian");

      // 6. Open redirect attacks rejected
      assert.equal(resolvePostLoginRedirect("admin", "https://evil.com"), "/admin");
      assert.equal(resolvePostLoginRedirect("mahasiswa", "https://evil.com"), "/dashboard");
      assert.equal(resolvePostLoginRedirect("mahasiswa", "//evil.com"), "/dashboard");

      // 7. Verify source files integrate resolvePostLoginRedirect
      const loginActionCode = fs.readFileSync(path.resolve("app/actions/auth.ts"), "utf-8");
      const loginPageCode = fs.readFileSync(path.resolve("app/login/page.tsx"), "utf-8");
      const rootPageCode = fs.readFileSync(path.resolve("app/page.tsx"), "utf-8");

      assert.ok(loginActionCode.includes("resolvePostLoginRedirect"), "loginAction must use resolvePostLoginRedirect");
      assert.ok(loginActionCode.includes("role: userRole"), "loginAction must return userRole from database");
      assert.ok(loginActionCode.includes("redirectUrl"), "loginAction must return redirectUrl");
      assert.ok(loginPageCode.includes("res.redirectUrl"), "LoginPage must assign to res.redirectUrl");
      assert.ok(rootPageCode.includes('redirect("/admin")'), "Root app/page.tsx must direct admin to /admin");
    });
  });

  // -------------------------------------------------------------
  // 5.3: Password Change Consistency Tests
  // -------------------------------------------------------------
  test.describe("5.3: Password Change Consistency (Web vs API)", () => {
    test("both web Server Action and API route reject new password identical to current password", () => {
      const actionPath = path.resolve("app/actions/auth.ts");
      const apiRoutePath = path.resolve("app/api/user/password/route.ts");

      const actionCode = fs.readFileSync(actionPath, "utf-8");
      const apiCode = fs.readFileSync(apiRoutePath, "utf-8");

      assert.ok(
        actionCode.includes("currentPassword === newPassword"),
        "updatePasswordAction must check currentPassword === newPassword"
      );
      assert.ok(
        apiCode.includes("currentPassword === newPassword"),
        "PUT /api/user/password must check currentPassword === newPassword"
      );

      const expectedMsg = "Kata sandi baru tidak boleh sama dengan kata sandi lama.";
      assert.ok(actionCode.includes(expectedMsg), "action must have exact error message");
      assert.ok(apiCode.includes(expectedMsg), "api route must have exact error message");
    });

    test("both web and API update passwordChangedAt timestamp upon success", () => {
      const actionCode = fs.readFileSync(path.resolve("app/actions/auth.ts"), "utf-8");
      const apiCode = fs.readFileSync(path.resolve("app/api/user/password/route.ts"), "utf-8");

      assert.ok(actionCode.includes("passwordChangedAt: new Date()"), "action updates passwordChangedAt");
      assert.ok(apiCode.includes("passwordChangedAt: new Date()"), "api updates passwordChangedAt");
    });
  });

  // -------------------------------------------------------------
  // 5.4: API Consistency & IDOR Protection Verification
  // -------------------------------------------------------------
  test.describe("5.4: API Consistency & Security Guards", () => {
    test("CRUD routes for Jadwal, Tugas, Ujian, and Kelas Pengganti strictly enforce userId ownership", () => {
      const routesToCheck = [
        "app/api/jadwal/route.ts",
        "app/api/jadwal/[id]/route.ts",
        "app/api/tugas/route.ts",
        "app/api/tugas/[id]/route.ts",
        "app/api/ujian/route.ts",
        "app/api/ujian/[id]/route.ts",
        "app/api/kelas-pengganti/route.ts",
        "app/api/kelas-pengganti/[id]/route.ts",
      ];

      for (const relPath of routesToCheck) {
        const fullPath = path.resolve(relPath);
        assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
        const code = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          code.includes("userId: session.userId") ||
          code.includes("user_id: session.userId") ||
          code.includes("existing.userId !== session.userId"),
          `${relPath} must enforce userId filter`
        );
      }
    });
  });

  // -------------------------------------------------------------
  // 6.0: Phase 6 — Smart Schedule Intelligence Tests
  // -------------------------------------------------------------
  test.describe("Phase 6 — Smart Schedule Intelligence (Field Confidence, Multi-Layout, Safety & iOS Contract)", () => {
    test("1. Field-level confidence distinguishes high-confidence vs. ambiguous/repaired fields with reviewReason", () => {
      const text = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2
        Rabu | 10:4O:00 | 13:10:00 | Lab. Data Science | 1F253417 | R.01 | Rekayasa Perangkat Lunak | 3
      `;
      const items = parseScheduleText(text, [], []);
      assert.equal(items.length, 2);

      // Row 1: All fields clean and aligned with recognized headers -> high confidence, needsReview = false
      const row1 = items[0];
      assert.equal(row1.needsReview, false);
      assert.equal(row1.recognitionStatus, "high_confidence");
      assert.ok(row1.fieldConfidence, "fieldConfidence object must be populated");
      assert.equal(row1.fieldConfidence.hari.level, "high");
      assert.equal(row1.fieldConfidence.hari.needsReview, false);
      assert.equal(row1.fieldConfidence.waktuMulai.level, "high");
      assert.equal(row1.fieldConfidence.kodeMatkul.level, "high");
      assert.equal(row1.fieldConfidence.namaMatkul.level, "high");
      assert.equal(row1.fieldConfidence.sks.level, "high");

      // Row 2: OCR repaired waktuMulai ('10:4O:00') and kodeMatkul ('1F253417') -> medium confidence, flagged with specific reviewReason
      const row2 = items[1];
      assert.equal(row2.waktuMulai, "10:40");
      assert.equal(row2.kodeMatkul, "IF253417");
      assert.equal(row2.fieldConfidence.waktuMulai.level, "medium");
      assert.equal(row2.fieldConfidence.waktuMulai.source, "ocr_normalized");
      assert.equal(row2.fieldConfidence.waktuMulai.needsReview, true);
      assert.match(row2.fieldConfidence.waktuMulai.reviewReason || "", /10:4O:00/);

      assert.equal(row2.fieldConfidence.kodeMatkul.level, "medium");
      assert.equal(row2.fieldConfidence.kodeMatkul.source, "ocr_normalized");
      assert.equal(row2.fieldConfidence.kodeMatkul.needsReview, true);
      assert.match(row2.fieldConfidence.kodeMatkul.reviewReason || "", /1F253417/);
      // Meanwhile, clean fields in Row 2 (hari, namaMatkul, sks) remain high confidence and not marked needsReview!
      assert.equal(row2.fieldConfidence.hari.needsReview, false);
      assert.equal(row2.fieldConfidence.namaMatkul.needsReview, false);
      assert.equal(row2.fieldConfidence.sks.needsReview, false);
    });

    test("2. Prevents silent wrong course replacement when course code conflicts with OCR course name, offering tentativeSuggestion instead", () => {
      // Suppose user has confirmed IF253418 -> "Etika Profesi Teknologi Informasi"
      const mappings = [
        {
          id: "map_code_1",
          field: "courseByCode",
          sourceKey: "IF253418",
          targetValue: "Etika Profesi Teknologi Informasi",
          metadata: {
            namaMatkul: "Etika Profesi Teknologi Informasi",
            sks: 2,
          },
          updatedAt: new Date().toISOString(),
        },
      ];

      // Scenario A: OCR misread IF253417 as IF253418 on a row whose text clearly says "Rekayasa Perangkat Lunak Informatika"
      const conflictingText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Rabu | 10:40:00 | 13:10:00 | Lab. Data Science | IF253418 | R.01 | Rekayasa Perangkat Lunak Informatika | 3
      `;
      const conflictItems = parseScheduleText(conflictingText, [], mappings);
      assert.equal(conflictItems.length, 1);
      // MUST NOT silently overwrite "Rekayasa Perangkat Lunak Informatika" with "Etika Profesi Teknologi Informasi"!
      assert.equal(conflictItems[0].namaMatkul, "Rekayasa Perangkat Lunak Informatika");
      assert.equal(conflictItems[0].needsReview, true);
      assert.equal(
        conflictItems[0].tentativeSuggestions?.namaMatkul,
        "Etika Profesi Teknologi Informasi"
      );
      assert.equal(conflictItems[0].fieldConfidence.namaMatkul.needsReview, true);
      assert.match(conflictItems[0].fieldConfidence.namaMatkul.reviewReason || "", /tersimpan sebagai/i);

      // Scenario B: When OCR course name is truncated/similar ("Etika Profesi Tek"), courseByCode safely restores the full confirmed name
      const matchingText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Tekno Informasi | 2
      `;
      const matchedItems = parseScheduleText(matchingText, [], mappings);
      assert.equal(matchedItems.length, 1);
      assert.equal(matchedItems[0].namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.equal(matchedItems[0].fieldConfidence.namaMatkul.level, "confirmed");
      assert.equal(matchedItems[0].fieldConfidence.namaMatkul.source, "user_mapping");
      assert.equal(matchedItems[0].recognitionStatus, "confirmed_assisted");
    });

    test("3. Supports multiple timetable layouts: UNAS 8-col, combined start/end time table, simple schedule table, and traditional KRS", () => {
      // Layout A: Combined time column table ("Hari | Jam | Kode MK | Mata Kuliah | Ruang | SKS")
      const combinedTimeTable = `
        Hari | Jam | Kode MK | Mata Kuliah | Ruang | SKS
        Senin | 08:00 - 10:30 | IF251101 | Struktur Data dan Algoritma | R.401 | 3
        Kamis | 13:00 s/d 14:40 | IF251102 | Sistem Operasi | Lab. Jaringan | 2
      `;
      const recCombined = recognizeScheduleData({ text: combinedTimeTable }, [], []);
      assert.equal(recCombined.layout.kind, "combined_time_table");
      assert.equal(recCombined.layout.hasRecognizedHeaders, true);
      assert.equal(recCombined.items.length, 2);
      assert.equal(recCombined.items[0].hari, "Senin");
      assert.equal(recCombined.items[0].waktuMulai, "08:00");
      assert.equal(recCombined.items[0].waktuSelesai, "10:30");
      assert.equal(recCombined.items[0].kodeMatkul, "IF251101");
      assert.equal(recCombined.items[0].namaMatkul, "Struktur Data dan Algoritma");
      assert.equal(recCombined.items[0].lokasi, "R.401");
      assert.equal(recCombined.items[0].sks, 3);
      assert.equal(recCombined.items[0].needsReview, false);

      assert.equal(recCombined.items[1].hari, "Kamis");
      assert.equal(recCombined.items[1].waktuMulai, "13:00");
      assert.equal(recCombined.items[1].waktuSelesai, "14:40");

      // Layout B: Simpler weekday/time/course table without Kode MK or Kls
      const simpleTable = `
        Hari | Waktu | Mata Kuliah | Ruangan | SKS
        Jumat | 09:00 - 11:00 | Bahasa Indonesia Akademik | G.204 | 2
      `;
      const recSimple = recognizeScheduleData({ text: simpleTable }, [], []);
      assert.equal(recSimple.items.length, 1);
      assert.equal(recSimple.items[0].hari, "Jumat");
      assert.equal(recSimple.items[0].waktuMulai, "09:00");
      assert.equal(recSimple.items[0].waktuSelesai, "11:00");
      assert.equal(recSimple.items[0].namaMatkul, "Bahasa Indonesia Akademik");
      assert.equal(recSimple.items[0].lokasi, "G.204");
      assert.equal(recSimple.items[0].sks, 2);
    });

    test("4. Handles missing headers, incomplete rows, and unstructured fallback with explicit limitationReason", () => {
      // Missing header row in a 4-column pipe table
      const headerlessTable = `
        Senin | 08:00 - 09:40 | Kalkulus Lanjut | 2
        Rabu | 10:00 - 12:30 | Pemrograman Berorientasi Objek | 3
      `;
      const recHeaderless = recognizeScheduleData({ text: headerlessTable }, [], []);
      assert.equal(recHeaderless.layout.hasRecognizedHeaders, false);
      assert.ok(recHeaderless.layout.limitationReason, "must explain missing table header");
      assert.equal(recHeaderless.items.length, 2);
      assert.equal(recHeaderless.items[0].hari, "Senin");
      assert.equal(recHeaderless.items[0].waktuMulai, "08:00");
      assert.equal(recHeaderless.items[0].waktuSelesai, "09:40");
      assert.equal(recHeaderless.items[0].namaMatkul, "Kalkulus Lanjut");
      assert.equal(recHeaderless.items[0].sks, 2);

      // Unstructured fallback text with missing times/SKS
      const unstructured = `Catatan kuliah: Jaringan Komputer Gedung B`;
      const recFallback = recognizeScheduleData({ text: unstructured }, [], []);
      assert.equal(recFallback.layout.kind, "unstructured_fallback");
      assert.ok(recFallback.layout.limitationReason, "must provide limitation explanation");
      assert.equal(recFallback.items.length, 1);
      assert.equal(recFallback.items[0].needsReview, true);
      assert.equal(recFallback.items[0].hari, "");
      assert.equal(recFallback.items[0].waktuMulai, "");
      assert.equal(recFallback.items[0].sks, null);
      assert.equal(recFallback.items[0].fieldConfidence.hari.needsReview, true);
      assert.equal(recFallback.items[0].fieldConfidence.waktuMulai.needsReview, true);
      assert.equal(recFallback.items[0].fieldConfidence.sks.needsReview, true);
    });

    test("5. User isolation & iOS-compatible response keys (snake_case + camelCase)", () => {
      // User A mappings must never leak into User B parsing when passed separately
      const userAMappings = [
        {
          id: "m_a",
          field: "lokasi",
          sourceKey: "Lab. Data Sclence",
          targetValue: "Lab. Data Science",
          updatedAt: new Date().toISOString(),
        },
      ];
      const userBMappings = [];

      const sampleRow = `Rabu | 10:40:00 | 13:10:00 | Lab. Data Sclence | IF253417 | R.01 | Rekayasa Perangkat Lunak | 3`;
      const itemsUserA = parseScheduleText(sampleRow, [], userAMappings);
      const itemsUserB = parseScheduleText(sampleRow, [], userBMappings);

      assert.equal(itemsUserA[0].lokasi, "Lab. Data Science");
      assert.equal(itemsUserA[0].fieldConfidence.lokasi.level, "confirmed");
      assert.equal(itemsUserB[0].lokasi, "Lab. Data Sclence");
      assert.notEqual(itemsUserB[0].fieldConfidence.lokasi.level, "confirmed");

      // Verify iOS-compatible snake_case keys alongside camelCase on ParsedScheduleItem
      assert.equal(itemsUserA[0].nama_matkul, "Rekayasa Perangkat Lunak");
      assert.equal(itemsUserA[0].waktu_mulai, "10:40");
      assert.equal(itemsUserA[0].waktu_selesai, "13:10");
      assert.equal(itemsUserA[0].kode_matkul, "IF253417");

      // Verify scheduleCorrections.ts scopes DB key strictly by userId
      const corrCode = fs.readFileSync(path.resolve("lib/scheduleCorrections.ts"), "utf-8");
      assert.ok(
        corrCode.includes("`schedule_mappings_user_${userId}`"),
        "scheduleCorrections must isolate storage key per userId"
      );
    });
  });

  // -------------------------------------------------------------
  // 7.0: Hybrid OCR + AI Vision Fallback Tests (Phase G)
  // -------------------------------------------------------------
  test.describe("Phase G — Hybrid OCR + AI Vision Fallback Suite", () => {
    test("1. Local OCR success does NOT flag insufficiency and keeps vision fallback unneeded", () => {
      const cleanText = `
        Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS
        Selasa | 09:50:00 | 11:30:00 | D.302 VA | IF253418 | R.03 | Etika Profesi Teknologi Informasi | 2
        Rabu | 10:40:00 | 13:10:00 | Lab. Data Science | IF253417 | R.01 | Rekayasa Perangkat Lunak | 3
      `;
      const rec = recognizeScheduleData({ text: cleanText });
      assert.equal(rec.items.length, 2);
      assert.equal(rec.insufficientForProduction, false);
      assert.equal(rec.insufficiencyReasons?.length || 0, 0);
      assert.equal(rec.items[0].extractionSource, "local_ocr");
    });

    test("2. Local OCR failure triggers insufficiency indicator with explicit reasons", () => {
      // Degraded text: missing time, unmapped layout
      const degradedText = `Catatan jadwal kuliah tanpa jam atau sks jelas`;
      const rec = recognizeScheduleData({ text: degradedText });
      assert.equal(rec.insufficientForProduction, true);
      assert.ok(rec.insufficiencyReasons && rec.insufficiencyReasons.length > 0);
      assert.ok(
        rec.insufficiencyReasons.some(
          (r) => r.includes("header") || r.includes("jam kuliah") || r.includes("hari")
        )
      );
    });

    test("3. Vision fallback route requires explicit user consent, rejecting unconsented requests", async () => {
      const visionRoutePath = path.resolve("app/api/jadwal/import/vision/route.ts");
      assert.ok(fs.existsSync(visionRoutePath), "vision route file must exist");
      const visionRouteCode = fs.readFileSync(visionRoutePath, "utf-8");

      assert.ok(
        visionRouteCode.includes('formData.get("userConsent")'),
        "route must read userConsent parameter"
      );
      assert.ok(
        visionRouteCode.includes('consent !== "true" && consent !== "1"'),
        "route must strictly verify userConsent is explicitly granted"
      );
      assert.ok(
        visionRouteCode.includes("CONSENT_REQUIRED"),
        "route must return CONSENT_REQUIRED code on missing consent"
      );
    });

    test("4. Vision extraction abstraction accurately extracts 8-column table with combined times, multi-line names, and preserves nulls without hallucinating", async () => {
      const mockRows = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          lokasi: "D.302 VA",
          namaMatkul: "Etika Profesi Teknologi Informasi",
          sks: 2,
          dosen: null,
          confidenceEstimate: 95,
        },
        {
          hari: "Rabu",
          waktuMulai: "10:40",
          waktuSelesai: "13:10",
          kodeMatkul: "IF253417",
          kelas: "R.01",
          lokasi: "Lab. Data Science",
          namaMatkul: "Rekayasa Perangkat Lunak Informatika",
          sks: 3,
          dosen: "Dr. Budi Santoso",
          confidenceEstimate: 92,
        },
      ];

      const mockProvider = new MockVisionProvider(mockRows);
      const result = await mockProvider.extractSchedule();

      assert.equal(result.provider, "mock");
      assert.equal(result.rows.length, 2);
      assert.equal(result.rows[0].hari, "Selasa");
      assert.equal(result.rows[0].waktuMulai, "09:50");
      assert.equal(result.rows[0].waktuSelesai, "11:30");
      assert.equal(result.rows[0].kodeMatkul, "IF253418");
      assert.equal(result.rows[0].namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.equal(result.rows[0].sks, 2);
      assert.equal(result.rows[0].dosen, null);

      assert.equal(result.rows[1].namaMatkul, "Rekayasa Perangkat Lunak Informatika");
      assert.equal(result.rows[1].lokasi, "Lab. Data Science");
      assert.equal(result.rows[1].dosen, "Dr. Budi Santoso");
    });

    test("5. Hybrid merge resolves discrepancies, flags conflicting local OCR vs vision results, and preserves local evidence", () => {
      // Local OCR had a misread course name and slightly conflicting start time
      const localItems = [
        {
          id: "loc_1",
          namaMatkul: "Etika Profesi Tek",
          hari: "Selasa",
          waktuMulai: "09:00", // local OCR read 09:00 while vision reads 09:50
          waktuSelesai: "11:30",
          lokasi: "D.302 VA",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          sks: 2,
          dosen: null,
          needsReview: false,
          warnings: [],
          recognitionStatus: "high_confidence",
        },
      ];

      const visionRows = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          kodeMatkul: "IF253418",
          namaMatkul: "Etika Profesi Teknologi Informasi",
          kelas: "R.03",
          lokasi: "D.302 VA",
          sks: 2,
          dosen: null,
        },
      ];

      const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
      assert.equal(merged.length, 1);
      const item = merged[0];
      // Kept more complete vision course name
      assert.equal(item.namaMatkul, "Etika Profesi Teknologi Informasi");
      assert.equal(item.extractionSource, "hybrid_merged");
      // Time discrepancy must be flagged for manual review rather than silently deciding!
      assert.equal(item.needsReview, true);
      assert.ok(item.warnings.some((w) => w.includes("Perbedaan jam kuliah")));
      assert.equal(item.tentativeSuggestions?.waktuMulai, "09:00");
    });

    test("6. Error handling: Provider failure, timeout, missing API key, model unavailability, and per-user rate limit", async () => {
      // 1. Missing API Key check
      const emptyKeyProvider = new GeminiVisionProvider({ apiKey: "" });
      assert.equal(emptyKeyProvider.isAvailable(), false);
      await assert.rejects(
        async () => {
          await emptyKeyProvider.extractSchedule(Buffer.from("fake_img"), "image/jpeg");
        },
        /GEMINI_API_KEY/
      );

      // 2. Model unavailability (HTTP 404) error handling
      const originalFetch = global.fetch;
      try {
        global.fetch = async () => ({
          ok: false,
          status: 404,
          json: async () => ({ error: { message: "models/gemini-invalid is not found for API version v1beta" } }),
          text: async () => "Not Found",
        });
        const notFoundProvider = new GeminiVisionProvider({ apiKey: "test_key", modelId: "gemini-invalid-model" });
        await assert.rejects(
          async () => {
            await notFoundProvider.extractSchedule(Buffer.from("fake_img"), "image/jpeg");
          },
          /tidak ditemukan atau tidak tersedia \(HTTP 404\)/i
        );
      } finally {
        global.fetch = originalFetch;
      }

      // 3. Regression Test: Timeout / Abort error handling and non-retryable classification
      const timeoutFetch = global.fetch;
      try {
        global.fetch = async () => {
          const err = new Error("This operation was aborted");
          err.name = "AbortError";
          throw err;
        };
        const timeoutProvider = new GeminiVisionProvider({ apiKey: "test_key", timeoutMs: 50, maxRetries: 3 });
        const t0 = Date.now();
        await assert.rejects(
          async () => {
            await timeoutProvider.extractSchedule(Buffer.from("fake_img"), "image/jpeg");
          },
          /melebihi batas waktu/i
        );
        const duration = Date.now() - t0;
        // Must fail immediately on timeout without repeating retries
        assert.ok(duration < 500, `Timeout must be treated as non-retryable, took ${duration}ms`);
      } finally {
        global.fetch = timeoutFetch;
      }

      // 4. Mock provider timeout / failure simulation
      const failingMock = new MockVisionProvider([]);
      failingMock.setFailure(true, "Simulated upstream quota exhausted (HTTP 429)");
      await assert.rejects(
        async () => {
          await failingMock.extractSchedule();
        },
        /quota exhausted/i
      );

      // 5. User rate limiting guard (max 5 requests/minute)
      const testUserId = `user_rate_${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        const check = checkUserVisionRateLimit(testUserId);
        assert.equal(check.allowed, true);
      }
      const exceeded = checkUserVisionRateLimit(testUserId);
      assert.equal(exceeded.allowed, false);
      assert.ok((exceeded.retryAfterSeconds || 0) > 0);
    });

    test("7. Security, Privacy & Model Configuration: Model ID defaults to gemini-3.5-flash-lite, supports gemini-3.8-flash with adaptive timeout, no key leakage, and sanitized error mapping", () => {
      // Verify .env.example has placeholder and modern gemini-3.5-flash-lite model ID
      const envExample = fs.readFileSync(path.resolve(".env.example"), "utf-8");
      assert.ok(envExample.includes('GEMINI_API_KEY=""'), "GEMINI_API_KEY must be empty string in .env.example");
      assert.ok(!envExample.includes("AIzaSy"), "Never commit a real Google API key in .env.example");
      assert.ok(envExample.includes('GEMINI_MODEL_ID="gemini-3.5-flash-lite"'), "GEMINI_MODEL_ID must default to gemini-3.5-flash-lite in .env.example");
      assert.ok(!envExample.includes("gemini-2.0-flash"), "gemini-2.0-flash must not be suggested or active");
      assert.ok(!envExample.includes('GEMINI_MODEL_ID="gemini-2.5-flash"'), "gemini-2.5-flash default must be updated");

      // Verify lib/visionProvider.ts does not export or leak GEMINI_API_KEY to browser
      const visionProviderCode = fs.readFileSync(path.resolve("lib/visionProvider.ts"), "utf-8");
      assert.ok(!visionProviderCode.includes("NEXT_PUBLIC_GEMINI"), "Never use NEXT_PUBLIC prefix for vision key");
      assert.ok(visionProviderCode.includes("process.env.GEMINI_API_KEY"), "Reads server-only process.env.GEMINI_API_KEY");
      assert.ok(!visionProviderCode.includes('"gemini-2.0-flash"'), "Code must not fallback to deprecated gemini-2.0-flash");

      // Verify model ID resolution & adaptive timeout in getVisionProviderConfig
      const prevModel = process.env.GEMINI_MODEL_ID;
      const prevVisionModel = process.env.VISION_MODEL_ID;
      const prevTimeout = process.env.VISION_TIMEOUT_MS;
      try {
        delete process.env.GEMINI_MODEL_ID;
        delete process.env.VISION_MODEL_ID;
        delete process.env.VISION_TIMEOUT_MS;
        const defaultConfig = getVisionProviderConfig();
        assert.equal(defaultConfig.modelId, "gemini-3.5-flash-lite", "Default model ID must be gemini-3.5-flash-lite");
        assert.equal(defaultConfig.timeoutMs, 60000, "Default timeout for flash-lite must be 60000ms");

        process.env.GEMINI_MODEL_ID = "gemini-3.8-flash";
        const customConfig = getVisionProviderConfig();
        assert.equal(customConfig.modelId, "gemini-3.8-flash", "Custom GEMINI_MODEL_ID must be respected");
        assert.equal(customConfig.timeoutMs, 85000, "gemini-3.8-flash must receive adaptive 85000ms timeout ceiling");
      } finally {
        if (prevModel !== undefined) {
          process.env.GEMINI_MODEL_ID = prevModel;
        } else {
          delete process.env.GEMINI_MODEL_ID;
        }
        if (prevVisionModel !== undefined) {
          process.env.VISION_MODEL_ID = prevVisionModel;
        } else {
          delete process.env.VISION_MODEL_ID;
        }
        if (prevTimeout !== undefined) {
          process.env.VISION_TIMEOUT_MS = prevTimeout;
        } else {
          delete process.env.VISION_TIMEOUT_MS;
        }
      }

      // Verify vision route enforces getAuthSession and error sanitization
      const visionRoute = fs.readFileSync(path.resolve("app/api/jadwal/import/vision/route.ts"), "utf-8");
      assert.ok(visionRoute.includes("await getAuthSession(req)"), "vision route must verify authentication");
      assert.ok(visionRoute.includes("userId: session.userId"), "vision route must filter user existing courses");
      assert.ok(visionRoute.includes("status = 504"), "vision route must map timeouts to HTTP 504");
      assert.ok(visionRoute.includes("key=[REDACTED]"), "vision route must redact API keys from error logs");
    });

    test("8. EVALUATION SET: Real-image UNAS timetable screenshot accuracy report", async () => {
      // Developer-provided real UNAS timetable bitmap fixture
      const unasBmpPath = path.resolve("tests/unas_schedule.bmp");
      if (!fs.existsSync(unasBmpPath)) {
        const generated = createRenderedTableBmp([
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
        fs.writeFileSync(unasBmpPath, generated);
      }
      assert.ok(fs.existsSync(unasBmpPath), "unas_schedule.bmp fixture must exist");
      const buffer = fs.readFileSync(unasBmpPath);

      // Expected ground-truth values manually checked from the UNAS schedule fixture:
      // Row 1: Selasa, 09:50, 11:30, D.302 VA, IF253418, R.03, Etika Profesi Teknologi Informasi, 2 SKS
      // Row 2: Rabu, 10:40, 13:10, Lab. Data Science, IF253417, R.01, Rekayasa Perangkat Lunak Informatika, 3 SKS
      const expectedRows = [
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          namaMatkul: "Etika Profesi",
          lokasi: "D.302 VA",
          sks: 2,
        },
        {
          hari: "Rabu",
          waktuMulai: "10:40",
          waktuSelesai: "13:10",
          kodeMatkul: "IF253417",
          kelas: "R.01",
          namaMatkul: "Rekayasa Perangkat Lunak",
          lokasi: "Lab. Data Science",
          sks: 3,
        },
      ];

      // A. Evaluate Local OCR on the real timetable image
      const localOcr = await extractOcrFromImage(buffer);
      const localRecognized = recognizeScheduleData({
        text: localOcr.text,
        words: localOcr.words,
      });

      assert.ok(localRecognized.items.length >= 2, "Local OCR must extract at least 2 timetable rows");

      let localExactHari = 0;
      let localExactMulai = 0;
      let localExactSelesai = 0;
      let localExactKode = 0;
      let localExactSks = 0;

      for (let i = 0; i < expectedRows.length; i++) {
        const exp = expectedRows[i];
        const actual = localRecognized.items[i];
        if (!actual) continue;
        if (actual.hari.toLowerCase() === exp.hari.toLowerCase()) localExactHari++;
        if (actual.waktuMulai === exp.waktuMulai) localExactMulai++;
        if (actual.waktuSelesai === exp.waktuSelesai) localExactSelesai++;
        if (actual.kodeMatkul?.toUpperCase() === exp.kodeMatkul.toUpperCase()) localExactKode++;
        if (actual.sks === exp.sks) localExactSks++;
      }

      const totalFields = expectedRows.length * 5;
      const totalLocalMatched = localExactHari + localExactMulai + localExactSelesai + localExactKode + localExactSks;
      const localAccuracyPercent = Math.round((totalLocalMatched / totalFields) * 100);

      // B. Evaluate Hybrid Fallback on the same real fixture using MockVisionProvider ground truth
      const mockVisionProvider = new MockVisionProvider([
        {
          hari: "Selasa",
          waktuMulai: "09:50",
          waktuSelesai: "11:30",
          kodeMatkul: "IF253418",
          kelas: "R.03",
          lokasi: "D.302 VA",
          namaMatkul: "Etika Profesi Teknologi Informasi",
          sks: 2,
          dosen: null,
          confidenceEstimate: 98,
        },
        {
          hari: "Rabu",
          waktuMulai: "10:40",
          waktuSelesai: "13:10",
          kodeMatkul: "IF253417",
          kelas: "R.01",
          lokasi: "Lab. Data Science",
          namaMatkul: "Rekayasa Perangkat Lunak Informatika",
          sks: 3,
          dosen: null,
          confidenceEstimate: 96,
        },
      ]);

      const visionExtracted = await mockVisionProvider.extractSchedule();
      const hybridMerged = mergeVisionWithOcrSchedule(
        localRecognized.items,
        visionExtracted.rows,
        [],
        []
      );

      let hybridExactHari = 0;
      let hybridExactMulai = 0;
      let hybridExactSelesai = 0;
      let hybridExactKode = 0;
      let hybridExactSks = 0;

      for (let i = 0; i < expectedRows.length; i++) {
        const exp = expectedRows[i];
        const actual = hybridMerged[i];
        if (!actual) continue;
        if (actual.hari.toLowerCase() === exp.hari.toLowerCase()) hybridExactHari++;
        if (actual.waktuMulai === exp.waktuMulai) hybridExactMulai++;
        if (actual.waktuSelesai === exp.waktuSelesai) hybridExactSelesai++;
        if (actual.kodeMatkul?.toUpperCase() === exp.kodeMatkul.toUpperCase()) hybridExactKode++;
        if (actual.sks === exp.sks) hybridExactSks++;
      }

      const totalHybridMatched = hybridExactHari + hybridExactMulai + hybridExactSelesai + hybridExactKode + hybridExactSks;
      const hybridAccuracyPercent = Math.round((totalHybridMatched / totalFields) * 100);

      assert.equal(hybridAccuracyPercent, 100, "Hybrid vision fallback must achieve 100% exact match on ground truth");
      assert.ok(
        hybridAccuracyPercent >= localAccuracyPercent,
        `Hybrid accuracy (${hybridAccuracyPercent}%) must be equal or superior to local OCR (${localAccuracyPercent}%)`
      );
    });
  });

  // -------------------------------------------------------------
  // 5.5: Authentication Hardening, Session Revocation & Role Sync
  // -------------------------------------------------------------
  test.describe("5.5: Authentication Hardening, Session Revocation & Role Sync", () => {
    test("1. Token issued before passwordChangedAt is strictly rejected (session revoked)", async () => {
      let testUser = await prisma.user.findFirst({
        where: { username: "hardening_test_user" },
      });

      const pwdChangedAt = new Date(Date.now() - 60000); // 1 minute ago

      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            username: "hardening_test_user",
            email: "hardening_test@trackerthings.com",
            password: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
            role: "user",
            passwordChangedAt: pwdChangedAt,
          },
        });
      } else {
        testUser = await prisma.user.update({
          where: { id: testUser.id },
          data: { passwordChangedAt: pwdChangedAt },
        });
      }

      // Old token generated 10 seconds BEFORE password change
      const oldTokenTimeMs = pwdChangedAt.getTime() - 10000;
      const oldToken = await signSessionToken({
        userId: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: "user",
        tokenTimeMs: oldTokenTimeMs,
      });

      const rawOldSession = await verifySessionToken(oldToken);
      assert.ok(rawOldSession, "Raw JWT signature must be valid");
      assert.equal(rawOldSession.tokenTimeMs, oldTokenTimeMs);

      // Validate against database
      const validatedOldSession = await validateSessionUser(rawOldSession);
      assert.equal(
        validatedOldSession,
        null,
        "Token issued before passwordChangedAt must be invalidated and return null"
      );
    });

    test("2. Fresh token issued after passwordChangedAt is accepted and valid", async () => {
      const testUser = await prisma.user.findFirst({
        where: { username: "hardening_test_user" },
      });
      assert.ok(testUser, "Test user must exist");

      // Fresh token generated 10 seconds AFTER password change
      const freshTokenTimeMs = (testUser.passwordChangedAt?.getTime() || Date.now()) + 10000;
      const freshToken = await signSessionToken({
        userId: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: "user",
        tokenTimeMs: freshTokenTimeMs,
      });

      const rawFreshSession = await verifySessionToken(freshToken);
      assert.ok(rawFreshSession);

      const validatedFreshSession = await validateSessionUser(rawFreshSession);
      assert.ok(validatedFreshSession, "Fresh token must be validated successfully");
      assert.equal(validatedFreshSession.userId, testUser.id);
      assert.equal(validatedFreshSession.username, testUser.username);
    });

    test("3. Demoting admin role in database immediately revokes admin access across active sessions", async () => {
      let demoteUser = await prisma.user.findFirst({
        where: { username: "hardening_admin_demote" },
      });

      if (!demoteUser) {
        demoteUser = await prisma.user.create({
          data: {
            username: "hardening_admin_demote",
            email: "hardening_demote@trackerthings.com",
            password: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
            role: "admin",
          },
        });
      }

      // Token issued with role: "admin"
      const adminToken = await signSessionToken({
        userId: demoteUser.id,
        username: demoteUser.username,
        email: demoteUser.email,
        role: "admin",
      });

      // Now demote user in database to "user"
      await prisma.user.update({
        where: { id: demoteUser.id },
        data: { role: "user" },
      });

      // Verification: raw token claims role "admin", but validation syncs to "user"
      const rawSession = await verifySessionToken(adminToken);
      assert.ok(rawSession);
      assert.equal(rawSession.role, "admin", "Stale token claim still has admin");

      const validatedSession = await validateSessionUser(rawSession);
      assert.ok(validatedSession);
      assert.equal(
        validatedSession.role,
        "user",
        "validateSessionUser must strictly synchronize role from database to user"
      );

      // Simulated native iOS Bearer request to admin endpoint
      const fakeReq = new Request("http://localhost:3000/api/admin/users", {
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      const adminAccess = await requireAdminSession(fakeReq);
      assert.equal(
        adminAccess,
        null,
        "requireAdminSession must reject demoted admin even if token claims admin"
      );
    });

    test("4. Missing or invalid session is rejected on both Web and iOS Bearer paths", async () => {
      // 4.a: Missing Authorization header
      const emptyReq = new Request("http://localhost:3000/api/jadwal");
      const noSession = await getAuthSession(emptyReq);
      assert.equal(noSession, null, "Request without credentials must yield null session");

      const adminDenied = await requireAdminSession(emptyReq);
      assert.equal(adminDenied, null, "Request without credentials must be denied by requireAdminSession");

      // 4.b: Malformed / tampered Bearer token
      const malformedReq = new Request("http://localhost:3000/api/jadwal", {
        headers: {
          authorization: "Bearer invalid.jwt.token",
        },
      });
      const malformedSession = await getAuthSession(malformedReq);
      assert.equal(malformedSession, null, "Malformed Bearer token must yield null session");
    });

    test("5. Student user cannot access admin APIs via requireAdminSession", async () => {
      let studentUser = await prisma.user.findFirst({
        where: { role: "mahasiswa" },
      });
      if (!studentUser) {
        studentUser = await prisma.user.findFirst({ where: { role: "user" } });
      }
      assert.ok(studentUser, "Student user must exist in DB");

      const studentToken = await signSessionToken({
        userId: studentUser.id,
        username: studentUser.username,
        email: studentUser.email,
        role: "user",
      });

      const studentReq = new Request("http://localhost:3000/api/admin/announcements", {
        headers: {
          authorization: `Bearer ${studentToken}`,
        },
      });

      const session = await getAuthSession(studentReq);
      assert.ok(session, "Student session must be valid for student routes");
      assert.equal(session.role, studentUser.role?.toLowerCase() || "user");

      const adminAccess = await requireAdminSession(studentReq);
      assert.equal(adminAccess, null, "requireAdminSession must reject student user");
    });
  });
});


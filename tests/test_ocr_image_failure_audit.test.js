import { test } from "node:test";
import assert from "node:assert";
import fs from "fs";
import {
  detectTableHeaderFromLines,
  normalizeCourseCode,
  parseScheduleFromWords,
  recognizeScheduleData,
  groupWordsIntoVisualLines,
  extractOcrFromImage,
} from "../lib/scheduleParser.ts";

test.describe("OCR Image Failure & Field Completeness Audit Suite", () => {
  test("1. Compound header 'Mata Kuliah & Kode' and 'Dosen Pengampu' are detected as unified columns", () => {
    // Simulated bounding boxes for header row:
    // Hari (x: 10..50), Waktu (x: 80..140), Mata Kuliah & Kode (x: 180..380), Dosen Pengampu (x: 420..560), Ruang (x: 600..660), SKS (x: 700..740)
    const headerWords = [
      { text: "Hari", bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
      { text: "Waktu", bbox: { x0: 80, y0: 10, x1: 140, y1: 30 } },
      { text: "Mata", bbox: { x0: 180, y0: 10, x1: 220, y1: 30 } },
      { text: "Kuliah", bbox: { x0: 225, y0: 10, x1: 280, y1: 30 } },
      { text: "&", bbox: { x0: 285, y0: 10, x1: 300, y1: 30 } },
      { text: "Kode", bbox: { x0: 305, y0: 10, x1: 350, y1: 30 } },
      { text: "Dosen", bbox: { x0: 420, y0: 10, x1: 480, y1: 30 } },
      { text: "Pengampu", bbox: { x0: 485, y0: 10, x1: 560, y1: 30 } },
      { text: "Ruang", bbox: { x0: 600, y0: 10, x1: 660, y1: 30 } },
      { text: "SKS", bbox: { x0: 700, y0: 10, x1: 740, y1: 30 } },
    ];

    const lines = groupWordsIntoVisualLines(headerWords);
    assert.strictEqual(lines.length, 1);

    const detected = detectTableHeaderFromLines(lines);
    assert.ok(detected, "Table header must be detected");
    const fields = detected.columns.map((c) => c.field);
    assert.deepStrictEqual(fields, ["hari", "waktuGabungan", "namaMatkul", "dosen", "lokasi", "sks"]);

    const namaMatkulCol = detected.columns.find((c) => c.field === "namaMatkul");
    assert.strictEqual(namaMatkulCol.label, "Mata Kuliah & Kode");

    const dosenCol = detected.columns.find((c) => c.field === "dosen");
    assert.strictEqual(dosenCol.label, "Dosen Pengampu");
  });

  test("2. normalizeCourseCode cleans leading/trailing quotes and punctuation", () => {
    const rawWithApostrophe = "'ARS-307";
    const res1 = normalizeCourseCode(rawWithApostrophe);
    assert.ok(res1, "Should normalize code with leading apostrophe");
    assert.strictEqual(res1.code, "ARS-307");

    const rawWithQuotes = '"MKU-104"';
    const res2 = normalizeCourseCode(rawWithQuotes);
    assert.ok(res2);
    assert.strictEqual(res2.code, "MKU-104");

    const rawWithBacktick = "`ARS-301`";
    const res3 = normalizeCourseCode(rawWithBacktick);
    assert.ok(res3);
    assert.strictEqual(res3.code, "ARS-301");
  });

  test("3. Table body extraction separates course code from compound column and preserves all fields", () => {
    const words = [
      // Header
      { text: "Hari", bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
      { text: "Waktu", bbox: { x0: 80, y0: 10, x1: 140, y1: 30 } },
      { text: "Mata", bbox: { x0: 180, y0: 10, x1: 220, y1: 30 } },
      { text: "Kuliah", bbox: { x0: 225, y0: 10, x1: 280, y1: 30 } },
      { text: "&", bbox: { x0: 285, y0: 10, x1: 300, y1: 30 } },
      { text: "Kode", bbox: { x0: 305, y0: 10, x1: 350, y1: 30 } },
      { text: "Dosen", bbox: { x0: 420, y0: 10, x1: 480, y1: 30 } },
      { text: "Pengampu", bbox: { x0: 485, y0: 10, x1: 560, y1: 30 } },
      { text: "Ruang", bbox: { x0: 600, y0: 10, x1: 660, y1: 30 } },
      { text: "SKS", bbox: { x0: 700, y0: 10, x1: 740, y1: 30 } },

      // Row 1: Senin, 08:00 - 10:30, Struktur Bangunan 2 ARS-301, Dr. Budi, R.G301, 3
      { text: "Senin", bbox: { x0: 10, y0: 50, x1: 60, y1: 70 } },
      { text: "08:00-10:30", bbox: { x0: 80, y0: 50, x1: 160, y1: 70 } },
      { text: "Struktur", bbox: { x0: 180, y0: 50, x1: 240, y1: 70 } },
      { text: "Bangunan", bbox: { x0: 245, y0: 50, x1: 310, y1: 70 } },
      { text: "2", bbox: { x0: 315, y0: 50, x1: 325, y1: 70 } },
      { text: "ARS-301", bbox: { x0: 180, y0: 75, x1: 250, y1: 95 } },
      { text: "Dr.", bbox: { x0: 420, y0: 50, x1: 445, y1: 70 } },
      { text: "Budi", bbox: { x0: 450, y0: 50, x1: 490, y1: 70 } },
      { text: "R.G301", bbox: { x0: 600, y0: 50, x1: 660, y1: 70 } },
      { text: "3", bbox: { x0: 710, y0: 50, x1: 725, y1: 70 } },

      // Row 2: Merged day (empty), 13:00 - 15:30, Sejarah Arsitektur 2 ARS-303, Dr. Dina, R.G302, 3
      { text: "13:00-15:30", bbox: { x0: 80, y0: 110, x1: 160, y1: 130 } },
      { text: "Sejarah", bbox: { x0: 180, y0: 110, x1: 240, y1: 130 } },
      { text: "Arsitektur", bbox: { x0: 245, y0: 110, x1: 320, y1: 130 } },
      { text: "2", bbox: { x0: 325, y0: 110, x1: 335, y1: 130 } },
      { text: "ARS-303", bbox: { x0: 180, y0: 135, x1: 250, y1: 155 } },
      { text: "Dr.", bbox: { x0: 420, y0: 110, x1: 445, y1: 130 } },
      { text: "Dina", bbox: { x0: 450, y0: 110, x1: 490, y1: 130 } },
      { text: "R.G302", bbox: { x0: 600, y0: 110, x1: 660, y1: 130 } },
      { text: "3", bbox: { x0: 710, y0: 110, x1: 725, y1: 130 } },
    ];

    const parsed = parseScheduleFromWords(words, [], []);
    assert.strictEqual(parsed.length, 2);

    assert.strictEqual(parsed[0].namaMatkul, "Struktur Bangunan 2");
    assert.strictEqual(parsed[0].kodeMatkul, "ARS-301");
    assert.strictEqual(parsed[0].hari, "Senin");
    assert.strictEqual(parsed[0].waktuMulai, "08:00");
    assert.strictEqual(parsed[0].waktuSelesai, "10:30");
    assert.strictEqual(parsed[0].lokasi, "R.G301");
    assert.strictEqual(parsed[0].sks, 3);
    assert.strictEqual(parsed[0].dosen, "Dr. Budi");

    assert.strictEqual(parsed[1].namaMatkul, "Sejarah Arsitektur 2");
    assert.strictEqual(parsed[1].kodeMatkul, "ARS-303");
    assert.strictEqual(parsed[1].hari, "Senin", "Second row must inherit Senin from merged cell");
    assert.strictEqual(parsed[1].waktuMulai, "13:00");
    assert.strictEqual(parsed[1].waktuSelesai, "15:30");
    assert.strictEqual(parsed[1].lokasi, "R.G302");
    assert.strictEqual(parsed[1].sks, 3);
  });

  test("4. Live concrete test on Screenshot 2026-10-22 155017.png when available", async () => {
    const defaultFixture = path.resolve("datasets/fixtures/schedule_table_fixture.png");
    const downloadPath = "C:/Users/Budy/Downloads/Screenshot 2026-10-22 155017.png";
    const imgPath = fs.existsSync(defaultFixture)
      ? defaultFixture
      : fs.existsSync(downloadPath)
      ? downloadPath
      : null;

    if (!imgPath) {
      console.log("Screenshot fixture not found, skipping live test");
      return;
    }

    const buf = fs.readFileSync(imgPath);
    const ocr = await extractOcrFromImage(buf);
    assert.ok(ocr.words.length > 50, "Must extract OCR words from image");

    const recog = recognizeScheduleData({ text: ocr.text, words: ocr.words }, [], []);
    assert.strictEqual(recog.items.length, 8, "Must extract exactly 8 courses");

    const expectedCodes = [
      "ARS-301",
      "ARS-303",
      "ARS-305",
      "ARS-307",
      "ARS-309",
      "ARS-311",
      "MKU-104",
      "ARS-313",
    ];
    const actualCodes = recog.items.map((it) => it.kodeMatkul);
    assert.deepStrictEqual(actualCodes, expectedCodes, "Course codes must match ground truth exactly");

    const expectedDays = [
      "Senin",
      "Senin",
      "Selasa",
      "Rabu",
      "Rabu",
      "Kamis",
      "Kamis",
      "Jumat",
    ];
    const actualDays = recog.items.map((it) => it.hari);
    assert.deepStrictEqual(actualDays, expectedDays, "Days must match ground truth exactly");

    const expectedRooms = [
      "R.G301",
      "R.G302",
      "Studio A",
      "R.G205",
      "R.G205",
      "Lab. Komputer",
      "R. MKU101",
      "R-6301",
    ];
    const actualRooms = recog.items.map((it) => it.lokasi);
    assert.deepStrictEqual(actualRooms, expectedRooms, "Rooms must match ground truth exactly");

    const totalSks = recog.items.reduce((sum, it) => sum + (it.sks || 0), 0);
    assert.strictEqual(totalSks, 24, "Total SKS must be exactly 24");
  });
});


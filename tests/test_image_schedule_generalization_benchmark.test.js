import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseScheduleFromWords,
  parseScheduleText,
  detectTableHeaderFromLines,
  detectMatrixGridHeaderFromLines,
  detectScheduleLayout,
  mergeVisionWithOcrSchedule,
  groupWordsIntoVisualLines,
} from "../lib/scheduleParser.ts";

describe("Image Schedule Parsing Generalization & Multi-Layout Benchmark Suite", () => {
  // Helper to create synthetic OCR words
  function makeWord(text, x0, y0, x1, y1, conf = 90) {
    return {
      text,
      confidence: conf,
      bbox: { x0, y0, x1, y1 },
    };
  }

  // =========================================================================
  // Benchmark 1: Multi-line / Stacked Headers
  // =========================================================================
  it("Benchmark 1: Detects stacked multi-line headers where sub-headers split columns", () => {
    // Row 0: Waktu (80..190), Mata Kuliah (200..380), Dosen (400..550), Ruang (580..650), SKS (680..720)
    // Row 1: Mulai (80..130), Selesai (135..190), & Kode (320..380), Pengampu (460..550)
    const headerWords = [
      makeWord("Waktu", 80, 10, 190, 25),
      makeWord("Mata", 200, 10, 245, 25),
      makeWord("Kuliah", 250, 10, 310, 25),
      makeWord("Dosen", 400, 10, 455, 25),
      makeWord("Ruang", 580, 10, 640, 25),
      makeWord("SKS", 680, 10, 720, 25),

      // Stacked Subheaders
      makeWord("Mulai", 80, 28, 130, 42),
      makeWord("Selesai", 135, 28, 190, 42),
      makeWord("&", 320, 28, 335, 42),
      makeWord("Kode", 340, 28, 380, 42),
      makeWord("Pengampu", 460, 28, 550, 42),
    ];

    const lines = groupWordsIntoVisualLines(headerWords);
    assert.strictEqual(lines.length, 2, "Must group words into 2 visual header lines");

    const detected = detectTableHeaderFromLines(lines);
    assert.ok(detected, "Must detect stacked table header");
    assert.strictEqual(detected.headerLineIndex, 1, "Header line index should be 1 (end of stacked header)");

    const fields = detected.columns.map((c) => c.field);
    assert.ok(fields.includes("waktuMulai"), "Must detect waktuMulai from subheader");
    assert.ok(fields.includes("waktuSelesai"), "Must detect waktuSelesai from subheader");
    assert.ok(fields.includes("namaMatkul"), "Must detect namaMatkul");
    assert.ok(fields.includes("dosen"), "Must detect dosen from stacked Dosen Pengampu");
    assert.ok(fields.includes("lokasi"), "Must detect lokasi");
    assert.ok(fields.includes("sks"), "Must detect sks");
  });

  // =========================================================================
  // Benchmark 2: Matrix / Grid Layout (Days as Columns, Time Slots as Rows)
  // =========================================================================
  it("Benchmark 2: Detects and extracts Matrix Grid Timetable with day columns", () => {
    const gridWords = [
      // Header: Jam, Senin, Selasa, Rabu, Kamis, Jumat
      makeWord("Jam", 20, 10, 80, 30),
      makeWord("Senin", 100, 10, 190, 30),
      makeWord("Selasa", 210, 10, 300, 30),
      makeWord("Rabu", 320, 10, 410, 30),
      makeWord("Kamis", 430, 10, 520, 30),
      makeWord("Jumat", 540, 10, 630, 30),

      // Slot 1: 08:00 - 09:40
      makeWord("08:00-09:40", 10, 50, 90, 70),
      // Under Senin: Algoritma Pemrograman IF-201 Lab RPL (3 SKS)
      makeWord("Algoritma", 105, 50, 185, 70),
      makeWord("Pemrograman", 105, 75, 190, 95),
      makeWord("IF-201", 105, 100, 155, 115),
      makeWord("Lab RPL", 110, 120, 165, 135),
      makeWord("(3 SKS)", 110, 140, 165, 155),
      // Under Rabu: Kalkulus II MAT-102 R.301
      makeWord("Kalkulus", 325, 50, 385, 70),
      makeWord("II", 390, 50, 405, 70),
      makeWord("MAT-102", 325, 75, 380, 95),
      makeWord("R.301", 325, 100, 365, 115),

      // Slot 2: 10:00 - 11:40
      makeWord("10:00-11:40", 10, 180, 90, 200),
      // Under Selasa: Struktur Data IF-202 Lab RPL
      makeWord("Struktur", 215, 180, 275, 200),
      makeWord("Data", 280, 180, 310, 200),
      makeWord("IF-202", 215, 205, 265, 225),
      makeWord("Lab RPL", 215, 230, 270, 245),
      // Under Kamis: Basis Data IF-203 R.205
      makeWord("Basis", 435, 180, 475, 200),
      makeWord("Data", 480, 180, 510, 200),
      makeWord("IF-203", 435, 205, 485, 225),
      makeWord("R.205", 435, 230, 475, 245),
    ];

    const lines = groupWordsIntoVisualLines(gridWords);
    const gridHeader = detectMatrixGridHeaderFromLines(lines);
    assert.ok(gridHeader, "Matrix grid header must be detected");
    assert.strictEqual(gridHeader.dayColumns.length, 5, "Must detect exactly 5 day columns");
    assert.deepStrictEqual(
      gridHeader.dayColumns.map((d) => d.day),
      ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
    );

    const items = parseScheduleFromWords(gridWords, [], []);
    assert.strictEqual(items.length, 4, "Must extract exactly 4 courses from matrix grid cells");

    // Course 1: Senin 08:00-09:40
    const seninCourse = items.find((it) => it.hari === "Senin");
    assert.ok(seninCourse, "Course on Senin must exist");
    assert.strictEqual(seninCourse.namaMatkul, "Algoritma Pemrograman");
    assert.strictEqual(seninCourse.kodeMatkul, "IF-201");
    assert.strictEqual(seninCourse.waktuMulai, "08:00");
    assert.strictEqual(seninCourse.waktuSelesai, "09:40");
    assert.strictEqual(seninCourse.sks, 3);
    assert.strictEqual(seninCourse.layoutKind, "matrix_grid_table");

    // Course 2: Rabu 08:00-09:40
    const rabuCourse = items.find((it) => it.hari === "Rabu");
    assert.ok(rabuCourse);
    assert.strictEqual(rabuCourse.namaMatkul, "Kalkulus II");
    assert.strictEqual(rabuCourse.kodeMatkul, "MAT-102");
    assert.strictEqual(rabuCourse.waktuMulai, "08:00");
    assert.strictEqual(rabuCourse.lokasi, "R.301");

    // Course 3: Selasa 10:00-11:40
    const selasaCourse = items.find((it) => it.hari === "Selasa");
    assert.ok(selasaCourse);
    assert.strictEqual(selasaCourse.namaMatkul, "Struktur Data");
    assert.strictEqual(selasaCourse.kodeMatkul, "IF-202");
    assert.strictEqual(selasaCourse.waktuMulai, "10:00");
    assert.strictEqual(selasaCourse.waktuSelesai, "11:40");

    // Course 4: Kamis 10:00-11:40
    const kamisCourse = items.find((it) => it.hari === "Kamis");
    assert.ok(kamisCourse);
    assert.strictEqual(kamisCourse.namaMatkul, "Basis Data");
    assert.strictEqual(kamisCourse.kodeMatkul, "IF-203");
    assert.strictEqual(kamisCourse.lokasi, "R.205");
  });

  // =========================================================================
  // Benchmark 3: Delimited Matrix Grid Layout
  // =========================================================================
  it("Benchmark 3: Parses pipe-delimited matrix grid tables cleanly", () => {
    const text = `
Waktu | Senin | Selasa | Rabu | Kamis | Jumat
08:00 - 09:40 | Algoritma (IF-201) Lab RPL (3 sks) | | Kalkulus II (MAT-102) R.301 | | 
10:00 - 11:40 | | Struktur Data (IF-202) Lab RPL | | Basis Data (IF-203) R.205 |
`;
    const layout = detectScheduleLayout({ text });
    assert.strictEqual(layout.kind, "matrix_grid_table");

    const items = parseScheduleText(text);
    assert.strictEqual(items.length, 4, "Must extract 4 courses from delimited matrix grid");

    assert.strictEqual(items[0].hari, "Senin");
    assert.strictEqual(items[0].waktuMulai, "08:00");
    assert.strictEqual(items[0].waktuSelesai, "09:40");
    assert.strictEqual(items[0].kodeMatkul, "IF-201");
    assert.strictEqual(items[0].sks, 3);

    assert.strictEqual(items[1].hari, "Rabu");
    assert.strictEqual(items[1].waktuMulai, "08:00");
    assert.strictEqual(items[1].waktuSelesai, "09:40");

    assert.strictEqual(items[2].hari, "Selasa");
    assert.strictEqual(items[2].waktuMulai, "10:00");
    assert.strictEqual(items[2].waktuSelesai, "11:40");

    assert.strictEqual(items[3].hari, "Kamis");
    assert.strictEqual(items[3].waktuMulai, "10:00");
    assert.strictEqual(items[3].waktuSelesai, "11:40");
  });

  // =========================================================================
  // Benchmark 4: Day-Grouped Timetable with Spatial Words
  // =========================================================================
  it("Benchmark 4: Inherits activeSectionDay when day names appear as subheader banners", () => {
    const dayWords = [
      // Subheader 1: SENIN
      makeWord("SENIN", 50, 10, 120, 30),
      makeWord("08:00-10:00", 50, 40, 130, 60),
      makeWord("Jaringan", 150, 40, 220, 60),
      makeWord("Komputer", 225, 40, 300, 60),
      makeWord("Lab 1", 350, 40, 400, 60),
      makeWord("3", 450, 40, 465, 60),

      makeWord("10:30-12:00", 50, 70, 130, 90),
      makeWord("Sistem", 150, 70, 200, 90),
      makeWord("Operasi", 205, 70, 260, 90),
      makeWord("R.202", 350, 70, 400, 90),
      makeWord("2", 450, 70, 465, 90),

      // Subheader 2: RABU
      makeWord("RABU", 50, 110, 110, 130),
      makeWord("13:00-15:30", 50, 140, 130, 160),
      makeWord("Kecerdasan", 150, 140, 240, 160),
      makeWord("Buatan", 245, 140, 300, 160),
      makeWord("R.301", 350, 140, 400, 160),
      makeWord("3", 450, 140, 465, 160),
    ];

    const items = parseScheduleFromWords(dayWords, [], []);
    assert.strictEqual(items.length, 3, "Must extract 3 courses from day-grouped spatial words");

    assert.strictEqual(items[0].namaMatkul, "Jaringan Komputer");
    assert.strictEqual(items[0].hari, "Senin");
    assert.strictEqual(items[0].waktuMulai, "08:00");
    assert.strictEqual(items[0].waktuSelesai, "10:00");

    assert.strictEqual(items[1].namaMatkul, "Sistem Operasi");
    assert.strictEqual(items[1].hari, "Senin");
    assert.strictEqual(items[1].waktuMulai, "10:30");
    assert.strictEqual(items[1].waktuSelesai, "12:00");

    assert.strictEqual(items[2].namaMatkul, "Kecerdasan Buatan");
    assert.strictEqual(items[2].hari, "Rabu");
    assert.strictEqual(items[2].waktuMulai, "13:00");
    assert.strictEqual(items[2].waktuSelesai, "15:30");
  });

  // =========================================================================
  // Benchmark 5: Hybrid Merge Vision Correction without Conflict Slop
  // =========================================================================
  it("Benchmark 5: Vision completion of partial local OCR records appliedCorrection instead of conflict warning", () => {
    const localItems = [
      {
        id: "loc_1",
        namaMatkul: "Struktur", // Degraded OCR fragment
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:30",
        lokasi: "R.G301",
        kodeMatkul: "ARS-301",
        sks: 3,
        dosen: null,
        kategori: "Wajib",
        needsReview: false,
        warnings: [],
      },
    ];

    const visionRows = [
      {
        namaMatkul: "Struktur Bangunan 2", // Clean vision recognition
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:30",
        lokasi: "R.G301",
        kodeMatkul: "ARS-301",
        sks: 3,
        confidenceEstimate: 95,
        fieldStatuses: {
          namaMatkul: "read",
          hari: "read",
          waktuMulai: "read",
          waktuSelesai: "read",
        },
      },
    ];

    const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].namaMatkul, "Struktur Bangunan 2");
    assert.strictEqual(merged[0].hari, "Senin");
    assert.strictEqual(merged[0].needsReview, false, "Must not flag review for clean vision completion");
    assert.strictEqual(merged[0].warnings.length, 0, "Must not create a false conflict warning");
    assert.ok(
      merged[0].appliedCorrections?.some((c) => c.includes("disempurnakan oleh Vision AI")),
      "Must record clear applied correction provenance"
    );
  });

  // =========================================================================
  // Benchmark 6: Zero False Defaults on Incomplete Data
  // =========================================================================
  it("Benchmark 6: Incomplete rows never hallucinate fake default days, times, or courses", () => {
    const incompleteWords = [
      makeWord("Hari", 10, 10, 50, 30),
      makeWord("Waktu", 80, 10, 140, 30),
      makeWord("Mata", 180, 10, 220, 30),
      makeWord("Kuliah", 225, 10, 270, 30),

      // Incomplete Row without Day and End Time: only has "08:00" and "Seminar Proposal"
      makeWord("08:00", 80, 50, 130, 70),
      makeWord("Seminar", 180, 50, 240, 70),
      makeWord("Proposal", 245, 50, 310, 70),
    ];

    const items = parseScheduleFromWords(incompleteWords, [], []);
    if (items.length > 0) {
      assert.notStrictEqual(items[0].hari, "Senin", "Must not invent fake day 'Senin'");
      assert.notStrictEqual(items[0].waktuSelesai, "10:00", "Must not invent fake end time");
    }
  });
});

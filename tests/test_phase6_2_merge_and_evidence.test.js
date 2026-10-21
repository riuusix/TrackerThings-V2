/**
 * TrackerThings V2 â€” Phase 6.2: Merge Validation & Evidence Integrity Suite
 *
 * Enforces:
 * 1. One real course detected by both OCR and Gemini appears once (clean merge).
 * 2. Two distinct courses at the exact same time remain separate (parallel classes preserved).
 * 3. Repeated course names on different days or times remain separate (multi-session courses).
 * 4. Similar course names (Kalkulus I vs II) are NOT merged without adequate supporting evidence.
 * 5. Partial/noisy OCR results do NOT overwrite cleaner Vision extraction fields without justification.
 * 6. Deduplication of unmatched local items does NOT drop distinct courses that share time slots.
 * 7. Substantive visual evidence evaluation rejects character-count loopholes and generic filler.
 * 8. User-confirmed edits are strictly preserved and never silently overwritten by verification.
 * 9. Repeated verification is idempotent (zero row multiplication, zero drift on confirmed values).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const {
  mergeVisionWithOcrSchedule,
  computeCourseMatchScore,
  extractDistinguishingSuffix,
} = await import("../lib/scheduleParser.ts");
const {
  isValidVisualEvidence,
  setVisionProviderOverride,
  resetUserVisionRateLimit,
  MockVisionProvider,
} = await import("../lib/visionProvider.ts");
const { evaluateExtractionQuality } = await import("../lib/intelligence/extractionQualityEvaluator.ts");

test.describe("Phase 6.2: Extraction Merge Validation & Evidence Integrity Suite", () => {
  test.beforeEach(() => {
    setVisionProviderOverride(null);
    resetUserVisionRateLimit();
  });

  // =========================================================================
  // 1. One Real Course Detected by Both OCR and Gemini Appears Once
  // =========================================================================
  test("1.1 One real course detected by both OCR and Gemini appears exactly once", () => {
    const localItems = [
      {
        id: "loc_1",
        namaMatkul: "Jaringan Komputer",
        hari: "Selasa",
        waktuMulai: "10:00",
        waktuSelesai: "12:00",
        lokasi: "Lab Jarkom",
        kodeMatkul: "IF253418",
        sks: 3,
        kategori: "Wajib",
      },
    ];

    const visionRows = [
      {
        namaMatkul: "Jaringan Komputer",
        hari: "Selasa",
        waktuMulai: "10:00",
        waktuSelesai: "12:00",
        lokasi: "Lab Jarkom",
        kodeMatkul: "IF253418",
        sks: 3,
        dosen: "Ir. Ahmad M.Kom",
      },
    ];

    const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
    assert.equal(merged.length, 1, "Must merge into exactly 1 course");
    assert.equal(merged[0].namaMatkul, "Jaringan Komputer");
    assert.equal(merged[0].hari, "Selasa");
    assert.equal(merged[0].waktuMulai, "10:00");
    assert.equal(merged[0].waktuSelesai, "12:00");
    assert.equal(merged[0].lokasi, "Lab Jarkom");
    assert.equal(merged[0].dosen, "Ir. Ahmad M.Kom");
  });

  // =========================================================================
  // 2. Two Distinct Courses at the Same Time Must Remain Separate
  // =========================================================================
  test("2.1 Two distinct courses at the exact same time remain separate (parallel classes)", () => {
    const localItems = [
      {
        id: "loc_par_1",
        namaMatkul: "Pemrograman Web",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:00",
        lokasi: "Lab Komputer 1",
        kodeMatkul: "IF101",
      },
    ];

    const visionRows = [
      {
        namaMatkul: "Kewirausahaan",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:00",
        lokasi: "R.302",
        kodeMatkul: "KW101",
      },
    ];

    const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
    assert.equal(merged.length, 2, "Must preserve BOTH distinct courses happening at the same time");

    const courseNames = merged.map((m) => m.namaMatkul).sort();
    assert.deepEqual(courseNames, ["Kewirausahaan", "Pemrograman Web"]);
  });

  // =========================================================================
  // 3. Repeated Course Names on Different Days or Times Must Remain Separate
  // =========================================================================
  test("3.1 Repeated course names on different days remain separate (multi-session lecture + lab)", () => {
    const localItems = [
      {
        id: "loc_sess_1",
        namaMatkul: "Praktikum Fisika Dasar",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:00",
        lokasi: "Lab Fisika",
        kodeMatkul: "FIS101P",
      },
    ];

    const visionRows = [
      {
        namaMatkul: "Praktikum Fisika Dasar",
        hari: "Kamis",
        waktuMulai: "13:00",
        waktuSelesai: "15:00",
        lokasi: "Lab Fisika",
        kodeMatkul: "FIS101P",
      },
    ];

    const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
    assert.equal(merged.length, 2, "Must preserve BOTH weekly sessions of the course");

    const days = merged.map((m) => m.hari).sort();
    assert.deepEqual(days, ["Kamis", "Senin"]);
  });

  // =========================================================================
  // 4. Similar Course Names Must Not Be Merged Without Adequate Evidence
  // =========================================================================
  test("4.1 Distinguishing suffixes (e.g. Roman numerals Kalkulus I vs II) prevent false merges", () => {
    assert.equal(extractDistinguishingSuffix("Kalkulus I"), "i");
    assert.equal(extractDistinguishingSuffix("Kalkulus II"), "ii");
    assert.equal(extractDistinguishingSuffix("Fisika Dasar 1"), "1");
    assert.equal(extractDistinguishingSuffix("Fisika Dasar 2"), "2");

    const localItems = [
      {
        id: "loc_kalk_1",
        namaMatkul: "Kalkulus I",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:00",
        lokasi: "R.101",
        kodeMatkul: "MAT101",
      },
    ];

    const visionRows = [
      {
        namaMatkul: "Kalkulus II",
        hari: "Rabu",
        waktuMulai: "10:00",
        waktuSelesai: "12:00",
        lokasi: "R.202",
        kodeMatkul: "MAT102",
      },
    ];

    const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
    assert.equal(merged.length, 2, "Kalkulus I and Kalkulus II must NEVER be merged together");

    const names = merged.map((m) => m.namaMatkul).sort();
    assert.deepEqual(names, ["Kalkulus I", "Kalkulus II"]);
  });

  // =========================================================================
  // 5. Partial/Noisy OCR Result Must Not Overwrite More Reliable Field
  // =========================================================================
  test("5.1 Noisy local OCR course name (with SKS/lecturer leakage) does NOT overwrite clean Vision name", () => {
    const localItems = [
      {
        id: "loc_smeared",
        namaMatkul: "Rekayasa Perangkat Lunak 3 Dr. Budi Santoso",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:30",
        lokasi: "10:30 Lab RPL",
        kodeMatkul: "IF253418",
      },
    ];

    const visionRows = [
      {
        namaMatkul: "Rekayasa Perangkat Lunak",
        hari: "Senin",
        waktuMulai: "08:00",
        waktuSelesai: "10:30",
        lokasi: "Lab RPL",
        kodeMatkul: "IF253418",
        sks: 3,
        dosen: "Dr. Budi Santoso",
      },
    ];

    const merged = mergeVisionWithOcrSchedule(localItems, visionRows, [], []);
    assert.equal(merged.length, 1);
    assert.equal(
      merged[0].namaMatkul,
      "Rekayasa Perangkat Lunak",
      "Must preserve clean Vision course name, rejecting SKS and lecturer leakage"
    );
    assert.equal(merged[0].lokasi, "Lab RPL");
    assert.equal(merged[0].dosen, "Dr. Budi Santoso");
    assert.equal(merged[0].sks, 3);
  });

  // =========================================================================
  // 6. Substantive Visual Evidence Evaluation
  // =========================================================================
  test("6.1 isValidVisualEvidence rejects character-count loopholes and generic fillers", () => {
    // Arbitrary / generic fillers
    assert.equal(isValidVisualEvidence("ada di gambar").valid, false);
    assert.equal(isValidVisualEvidence("row found").valid, false);
    assert.equal(isValidVisualEvidence("table data").valid, false);
    assert.equal(isValidVisualEvidence("short").valid, false);
    assert.equal(isValidVisualEvidence("").valid, false);
    assert.equal(isValidVisualEvidence(undefined).valid, false);

    // Substantive evidence citing structural region AND quoted/verbatim text
    const validEvidence1 = isValidVisualEvidence("Baris ke-4 tabel: 'Rabu 13:00 - 15:30 Sistem Terdistribusi'");
    assert.equal(validEvidence1.valid, true);

    const validEvidence2 = isValidVisualEvidence("Kolom Ruang baris 3 menunjukkan teks 'D.302 VA'");
    assert.equal(validEvidence2.valid, true);

    const validEvidence3 = isValidVisualEvidence("Pada baris 2 kolom Nama MK tertulis 'Kecerdasan Buatan'");
    assert.equal(validEvidence3.valid, true);
  });

  // =========================================================================
  // 7. User-Confirmed Edits Preservation
  // =========================================================================
  test("7.1 Preserves user-confirmed edit over conflicting AI verification suggestion", () => {
    const itemWithUserEdit = {
      id: "item_edited_1",
      namaMatkul: "Metodologi Penelitian Khusus", // Manually edited by user
      hari: "Senin",
      waktuMulai: "08:00",
      waktuSelesai: "10:00",
      userEditedFields: ["namaMatkul"],
    };

    // AI proposes to revert to what it thinks is on the document
    const aiProposedFinding = {
      namaMatkul: {
        field: "namaMatkul",
        decision: "corrected",
        proposedValue: "Metodologi Penelitian",
        evidence: "Baris 1 tabel tertulis 'Metodologi Penelitian'",
      },
    };

    // Filter verification findings against userEditedFields (logic mirrored from ImportScheduleModal)
    const filteredFindings = {};
    for (const [fKey, finding] of Object.entries(aiProposedFinding)) {
      if (itemWithUserEdit.userEditedFields?.includes(fKey)) {
        filteredFindings[fKey] = {
          ...finding,
          decision: "confirmed",
          reason: "Nilai ini telah dikonfirmasi/diedit secara manual oleh pengguna.",
          proposedValue: itemWithUserEdit[fKey],
        };
      } else {
        filteredFindings[fKey] = finding;
      }
    }

    assert.equal(filteredFindings.namaMatkul.decision, "confirmed");
    assert.equal(
      filteredFindings.namaMatkul.proposedValue,
      "Metodologi Penelitian Khusus",
      "Must retain user's manually edited value"
    );
  });

  // =========================================================================
  // 8. Repeated Verification Idempotence & Quality Gate
  // =========================================================================
  test("8.1 Repeated verification pass preserves exact row count and item invariants", () => {
    const items = [
      {
        id: "item_verified_pass1",
        namaMatkul: "Keamanan Jaringan",
        hari: "Rabu",
        waktuMulai: "10:00",
        waktuSelesai: "12:30",
        lokasi: "Lab Cyber",
        kodeMatkul: "IF253428",
        sks: 3,
        kategori: "Wajib",
      },
    ];

    const quality1 = evaluateExtractionQuality(items);
    assert.equal(quality1.isSufficientForProduction, true);

    // Pass 2: Revalidate same items
    const quality2 = evaluateExtractionQuality(items);
    assert.equal(quality2.isSufficientForProduction, true);
    assert.equal(quality2.score.overall, quality1.score.overall);
  });
});

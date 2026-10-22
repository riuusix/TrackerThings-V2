import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

register("./tests/loader.mjs", pathToFileURL("./"));

// Isolated in-memory Prisma mock for reliable CI execution without external PostgreSQL
const inMemorySystemSettings = new Map();

globalThis.prisma = {
  systemSetting: {
    findUnique: async ({ where }) => {
      const val = inMemorySystemSettings.get(where.settingKey);
      if (!val) return null;
      return { settingKey: where.settingKey, settingValue: val };
    },
    upsert: async ({ where, create, update }) => {
      const val = update.settingValue || create.settingValue;
      inMemorySystemSettings.set(where.settingKey, val);
      return { settingKey: where.settingKey, settingValue: val };
    },
    findMany: async ({ where }) => {
      const res = [];
      const prefix = where?.settingKey?.startsWith;
      for (const [k, v] of inMemorySystemSettings.entries()) {
        if (!prefix || k.startsWith(prefix)) {
          res.push({ settingKey: k, settingValue: v });
        }
      }
      return res;
    },
    delete: async ({ where }) => {
      inMemorySystemSettings.delete(where.settingKey);
      return {};
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      if (where?.settingKey) {
        if (typeof where.settingKey === "string") {
          if (inMemorySystemSettings.delete(where.settingKey)) count++;
        } else if (where.settingKey.startsWith) {
          for (const k of Array.from(inMemorySystemSettings.keys())) {
            if (k.startsWith(where.settingKey.startsWith)) {
              inMemorySystemSettings.delete(k);
              count++;
            }
          }
        }
      }
      return { count };
    },
  },
  jadwal: {
    createMany: async ({ data }) => ({ count: data.length }),
    findMany: async () => [],
  },
  $transaction: async (fn) => {
    if (typeof fn === "function") return fn(globalThis.prisma);
    return Promise.all(fn);
  },
};

const {
  recognizeScheduleData,
  parseScheduleText,
  detectScheduleLayout,
  normalizeHari,
  normalizeTime,
} = await import("../lib/scheduleParser.ts");

const {
  createScheduleDraft,
  getScheduleDraft,
  listScheduleDrafts,
  updateScheduleDraft,
  commitScheduleDraft,
  discardScheduleDraft,
} = await import("../lib/scheduleDraftStore.ts");

describe("Centralized Schedule Import & Layout Generalization Benchmark Suite", () => {
  describe("Phase 3: Diverse Academic Timetable Layout Generalization", () => {
    test("Layout 1 (Regression): Standard UNAS/SIAKAD 8-Column Layout", () => {
      const text = `
Hari | Jam Mulai | Jam Akhir | Ruang | Kode MK | Kls | Nama Mata Kuliah | SKS
Senin | 08:00 | 09:40 | R.301 | IF2110 | A | Algoritma dan Pemrograman | 3
Selasa | 10:00 | 11:40 | Lab. 2 | IF2120 | B | Struktur Data | 3
`;
      const result = parseScheduleText(text);
      assert.strictEqual(result.length, 2, "Harus mengekstrak 2 mata kuliah");

      assert.strictEqual(result[0].namaMatkul, "Algoritma dan Pemrograman");
      assert.strictEqual(result[0].hari, "Senin");
      assert.strictEqual(result[0].waktuMulai, "08:00");
      assert.strictEqual(result[0].waktuSelesai, "09:40");
      assert.strictEqual(result[0].lokasi, "R.301");
      assert.strictEqual(result[0].kodeMatkul, "IF2110");
      assert.strictEqual(result[0].sks, 3);

      assert.strictEqual(result[1].namaMatkul, "Struktur Data");
      assert.strictEqual(result[1].hari, "Selasa");
      assert.strictEqual(result[1].waktuMulai, "10:00");
      assert.strictEqual(result[1].waktuSelesai, "11:40");
      assert.strictEqual(result[1].lokasi, "Lab. 2");
      assert.strictEqual(result[1].sks, 3);
    });

    test("Layout 2: ITB/Standard University Layout with Code First", () => {
      const text = `
No   Kode MK   Nama Mata Kuliah              SKS   Hari    Waktu           Ruang
1    IF2110    Matematika Diskrit             3     Senin   07:00 - 09:00   7602
2    IF2120    Organisasi Komputer            3     Rabu    09:00 - 11:00   7601
`;
      const recognition = recognizeScheduleData({ text });
      const items = recognition.items;

      assert.strictEqual(items.length, 2, "Harus mengekstrak 2 mata kuliah dengan urutan Kode MK pertama");
      assert.strictEqual(items[0].namaMatkul, "Matematika Diskrit");
      assert.strictEqual(items[0].kodeMatkul, "IF2110");
      assert.strictEqual(items[0].hari, "Senin");
      assert.strictEqual(items[0].waktuMulai, "07:00");
      assert.strictEqual(items[0].waktuSelesai, "09:00");
      assert.strictEqual(items[0].lokasi, "7602");
      assert.strictEqual(items[0].sks, 3);

      assert.strictEqual(items[1].namaMatkul, "Organisasi Komputer");
      assert.strictEqual(items[1].kodeMatkul, "IF2120");
      assert.strictEqual(items[1].hari, "Rabu");
      assert.strictEqual(items[1].waktuMulai, "09:00");
      assert.strictEqual(items[1].waktuSelesai, "11:00");
      assert.strictEqual(items[1].lokasi, "7601");
      assert.strictEqual(items[1].sks, 3);
    });

    test("Layout 3: UI/Course Name First Layout", () => {
      const text = `
Mata Kuliah                    SKS   Hari     Waktu           Ruang
Basis Data Lanjut               3     Selasa   13:00 - 15:30   Lab Komputer 3
Interaksi Manusia dan Komputer  3     Kamis    08:00 - 10:30   Ruang R.204
`;
      const result = parseScheduleText(text);
      assert.strictEqual(result.length, 2, "Harus mengekstrak 2 mata kuliah dengan nama mata kuliah pertama");

      assert.strictEqual(result[0].namaMatkul, "Basis Data Lanjut");
      assert.strictEqual(result[0].hari, "Selasa");
      assert.strictEqual(result[0].waktuMulai, "13:00");
      assert.strictEqual(result[0].waktuSelesai, "15:30");
      assert.strictEqual(result[0].lokasi, "Lab Komputer 3");
      assert.strictEqual(result[0].sks, 3);

      assert.strictEqual(result[1].namaMatkul, "Interaksi Manusia dan Komputer");
      assert.strictEqual(result[1].hari, "Kamis");
      assert.strictEqual(result[1].waktuMulai, "08:00");
      assert.strictEqual(result[1].waktuSelesai, "10:30");
      assert.strictEqual(result[1].lokasi, "Ruang R.204");
      assert.strictEqual(result[1].sks, 3);
    });

    test("Layout 4: Day-Grouped Timetable (Subheaders per Day)", () => {
      const text = `
SENIN
08:00 - 10:00   Jaringan Komputer    Lab 1   3 SKS
10:30 - 12:00   Sistem Operasi       R.202   2 SKS

RABU
13:00 - 15:30   Kecerdasan Buatan    R.301   3 SKS
`;
      const result = parseScheduleText(text);
      assert.strictEqual(result.length, 3, "Harus mengekstrak 3 baris dari seksi hari berulang");

      assert.strictEqual(result[0].namaMatkul, "Jaringan Komputer");
      assert.strictEqual(result[0].hari, "Senin", "Baris 1 harus mewarisi hari Senin");
      assert.strictEqual(result[0].waktuMulai, "08:00");
      assert.strictEqual(result[0].waktuSelesai, "10:00");
      assert.strictEqual(result[0].lokasi, "Lab 1");
      assert.strictEqual(result[0].sks, 3);

      assert.strictEqual(result[1].namaMatkul, "Sistem Operasi");
      assert.strictEqual(result[1].hari, "Senin", "Baris 2 harus mewarisi hari Senin");
      assert.strictEqual(result[1].waktuMulai, "10:30");
      assert.strictEqual(result[1].waktuSelesai, "12:00");

      assert.strictEqual(result[2].namaMatkul, "Kecerdasan Buatan");
      assert.strictEqual(result[2].hari, "Rabu", "Baris 3 harus mewarisi hari Rabu");
      assert.strictEqual(result[2].waktuMulai, "13:00");
      assert.strictEqual(result[2].waktuSelesai, "15:30");
      assert.strictEqual(result[2].lokasi, "R.301");
      assert.strictEqual(result[2].sks, 3);
    });

    test("Layout 5: Space-Separated Split Start and End Time Columns Without Hyphen", () => {
      const text = `
Senin  08:00  09:40  R.301  IF101  Algoritma  3
Jumat  13:30  15:10  Lab.1  IF202  Pemrograman  2
`;
      const result = parseScheduleText(text);
      assert.strictEqual(result.length, 2, "Harus mengekstrak jam mulai dan selesai tanpa tanda minus");
      assert.strictEqual(result[0].waktuMulai, "08:00");
      assert.strictEqual(result[0].waktuSelesai, "09:40");
      assert.strictEqual(result[0].hari, "Senin");

      assert.strictEqual(result[1].waktuMulai, "13:30");
      assert.strictEqual(result[1].waktuSelesai, "15:10");
      assert.strictEqual(result[1].hari, "Jumat");
    });

    test("Layout 6: Multi-line Wrapped Course Names", () => {
      const text = `
Hari | Waktu | Kode MK | Mata Kuliah | SKS
Senin | 08:00 - 10:00 | CS301 | Rekayasa Perangkat
Lunak Lanjut | 3
Rabu | 10:00 - 12:00 | CS302 | Pemrograman Web | 3
`;
      const result = parseScheduleText(text);
      assert.strictEqual(result.length, 2, "Harus menggabungkan baris lanjutan nama mata kuliah");
      assert.strictEqual(result[0].namaMatkul, "Rekayasa Perangkat Lunak Lanjut");
      assert.strictEqual(result[0].kodeMatkul, "CS301");
      assert.strictEqual(result[0].hari, "Senin");
      assert.strictEqual(result[0].waktuMulai, "08:00");
      assert.strictEqual(result[0].waktuSelesai, "10:00");
    });

    test("Integrity: Missing Fields are Preserved as Empty Without Fake Defaults", () => {
      const text = `
1. Kuliah Tamu Kewirausahaan
Ruang Auditorium 2 SKS
`;
      const result = parseScheduleText(text);
      if (result.length > 0) {
        assert.notStrictEqual(result[0].hari, "Senin", "Dilarang menginjeksi default palsu 'Senin' jika tidak ada hari di dokumen!");
        assert.notStrictEqual(result[0].waktuMulai, "08:00", "Dilarang menginjeksi default palsu '08:00' jika jam tidak ada di dokumen!");
        assert.strictEqual(result[0].needsReview, true, "Item dengan field hilang wajib ditandai needsReview = true");
      }
    });
  });

  describe("Phase 4: Shared Server-Managed Preview Draft Lifecycle", () => {
    const testUserId = 99998;
    let createdDraftId = "";

    test("1. Create User-Owned Schedule Draft", async () => {
      const draft = await createScheduleDraft({
        userId: testUserId,
        fileName: "jadwal_test_semester.pdf",
        mimeType: "application/pdf",
        items: [
          {
            id: "it_1",
            namaMatkul: "Pemrograman Web Lanjut",
            hari: "Senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            lokasi: "Lab 3",
            sks: 3,
            kategori: "Wajib",
            needsReview: false,
          },
          {
            id: "it_2",
            namaMatkul: "Keamanan Siber",
            hari: "Kamis",
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            lokasi: "R.401",
            sks: 3,
            kategori: "Wajib",
            needsReview: false,
          },
        ],
        warnings: [],
        sourceFileBase64: Buffer.from("dummy_pdf_content").toString("base64"),
        engineUsed: "typescript_parser",
      });

      assert.ok(draft.id.startsWith("draft_"), "Draft ID harus berformat draft_...");
      assert.strictEqual(draft.userId, testUserId);
      assert.strictEqual(draft.version, 1);
      assert.strictEqual(draft.status, "ready");
      assert.strictEqual(draft.items.length, 2);

      createdDraftId = draft.id;
    });

    test("2. Retrieve Draft and Verify Ownership Protection", async () => {
      assert.ok(createdDraftId, "Harus memiliki draftId yang valid");

      // Valid owner
      const draft = await getScheduleDraft(testUserId, createdDraftId);
      assert.ok(draft !== null);
      assert.strictEqual(draft?.id, createdDraftId);
      assert.strictEqual(draft?.items.length, 2);

      // Wrong user cannot access draft
      const otherUserDraft = await getScheduleDraft(77777, createdDraftId);
      assert.strictEqual(otherUserDraft, null, "User lain tidak boleh dapat mengakses draf milik user ini!");
    });

    test("3. List Drafts for User", async () => {
      const drafts = await listScheduleDrafts(testUserId);
      assert.ok(Array.isArray(drafts));
      assert.ok(drafts.some((d) => d.id === createdDraftId));
    });

    test("4. Update Draft with Optimistic Concurrency Control", async () => {
      // Modify items with correct expectedVersion = 1
      const updated = await updateScheduleDraft({
        userId: testUserId,
        draftId: createdDraftId,
        items: [
          {
            id: "it_1",
            namaMatkul: "Pemrograman Web Lanjut (Edited)",
            hari: "Senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            lokasi: "Lab 3",
            sks: 3,
            kategori: "Wajib",
            needsReview: false,
          },
        ],
        expectedVersion: 1,
      });

      assert.strictEqual(updated.version, 2, "Versi draf harus naik menjadi 2");
      assert.strictEqual(updated.items[0].namaMatkul, "Pemrograman Web Lanjut (Edited)");

      // Attempt update with stale version = 1 -> must throw conflict error
      await assert.rejects(
        async () => {
          await updateScheduleDraft({
            userId: testUserId,
            draftId: createdDraftId,
            items: [],
            expectedVersion: 1, // Stale!
          });
        },
        (err) => {
          assert.strictEqual(err.code, "CONCURRENT_MODIFICATION");
          return true;
        },
        "Harus menolak update dengan versi kedaluwarsa (HTTP 409 conflict)"
      );
    });

    test("5. Discard Draft Cleanup", async () => {
      const discarded = await discardScheduleDraft(testUserId, createdDraftId);
      assert.strictEqual(discarded, true);

      const check = await getScheduleDraft(testUserId, createdDraftId);
      assert.strictEqual(check, null, "Draf yang dihapus tidak boleh dapat diakses lagi");
    });
  });
});

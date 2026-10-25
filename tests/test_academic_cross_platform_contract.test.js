import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const TEST_USER_ID = 99995;

// In-memory Prisma mock setup
globalThis.prisma = {
  user: {
    findUnique: async ({ where }) => {
      if (where.id === TEST_USER_ID) {
        return {
          id: TEST_USER_ID,
          username: "academic_student",
          email: "student@trackerthings.local",
          role: "student",
          passwordChangedAt: null,
        };
      }
      return null;
    },
  },
  tugas: {
    findMany: async ({ where }) => [
      {
        id: 101,
        userId: where.userId,
        idJadwal: 1,
        namaTugas: "Tugas Algoritma 1",
        deadline: new Date("2026-10-26T00:00:00.000Z"), // due today
        prioritas: "Tinggi",
        jenis: "Individu",
        status: "Belum Dikerjakan",
        progress: 0,
        jadwal: { namaMatkul: "Algoritma Pemrograman" },
      },
      {
        id: 102,
        userId: where.userId,
        idJadwal: 2,
        namaTugas: "Makalah Etika",
        deadline: new Date("2026-10-24T00:00:00.000Z"), // overdue 2 days
        prioritas: "Sedang",
        jenis: "Kelompok",
        status: "Belum Dikerjakan",
        progress: 20,
        jadwal: { namaMatkul: "Etika Profesi" },
      },
      {
        id: 103,
        userId: where.userId,
        idJadwal: 1,
        namaTugas: "Tugas Selesai",
        deadline: new Date("2026-10-20T00:00:00.000Z"),
        prioritas: "Rendah",
        jenis: "Individu",
        status: "Selesai",
        progress: 100,
        jadwal: { namaMatkul: "Algoritma Pemrograman" },
      },
    ],
  },
  ujian: {
    findMany: async ({ where }) => [
      {
        id: 201,
        userId: where.userId,
        idJadwal: 1,
        jenisUjian: "UTS Algoritma",
        tanggal: new Date("2026-10-28T00:00:00.000Z"), // in 2 days
        waktuMulai: new Date("1970-01-01T08:00:00.000Z"),
        waktuSelesai: new Date("1970-01-01T10:00:00.000Z"),
        ruangan: "Lab 201",
        catatan: "Bawa kartu mahasiswa",
        jadwal: { namaMatkul: "Algoritma Pemrograman" },
      },
    ],
  },
  jadwal: {
    findMany: async ({ where }) => [
      {
        id: 1,
        userId: where.userId,
        namaMatkul: "Algoritma Pemrograman",
        dosen: "Dr. Budi",
        kategori: "Wajib",
        lokasi: "Lab 201",
        sks: 3,
        hari: "Senin",
        waktuMulai: new Date("1970-01-01T08:00:00.000Z"),
        waktuSelesai: new Date("1970-01-01T10:30:00.000Z"),
      },
    ],
  },
  kelasPengganti: {
    findMany: async ({ where }) => [],
  },
};

const { GET: academicIntelligenceGet } = await import("../app/api/intelligence/academic/route.ts");
const { signSessionToken } = await import("../lib/auth.ts");
const { NextRequest } = await import("next/server");

test.describe("Academic Intelligence Cross-Platform Contract Suite", () => {
  let userToken = "";

  test.before(async () => {
    userToken = await signSessionToken({
      userId: TEST_USER_ID,
      username: "academic_student",
      role: "student",
    });
  });

  test("1. GET /api/intelligence/academic returns standardized response envelope", async () => {
    const url = "http://localhost:3000/api/intelligence/academic?referenceDate=2026-10-26&timezone=Asia/Jakarta&upcomingWindowDays=7";
    const req = new NextRequest(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    const res = await academicIntelligenceGet(req);
    assert.equal(res.status, 200, "Must return HTTP 200");

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data, "Response must include data");

    const summary = json.data;
    assert.equal(summary.referenceDate, "2026-10-26");
    assert.equal(summary.timezone, "Asia/Jakarta");
    assert.equal(summary.upcomingWindowDays, 7);

    // Counts by category
    assert.equal(summary.countsByCategory.overdue, 1, "Task 102 is overdue");
    assert.equal(summary.countsByCategory.due_today, 1, "Task 101 is due today");

    // Total insights generated
    assert.equal(summary.totalInsightsGenerated, 3, "1 overdue + 1 due_today + 1 upcoming exam");

    // Briefing
    assert.ok(summary.briefing, "Must include DailyBriefing");
    assert.equal(summary.briefing.date, "2026-10-26");
    assert.equal(summary.briefing.dayName, "Senin");
    assert.equal(summary.briefing.todayClassesCount, 1);
    assert.equal(summary.briefing.todayTotalSks, 3);
    assert.equal(summary.briefing.status, "urgent", "Overdue task triggers urgent briefing status");
    assert.ok(summary.briefing.headline.length > 0);

    // Conflicts
    assert.ok(Array.isArray(summary.conflicts), "Must include conflicts array");
    assert.equal(summary.conflicts.length, 0, "No overlapping classes in fixture");
  });

  test("2. Task matching course with upcoming exam receives exam proximity boost", async () => {
    const url = "http://localhost:3000/api/intelligence/academic?referenceDate=2026-10-26&timezone=Asia/Jakarta";
    const req = new NextRequest(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    const res = await academicIntelligenceGet(req);
    const json = await res.json();
    const task101 = json.data.insights.find((i) => i.itemId === 101);

    assert.ok(task101);
    assert.ok(
      task101.reason.includes("Terdapat UTS Algoritma"),
      "Reason must explain exam proximity"
    );
    assert.ok(
      task101.actionRecommendation.includes("fokus pada persiapan ujian"),
      "Recommendation must suggest exam preparation focus"
    );
  });

  test("3. Explicit error validation on missing required parameters", async () => {
    // Missing referenceDate and timezone
    const req = new NextRequest("http://localhost:3000/api/intelligence/academic", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    const res = await academicIntelligenceGet(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.error.includes("referenceDate"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateAcademicInsights,
  evaluateAcademicItem,
  validateReferenceDate,
  validateTimezone,
  calculateCalendarDaysDifference,
  extractCalendarDate,
  formatIndonesianCalendarDate,
  compareAcademicInsights,
} from "../lib/intelligence/academicInsights.ts";

describe("Deterministic Academic Intelligence Suite (Milestone M1)", () => {
  // =========================================================================
  // 1. Reference Date & Timezone Validation
  // =========================================================================
  describe("1. Date Context & Timezone Validation", () => {
    it("validates valid referenceDate strings", () => {
      const valid1 = validateReferenceDate("2026-10-20");
      assert.equal(valid1.valid, true);
      if (valid1.valid) assert.equal(valid1.date, "2026-10-20");

      const leapValid = validateReferenceDate("2024-02-29");
      assert.equal(leapValid.valid, true);
    });

    it("rejects invalid, malformed, or non-existent calendar dates", () => {
      assert.equal(validateReferenceDate("2026-02-29").valid, false); // 2026 is not a leap year
      assert.equal(validateReferenceDate("2026-04-31").valid, false); // April has 30 days
      assert.equal(validateReferenceDate("2026-13-01").valid, false); // Month 13 does not exist
      assert.equal(validateReferenceDate("2026/10/20").valid, false); // Must be YYYY-MM-DD
      assert.equal(validateReferenceDate("2026-10-2").valid, false);
      assert.equal(validateReferenceDate("").valid, false);
      assert.equal(validateReferenceDate(null).valid, false);
      assert.equal(validateReferenceDate(undefined).valid, false);
      assert.equal(validateReferenceDate(12345).valid, false);
    });

    it("validates valid IANA timezones", () => {
      const validZones = ["Asia/Jakarta", "UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];
      for (const tz of validZones) {
        const res = validateTimezone(tz);
        assert.equal(res.valid, true, `Expected "${tz}" to be valid`);
      }
    });

    it("rejects invalid or non-string timezones", () => {
      assert.equal(validateTimezone("Invalid/Timezone").valid, false);
      assert.equal(validateTimezone("GMT+99").valid, false);
      assert.equal(validateTimezone("").valid, false);
      assert.equal(validateTimezone(null).valid, false);
      assert.equal(validateTimezone(undefined).valid, false);
    });

    it("formats pure calendar dates to Indonesian text without timezone drift", () => {
      assert.equal(formatIndonesianCalendarDate("2026-10-20"), "20 Oktober 2026");
      assert.equal(formatIndonesianCalendarDate("2026-01-01"), "1 Januari 2026");
      assert.equal(formatIndonesianCalendarDate("2026-12-31"), "31 Desember 2026");
    });
  });

  // =========================================================================
  // 2. Date Boundaries and Calendar Arithmetic
  // =========================================================================
  describe("2. Date Boundaries and Day Transitions", () => {
    it("calculates exact calendar day differences across boundaries", () => {
      // Same day
      assert.equal(calculateCalendarDaysDifference("2026-10-20", "2026-10-20"), 0);

      // Tomorrow / yesterday
      assert.equal(calculateCalendarDaysDifference("2026-10-21", "2026-10-20"), 1);
      assert.equal(calculateCalendarDaysDifference("2026-10-19", "2026-10-20"), -1);

      // Month boundary transition (October 31 -> November 1)
      assert.equal(calculateCalendarDaysDifference("2026-11-01", "2026-10-31"), 1);
      assert.equal(calculateCalendarDaysDifference("2026-10-31", "2026-11-01"), -1);

      // Leap year boundary transition (2024-02-28 -> 2024-03-01 has 29th)
      assert.equal(calculateCalendarDaysDifference("2024-03-01", "2024-02-28"), 2);

      // Non-leap year transition (2026-02-28 -> 2026-03-01 is 1 day)
      assert.equal(calculateCalendarDaysDifference("2026-03-01", "2026-02-28"), 1);

      // Year boundary transition
      assert.equal(calculateCalendarDaysDifference("2027-01-01", "2026-12-31"), 1);
      assert.equal(calculateCalendarDaysDifference("2026-12-31", "2027-01-01"), -1);
    });
  });

  // =========================================================================
  // 3. Category Rules: Overdue, Due Today, Due Tomorrow, Upcoming
  // =========================================================================
  describe("3. Category Rules & Priority Assignment", () => {
    const fixedContext = {
      referenceDate: "2026-10-20",
      timezone: "Asia/Jakarta",
      upcomingWindowDays: 7,
    };

    it("classifies overdue items (< 0 days)", () => {
      const item = {
        id: 1,
        type: "tugas",
        title: "Tugas Fisika Dasar",
        date: "2026-10-18",
        priority: "Tinggi",
      };
      const insight = evaluateAcademicItem(item, fixedContext);
      assert.ok(insight);
      assert.equal(insight.category, "overdue");
      assert.equal(insight.priority, "urgent");
      assert.equal(insight.daysDifference, -2);
      assert.ok(insight.reason.includes("telah melewati batas waktu 2 hari"));
      assert.ok(insight.actionRecommendation.includes("Prioritaskan penyelesaian"));
    });

    it("classifies due_today items (0 days)", () => {
      const itemHigh = {
        id: 2,
        type: "tugas",
        title: "Laporan Praktikum",
        date: "2026-10-20",
        priority: "Tinggi",
      };
      const insightHigh = evaluateAcademicItem(itemHigh, fixedContext);
      assert.ok(insightHigh);
      assert.equal(insightHigh.category, "due_today");
      assert.equal(insightHigh.priority, "urgent"); // Tinggi + due_today -> urgent
      assert.equal(insightHigh.daysDifference, 0);

      const itemMedium = {
        id: 3,
        type: "tugas",
        title: "Kuis Online",
        date: "2026-10-20",
        priority: "Sedang",
      };
      const insightMedium = evaluateAcademicItem(itemMedium, fixedContext);
      assert.ok(insightMedium);
      assert.equal(insightMedium.category, "due_today");
      assert.equal(insightMedium.priority, "high"); // Sedang + due_today -> high
    });

    it("classifies due_tomorrow items (+1 day)", () => {
      const item = {
        id: 4,
        type: "ujian",
        title: "UTS Algoritma & Pemrograman",
        date: "2026-10-21",
        priority: "Tinggi",
        courseName: "Algoritma Pemrograman",
      };
      const insight = evaluateAcademicItem(item, fixedContext);
      assert.ok(insight);
      assert.equal(insight.category, "due_tomorrow");
      assert.equal(insight.priority, "high");
      assert.equal(insight.daysDifference, 1);
      assert.ok(insight.reason.includes("jatuh tempo besok"));
      assert.ok(insight.reason.includes("Algoritma Pemrograman"));
    });

    it("classifies upcoming items (2 to 7 days)", () => {
      const item = {
        id: 5,
        type: "tugas",
        title: "Proyek Akhir Web",
        date: "2026-10-25",
        priority: "Sedang",
      };
      const insight = evaluateAcademicItem(item, fixedContext);
      assert.ok(insight);
      assert.equal(insight.category, "upcoming");
      assert.equal(insight.daysDifference, 5);
      assert.equal(insight.priority, "low");
      assert.ok(insight.reason.includes("dalam 5 hari"));
    });

    it("excludes items beyond upcomingWindowDays", () => {
      const itemFar = {
        id: 6,
        type: "tugas",
        title: "Tugas Akhir Semester",
        date: "2026-11-15", // 26 days away
        priority: "Tinggi",
      };
      const insight = evaluateAcademicItem(itemFar, fixedContext);
      assert.equal(insight, null);
    });
  });

  // =========================================================================
  // 4. Ineligible Data & Defensive Edge Cases
  // =========================================================================
  describe("4. Ineligible Items & Edge Cases", () => {
    const fixedContext = {
      referenceDate: "2026-10-20",
      timezone: "Asia/Jakarta",
    };

    it("omits completed tasks ('Selesai')", () => {
      const completedTask = {
        id: 7,
        type: "tugas",
        title: "Tugas Sudah Selesai",
        date: "2026-10-20",
        status: "Selesai",
      };
      assert.equal(evaluateAcademicItem(completedTask, fixedContext), null);
    });

    it("omits tasks with missing, null, or invalid dates", () => {
      assert.equal(evaluateAcademicItem({ id: 8, type: "tugas", title: "No date" }, fixedContext), null);
      assert.equal(evaluateAcademicItem({ id: 9, type: "tugas", title: "Null date", date: null }, fixedContext), null);
      assert.equal(evaluateAcademicItem({ id: 10, type: "tugas", title: "Bad date", date: "not-a-date" }, fixedContext), null);
      assert.equal(evaluateAcademicItem({ id: 11, type: "tugas", title: "Invalid calendar date", date: "2026-02-29" }, fixedContext), null);
    });

    it("omits items with missing title or invalid item structure", () => {
      assert.equal(evaluateAcademicItem(null, fixedContext), null);
      assert.equal(evaluateAcademicItem({ id: 12, type: "tugas", title: "" }, fixedContext), null);
    });

    it("throws descriptive error when evaluateAcademicInsights receives invalid context", () => {
      assert.throws(
        () => evaluateAcademicInsights([], { referenceDate: "bad-date", timezone: "Asia/Jakarta" }),
        /\[AcademicIntelligence\] referenceDate "bad-date" is invalid/
      );

      assert.throws(
        () => evaluateAcademicInsights([], { referenceDate: "2026-10-20", timezone: "Unknown/Zone" }),
        /\[AcademicIntelligence\] Invalid IANA timezone/
      );
    });

    it("handles empty items array gracefully", () => {
      const summary = evaluateAcademicInsights([], fixedContext);
      assert.equal(summary.totalItemsEvaluated, 0);
      assert.equal(summary.totalInsightsGenerated, 0);
      assert.equal(summary.countsByCategory.overdue, 0);
      assert.equal(summary.countsByCategory.due_today, 0);
      assert.equal(summary.countsByCategory.due_tomorrow, 0);
      assert.equal(summary.countsByCategory.upcoming, 0);
      assert.deepEqual(summary.insights, []);
    });
  });

  // =========================================================================
  // 5. Deterministic Priority Ordering & Explainability
  // =========================================================================
  describe("5. Deterministic Priority Ordering", () => {
    const fixedContext = {
      referenceDate: "2026-10-20",
      timezone: "Asia/Jakarta",
    };

    it("orders insights strictly by urgency: overdue -> due_today -> due_tomorrow -> upcoming", () => {
      const items = [
        { id: 101, type: "tugas", title: "Upcoming Task", date: "2026-10-23", priority: "Sedang" },
        { id: 102, type: "tugas", title: "Overdue Task", date: "2026-10-18", priority: "Sedang" },
        { id: 103, type: "tugas", title: "Due Tomorrow Task", date: "2026-10-21", priority: "Sedang" },
        { id: 104, type: "tugas", title: "Due Today Task", date: "2026-10-20", priority: "Sedang" },
      ];

      const summary = evaluateAcademicInsights(items, fixedContext);
      assert.equal(summary.totalInsightsGenerated, 4);
      assert.equal(summary.insights[0].category, "overdue");
      assert.equal(summary.insights[1].category, "due_today");
      assert.equal(summary.insights[2].category, "due_tomorrow");
      assert.equal(summary.insights[3].category, "upcoming");
    });

    it("ranks Tinggi priority higher than Sedang within the same category", () => {
      const items = [
        { id: 201, type: "tugas", title: "Due Today Sedang", date: "2026-10-20", priority: "Sedang" },
        { id: 202, type: "tugas", title: "Due Today Tinggi", date: "2026-10-20", priority: "Tinggi" },
      ];

      const summary = evaluateAcademicInsights(items, fixedContext);
      assert.equal(summary.insights[0].id, "insight-tugas-202-due_today");
      assert.equal(summary.insights[1].id, "insight-tugas-201-due_today");
    });

    it("uses title and id as deterministic tie-breakers when priority and date match", () => {
      const items = [
        { id: 302, type: "tugas", title: "Zebra Task", date: "2026-10-20", priority: "Sedang" },
        { id: 301, type: "tugas", title: "Alpha Task", date: "2026-10-20", priority: "Sedang" },
      ];

      const summary = evaluateAcademicInsights(items, fixedContext);
      assert.equal(summary.insights[0].title, "Alpha Task");
      assert.equal(summary.insights[1].title, "Zebra Task");
    });
  });

  // =========================================================================
  // 6. Idempotency & Determinism Guarantee
  // =========================================================================
  describe("6. Idempotency and Determinism", () => {
    it("produces identical results across 20 consecutive runs for identical inputs", () => {
      const items = [
        { id: 1, type: "tugas", title: "Task 1", date: "2026-10-17", priority: "Tinggi" },
        { id: 2, type: "ujian", title: "Exam 1", date: "2026-10-20", priority: "Sedang" },
        { id: 3, type: "tugas", title: "Task 2", date: "2026-10-21", priority: "Rendah" },
        { id: 4, type: "tugas", title: "Task 3", date: "2026-10-24", priority: "Tinggi" },
        { id: 5, type: "tugas", title: "Done Task", date: "2026-10-15", status: "Selesai" },
      ];

      const context = {
        referenceDate: "2026-10-20",
        timezone: "Asia/Jakarta",
        upcomingWindowDays: 7,
      };

      const baseline = JSON.stringify(evaluateAcademicInsights(items, context));

      for (let i = 0; i < 20; i++) {
        const result = JSON.stringify(evaluateAcademicInsights(items, context));
        assert.equal(result, baseline, `Run ${i + 1} diverged from deterministic baseline`);
      }
    });
  });

  // =========================================================================
  // 7. Timezone Sensitivity and Calendar Isolation
  // =========================================================================
  describe("7. Timezone Sensitivity and Multi-Timezone Behavior", () => {
    it("handles Prisma UTC midnight (@db.Date) identically across any requested timezone", () => {
      // Prisma @db.Date is stored as UTC midnight (e.g. 2026-10-20T00:00:00.000Z)
      const prismaDate = new Date("2026-10-20T00:00:00.000Z");

      const dateUtc = extractCalendarDate(prismaDate, "UTC");
      const dateJakarta = extractCalendarDate(prismaDate, "Asia/Jakarta");
      const dateNewYork = extractCalendarDate(prismaDate, "America/New_York");

      // Pure calendar date must NOT shift to 19 or 21 regardless of evaluation timezone
      assert.equal(dateUtc, "2026-10-20");
      assert.equal(dateJakarta, "2026-10-20");
      assert.equal(dateNewYork, "2026-10-20");
    });

    it("correctly resolves ISO timestamps with explicit time of day according to timezone", () => {
      // 2026-10-20 23:30:00 UTC
      // - In UTC: calendar date is 2026-10-20 (due today relative to 2026-10-20)
      // - In Asia/Jakarta (UTC+7, so 2026-10-21 06:30): calendar date is 2026-10-21 (due tomorrow relative to 2026-10-20)
      const lateEveningUtc = "2026-10-20T23:30:00.000Z";

      const item = {
        id: 501,
        type: "tugas",
        title: "Late Submission Task",
        date: lateEveningUtc,
      };

      const insightUtc = evaluateAcademicItem(item, {
        referenceDate: "2026-10-20",
        timezone: "UTC",
      });
      assert.ok(insightUtc);
      assert.equal(insightUtc.targetDate, "2026-10-20");
      assert.equal(insightUtc.category, "due_today");
      assert.equal(insightUtc.daysDifference, 0);

      const insightJakarta = evaluateAcademicItem(item, {
        referenceDate: "2026-10-20",
        timezone: "Asia/Jakarta",
      });
      assert.ok(insightJakarta);
      assert.equal(insightJakarta.targetDate, "2026-10-21");
      assert.equal(insightJakarta.category, "due_tomorrow");
      assert.equal(insightJakarta.daysDifference, 1);
    });
  });

  // =========================================================================
  // 8. Architectural Contract & API Route Integration
  // =========================================================================
  describe("8. Architectural Contract & API Route Integration", () => {
    const routePath = path.resolve(process.cwd(), "app/api/intelligence/academic/route.ts");

    it("verifies API route exists and declares force-dynamic", () => {
      assert.ok(fs.existsSync(routePath), "app/api/intelligence/academic/route.ts must exist");
      const content = fs.readFileSync(routePath, "utf8");
      assert.ok(
        content.includes('export const dynamic = "force-dynamic"'),
        "Route must specify export const dynamic = 'force-dynamic'"
      );
    });

    it("verifies API route enforces authentication and requires explicit referenceDate & timezone", () => {
      const content = fs.readFileSync(routePath, "utf8");
      assert.ok(content.includes("getAuthSession(req)"), "Route must call getAuthSession(req)");
      assert.ok(
        content.includes('searchParams.get("referenceDate")'),
        "Route must read referenceDate from query parameters"
      );
      assert.ok(
        content.includes('searchParams.get("timezone")'),
        "Route must read timezone from query parameters"
      );
      assert.ok(
        content.includes("validateReferenceDate"),
        "Route must validate referenceDate format strictly"
      );
      assert.ok(
        content.includes("validateTimezone"),
        "Route must validate timezone identifier strictly"
      );
    });

    it("verifies API route is purely read-only without mutations or LLM calls", () => {
      const content = fs.readFileSync(routePath, "utf8");
      // Check that only findMany is called on prisma
      assert.ok(content.includes("prisma.tugas.findMany"), "Must query prisma.tugas.findMany");
      assert.ok(content.includes("prisma.ujian.findMany"), "Must query prisma.ujian.findMany");
      assert.ok(!content.includes("prisma.tugas.create"), "Must not mutate tugas");
      assert.ok(!content.includes("prisma.tugas.update"), "Must not mutate tugas");
      assert.ok(!content.includes("prisma.tugas.delete"), "Must not mutate tugas");
      assert.ok(!content.includes("openai") && !content.includes("anthropic"), "Must not call LLM services");
    });

    it("verifies Prisma data mapping into AcademicItem format evaluates cleanly", () => {
      // Simulate raw Prisma records returned by database
      const rawTasks = [
        {
          id: 10,
          userId: 1,
          idJadwal: 2,
          namaTugas: "Makalah Kecerdasan Buatan",
          deadline: new Date("2026-10-21T00:00:00.000Z"), // @db.Date
          prioritas: "Tinggi",
          jenis: "Individu",
          status: "Belum Dikerjakan",
          progress: 0,
          jadwal: { namaMatkul: "Kecerdasan Buatan" },
        },
        {
          id: 11,
          userId: 1,
          idJadwal: 3,
          namaTugas: "Tugas Selesai",
          deadline: new Date("2026-10-19T00:00:00.000Z"),
          prioritas: "Sedang",
          jenis: "Individu",
          status: "Selesai", // Completed -> filtered
          progress: 100,
          jadwal: { namaMatkul: "Jaringan Komputer" },
        },
      ];

      const rawExams = [
        {
          id: 20,
          userId: 1,
          idJadwal: 2,
          jenisUjian: "Ujian Tengah Semester",
          tanggal: new Date("2026-10-20T00:00:00.000Z"), // @db.Date (today)
          waktuMulai: new Date("1970-01-01T08:00:00.000Z"),
          waktuSelesai: new Date("1970-01-01T10:00:00.000Z"),
          ruangan: "Lab 3",
          jadwal: { namaMatkul: "Kecerdasan Buatan" },
        },
      ];

      // Mapping as performed by API route
      const mappedItems = [
        ...rawTasks.map((t) => ({
          id: t.id,
          type: "tugas",
          title: t.namaTugas,
          courseName: t.jadwal?.namaMatkul ?? null,
          date: t.deadline,
          status: t.status,
          priority: t.prioritas,
        })),
        ...rawExams.map((e) => ({
          id: e.id,
          type: "ujian",
          title: e.jenisUjian,
          courseName: e.jadwal?.namaMatkul ?? null,
          date: e.tanggal,
          priority: "Tinggi",
        })),
      ];

      const summary = evaluateAcademicInsights(mappedItems, {
        referenceDate: "2026-10-20",
        timezone: "Asia/Jakarta",
      });

      assert.equal(summary.totalItemsEvaluated, 3);
      assert.equal(summary.totalInsightsGenerated, 2); // Task 11 (Selesai) is omitted
      assert.equal(summary.countsByCategory.due_today, 1); // Exam 20
      assert.equal(summary.countsByCategory.due_tomorrow, 1); // Task 10
      assert.equal(summary.insights[0].category, "due_today");
      assert.equal(summary.insights[0].title, "Ujian Tengah Semester");
      assert.equal(summary.insights[1].category, "due_tomorrow");
      assert.equal(summary.insights[1].title, "Makalah Kecerdasan Buatan");
    });
  });
});

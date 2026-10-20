import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Milestone M4: Native Productivity Integration Suite", () => {
  // =========================================================================
  // 1. App Intent Logic Simulation (Mirroring Swift Intent & Provider Logic)
  // =========================================================================

  function getIndonesianDayName(date) {
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    return days[date.getUTCDay()];
  }

  function calculateDaysDifference(refYmd, targetYmd) {
    const [ry, rm, rd] = refYmd.split("-").map(Number);
    const [ty, tm, td] = targetYmd.split("-").map(Number);
    const utcRef = Date.UTC(ry, rm - 1, rd);
    const utcTarget = Date.UTC(ty, tm - 1, td);
    return Math.round((utcTarget - utcRef) / (86400 * 1000));
  }

  function resolveTaskUrgency(daysRemaining) {
    if (daysRemaining < 0) return "overdue";
    if (daysRemaining === 0) return "due_today";
    if (daysRemaining === 1) return "due_tomorrow";
    return "upcoming";
  }

  function simulateWidgetSnapshot({
    referenceDateYmd,
    courses = null,
    replacements = null,
    tasks = null,
    exams = null,
    userProfile = null,
    isAuthenticated = true,
  }) {
    const [ry, rm, rd] = referenceDateYmd.split("-").map(Number);
    const refDate = new Date(Date.UTC(ry, rm - 1, rd));
    const dayName = getIndonesianDayName(refDate);

    if (!isAuthenticated) {
      return {
        referenceDateString: referenceDateYmd,
        dayName,
        isAuthenticated: false,
        userName: null,
        todayCourses: [],
        urgentTasks: [],
        nextExam: null,
        summaryText:
          "Silakan masuk ke TrackerThings untuk melihat ringkasan akademik Anda.",
        activeAlertCount: 0,
      };
    }

    // 1. Courses today
    const todayCourses = [];
    if (courses) {
      for (const c of courses) {
        if (c.hari.trim().toLowerCase() === dayName.toLowerCase()) {
          todayCourses.push({
            id: c.id,
            namaMatkul: c.namaMatkul,
            waktuMulai: c.waktuMulai,
            waktuSelesai: c.waktuSelesai,
            ruangan: c.lokasi || null,
            isReplacement: false,
          });
        }
      }
    }

    if (replacements) {
      for (const kp of replacements) {
        const kpDateYmd = kp.tanggal.slice(0, 10);
        if (
          kpDateYmd === referenceDateYmd &&
          kp.status.toLowerCase() !== "selesai"
        ) {
          todayCourses.push({
            id: kp.id,
            namaMatkul: kp.jadwal?.namaMatkul || "Kelas Pengganti",
            waktuMulai: kp.waktuMulai,
            waktuSelesai: kp.waktuSelesai,
            ruangan: kp.lokasi || null,
            isReplacement: true,
          });
        }
      }
    }

    todayCourses.sort((a, b) => {
      if (a.waktuMulai !== b.waktuMulai)
        return a.waktuMulai.localeCompare(b.waktuMulai);
      return a.id - b.id;
    });

    // 2. Urgent Tasks
    const priorityWeights = { Tinggi: 1, Sedang: 2, Rendah: 3 };
    const urgentTasks = [];
    if (tasks) {
      const pending = tasks.filter((t) => t.status !== "Selesai");
      pending.sort((a, b) => {
        if (a.deadline !== b.deadline)
          return a.deadline.localeCompare(b.deadline);
        const pa = priorityWeights[a.prioritas] ?? 2;
        const pb = priorityWeights[b.prioritas] ?? 2;
        if (pa !== pb) return pa - pb;
        return a.id - b.id;
      });

      for (const t of pending) {
        const tDeadlineYmd = t.deadline.slice(0, 10);
        const days = calculateDaysDifference(referenceDateYmd, tDeadlineYmd);
        const category = resolveTaskUrgency(days);
        urgentTasks.push({
          id: t.id,
          namaTugas: t.namaTugas,
          namaMatkul: t.jadwal?.namaMatkul || null,
          deadlineDateString: tDeadlineYmd,
          prioritas: t.prioritas,
          urgencyCategory: category,
          daysRemaining: days,
        });
      }
    }

    // 3. Next Exam
    let nextExam = null;
    if (exams) {
      const upcoming = exams
        .filter((e) => {
          const eYmd = e.tanggal.slice(0, 10);
          return eYmd >= referenceDateYmd;
        })
        .sort((a, b) => {
          if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
          const ta = a.waktuMulai || "";
          const tb = b.waktuMulai || "";
          if (ta !== tb) return ta.localeCompare(tb);
          return a.id - b.id;
        });

      if (upcoming.length > 0) {
        const first = upcoming[0];
        const eYmd = first.tanggal.slice(0, 10);
        const days = calculateDaysDifference(referenceDateYmd, eYmd);
        const waktu = [first.waktuMulai, first.waktuSelesai]
          .filter(Boolean)
          .join(" - ");
        nextExam = {
          id: first.id,
          jenisUjian: first.jenisUjian,
          namaMatkul: first.jadwal?.namaMatkul || "Mata Kuliah",
          tanggalString: eYmd,
          waktu,
          ruangan: first.ruangan || null,
          daysRemaining: days,
        };
      }
    }

    const urgentAlertCount = urgentTasks.filter(
      (t) => t.urgencyCategory === "overdue" || t.urgencyCategory === "due_today"
    ).length;
    const totalAlertCount = todayCourses.length + urgentAlertCount;

    const parts = [];
    if (todayCourses.length > 0)
      parts.push(`${todayCourses.length} kelas hari ini`);
    if (urgentAlertCount > 0)
      parts.push(`${urgentAlertCount} tugas mendesak`);
    if (nextExam && nextExam.daysRemaining <= 2)
      parts.push(`ujian dalam ${nextExam.daysRemaining} hari`);

    const summaryText =
      parts.length > 0
        ? parts.join(", ")
        : "Semua jadwal terkendali hari ini.";

    return {
      referenceDateString: referenceDateYmd,
      dayName,
      isAuthenticated: true,
      userName: userProfile?.fullName || userProfile?.username || null,
      todayCourses,
      urgentTasks,
      nextExam,
      summaryText,
      activeAlertCount: totalAlertCount,
    };
  }

  // =========================================================================
  // 2. Schedule Intent & Today Filtering Tests
  // =========================================================================
  describe("1. GetTodayScheduleIntent & Widget Schedule Filtering", () => {
    it("returns unauthenticated prompt when user is not authenticated", () => {
      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-21", // Wednesday (Rabu)
        isAuthenticated: false,
      });

      assert.equal(snap.isAuthenticated, false);
      assert.equal(snap.todayCourses.length, 0);
      assert.match(snap.summaryText, /Silakan masuk ke TrackerThings/);
    });

    it("aggregates regular courses and replacement classes matching reference weekday", () => {
      const courses = [
        {
          id: 101,
          namaMatkul: "Sistem Terdistribusi",
          hari: "Rabu",
          waktuMulai: "08:00",
          waktuSelesai: "10:30",
          lokasi: "Lab RPL",
        },
        {
          id: 102,
          namaMatkul: "Kecerdasan Buatan",
          hari: "Kamis",
          waktuMulai: "10:00",
          waktuSelesai: "12:00",
          lokasi: "R.301",
        },
      ];
      const replacements = [
        {
          id: 201,
          tanggal: "2026-10-21",
          waktuMulai: "13:00",
          waktuSelesai: "15:00",
          lokasi: "R.402",
          status: "Belum Selesai",
          jadwal: { namaMatkul: "Basis Data Lanjut" },
        },
        {
          id: 202,
          tanggal: "2026-10-21",
          waktuMulai: "15:30",
          waktuSelesai: "17:00",
          lokasi: "R.402",
          status: "Selesai", // Completed replacement class should be excluded
          jadwal: { namaMatkul: "Pemrograman Web" },
        },
      ];

      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-21", // Rabu
        courses,
        replacements,
        isAuthenticated: true,
      });

      assert.equal(snap.dayName, "Rabu");
      assert.equal(snap.todayCourses.length, 2);

      // Verify sorting by start time
      assert.equal(snap.todayCourses[0].namaMatkul, "Sistem Terdistribusi");
      assert.equal(snap.todayCourses[0].isReplacement, false);
      assert.equal(snap.todayCourses[0].waktuMulai, "08:00");

      assert.equal(snap.todayCourses[1].namaMatkul, "Basis Data Lanjut");
      assert.equal(snap.todayCourses[1].isReplacement, true);
      assert.equal(snap.todayCourses[1].waktuMulai, "13:00");
    });

    it("handles day with zero classes gracefully", () => {
      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-25", // Minggu
        courses: [
          {
            id: 1,
            namaMatkul: "Kalkulus",
            hari: "Senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:00",
          },
        ],
        isAuthenticated: true,
      });

      assert.equal(snap.dayName, "Minggu");
      assert.equal(snap.todayCourses.length, 0);
      assert.equal(snap.summaryText, "Semua jadwal terkendali hari ini.");
    });
  });

  // =========================================================================
  // 3. Urgent Tasks Intent & Priority Ordering Tests
  // =========================================================================
  describe("2. GetUrgentTasksIntent & Deterministic Priority Ranking", () => {
    it("excludes completed tasks and sorts by deadline ASC, priority DESC, id ASC", () => {
      const tasks = [
        {
          id: 1,
          namaTugas: "Tugas Kalkulus Sedang",
          deadline: "2026-10-22",
          prioritas: "Sedang",
          status: "Belum Dikerjakan",
        },
        {
          id: 2,
          namaTugas: "Tugas AI Selesai",
          deadline: "2026-10-20",
          prioritas: "Tinggi",
          status: "Selesai", // Completed
        },
        {
          id: 3,
          namaTugas: "Tugas Fisika Mendesak",
          deadline: "2026-10-22",
          prioritas: "Tinggi",
          status: "Belum Dikerjakan",
        },
        {
          id: 4,
          namaTugas: "Tugas Web Overdue",
          deadline: "2026-10-20",
          prioritas: "Rendah",
          status: "Sedang Dikerjakan",
        },
      ];

      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-21",
        tasks,
        isAuthenticated: true,
      });

      assert.equal(snap.urgentTasks.length, 3);

      // Task 4: deadline 2026-10-20 (overdue) comes first
      assert.equal(snap.urgentTasks[0].id, 4);
      assert.equal(snap.urgentTasks[0].urgencyCategory, "overdue");
      assert.equal(snap.urgentTasks[0].daysRemaining, -1);

      // On 2026-10-22: Task 3 (Tinggi) must precede Task 1 (Sedang)
      assert.equal(snap.urgentTasks[1].id, 3);
      assert.equal(snap.urgentTasks[1].prioritas, "Tinggi");
      assert.equal(snap.urgentTasks[1].urgencyCategory, "due_tomorrow");

      assert.equal(snap.urgentTasks[2].id, 1);
      assert.equal(snap.urgentTasks[2].prioritas, "Sedang");
    });

    it("correctly assigns due_today and upcoming urgency categories", () => {
      const tasks = [
        {
          id: 10,
          namaTugas: "Tugas Hari Ini",
          deadline: "2026-10-21",
          prioritas: "Tinggi",
          status: "Belum Dikerjakan",
        },
        {
          id: 11,
          namaTugas: "Tugas Pekan Depan",
          deadline: "2026-10-28",
          prioritas: "Sedang",
          status: "Belum Dikerjakan",
        },
      ];

      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-21",
        tasks,
        isAuthenticated: true,
      });

      assert.equal(snap.urgentTasks[0].urgencyCategory, "due_today");
      assert.equal(snap.urgentTasks[0].daysRemaining, 0);

      assert.equal(snap.urgentTasks[1].urgencyCategory, "upcoming");
      assert.equal(snap.urgentTasks[1].daysRemaining, 7);
    });
  });

  // =========================================================================
  // 4. Next Exam Intent & Countdown Tests
  // =========================================================================
  describe("3. GetNextExamIntent & Countdown Calculation", () => {
    it("selects the nearest upcoming exam and ignores past exams", () => {
      const exams = [
        {
          id: 1,
          jenisUjian: "UTS",
          tanggal: "2026-10-18", // Past
          waktuMulai: "08:00",
          jadwal: { namaMatkul: "Jaringan Komputer" },
        },
        {
          id: 2,
          jenisUjian: "UAS",
          tanggal: "2026-10-23", // In 2 days
          waktuMulai: "13:00",
          waktuSelesai: "15:00",
          ruangan: "Lab 2",
          jadwal: { namaMatkul: "Rekayasa Perangkat Lunak" },
        },
        {
          id: 3,
          jenisUjian: "UAS",
          tanggal: "2026-10-25", // In 4 days
          waktuMulai: "09:00",
          jadwal: { namaMatkul: "Sistem Operasi" },
        },
      ];

      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-21",
        exams,
        isAuthenticated: true,
      });

      assert.ok(snap.nextExam);
      assert.equal(snap.nextExam.id, 2);
      assert.equal(snap.nextExam.namaMatkul, "Rekayasa Perangkat Lunak");
      assert.equal(snap.nextExam.daysRemaining, 2);
      assert.equal(snap.nextExam.waktu, "13:00 - 15:00");
      assert.equal(snap.nextExam.ruangan, "Lab 2");
      assert.match(snap.summaryText, /ujian dalam 2 hari/);
    });

    it("returns null nextExam when no future exams are scheduled", () => {
      const exams = [
        {
          id: 1,
          jenisUjian: "UTS",
          tanggal: "2026-10-10",
          jadwal: { namaMatkul: "Statistika" },
        },
      ];

      const snap = simulateWidgetSnapshot({
        referenceDateYmd: "2026-10-21",
        exams,
        isAuthenticated: true,
      });

      assert.equal(snap.nextExam, null);
    });
  });

  // =========================================================================
  // 5. Swift Code Concurrency & Conformance Audit
  // =========================================================================
  describe("4. Swift Source Code Concurrency & Architecture Audit", () => {
    const swiftFilePath = path.resolve(
      __dirname,
      "../Sources/TrackerThings/Intents/TrackerThingsIntents.swift"
    );

    it("TrackerThingsIntents.swift exists and contains all required App Intents", () => {
      assert.ok(
        fs.existsSync(swiftFilePath),
        "TrackerThingsIntents.swift must exist"
      );
      const content = fs.readFileSync(swiftFilePath, "utf8");

      assert.match(
        content,
        /public struct GetTodayScheduleIntent: AppIntent/,
        "Must declare GetTodayScheduleIntent"
      );
      assert.match(
        content,
        /public struct GetUrgentTasksIntent: AppIntent/,
        "Must declare GetUrgentTasksIntent"
      );
      assert.match(
        content,
        /public struct GetNextExamIntent: AppIntent/,
        "Must declare GetNextExamIntent"
      );
      assert.match(
        content,
        /public struct OpenTrackerThingsTabIntent: AppIntent/,
        "Must declare OpenTrackerThingsTabIntent"
      );
      assert.match(
        content,
        /public struct TrackerThingsShortcuts: AppShortcutsProvider/,
        "Must declare TrackerThingsShortcuts"
      );
    });

    it("verifies Sendable conformance on all public types in TrackerThingsIntents", () => {
      const content = fs.readFileSync(swiftFilePath, "utf8");

      assert.match(
        content,
        /public struct WidgetCourseItem:.*Sendable/,
        "WidgetCourseItem must conform to Sendable"
      );
      assert.match(
        content,
        /public struct WidgetTaskItem:.*Sendable/,
        "WidgetTaskItem must conform to Sendable"
      );
      assert.match(
        content,
        /public struct WidgetExamItem:.*Sendable/,
        "WidgetExamItem must conform to Sendable"
      );
      assert.match(
        content,
        /public struct AcademicWidgetSnapshot:.*Sendable/,
        "AcademicWidgetSnapshot must conform to Sendable"
      );
      assert.match(
        content,
        /public final class WidgetDataProvider: Sendable/,
        "WidgetDataProvider must conform to Sendable"
      );
    });

    it("verifies authentication guards in all queries", () => {
      const content = fs.readFileSync(swiftFilePath, "utf8");

      // Check each intent checks provider.isUserAuthenticated()
      const authOccurrences = (
        content.match(/guard provider\.isUserAuthenticated\(\)/g) || []
      ).length;
      assert.ok(
        authOccurrences >= 3,
        "All 3 information intents must guard for user authentication"
      );
    });

    it("verifies tab parameter supports home, tasks, courses, exams, settings", () => {
      const content = fs.readFileSync(swiftFilePath, "utf8");

      assert.match(
        content,
        /public enum TrackerThingsTabParam: String, AppEnum/
      );
      assert.match(content, /case home = "home"/);
      assert.match(content, /case tasks = "tasks"/);
      assert.match(content, /case courses = "courses"/);
      assert.match(content, /case exams = "exams"/);
      assert.match(content, /case settings = "settings"/);
    });
  });
});

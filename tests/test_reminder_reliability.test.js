import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDaysDifference, formatIndonesianDate } from "../lib/utils.ts";

describe("Milestone M3: Reminder & Notification Reliability Suite", () => {
  // =========================================================================
  // 1. Task Reminder Scheduling Logic & Fallbacks
  // =========================================================================
  describe("1. Task Reminder Scheduling Rules & Priority Fallbacks", () => {
    function computeTaskReminderSchedule(deadlineDateStr, simulatedNowIso) {
      const now = new Date(simulatedNowIso);
      const match = deadlineDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      assert.ok(match, "Valid YYYY-MM-DD expected");

      // In iOS CalendarDateHelper / NotificationService: calendar date tasks end at 23:59:00 local
      const effectiveDeadline = new Date(
        Date.UTC(+match[1], +match[2] - 1, +match[3], 23, 59, 0)
      );

      // If deadline has passed: cancel reminder
      if (effectiveDeadline <= now) {
        return { action: "CANCEL_EXPIRED", triggerDate: null, type: null };
      }

      const hMinus1 = new Date(effectiveDeadline.getTime() - 86400 * 1000);
      const hMinus2 = new Date(effectiveDeadline.getTime() - 7200 * 1000);

      if (hMinus1 > now) {
        return { action: "SCHEDULE", triggerDate: hMinus1, type: "H-1" };
      } else if (hMinus2 > now) {
        return { action: "SCHEDULE", triggerDate: hMinus2, type: "H-2h" };
      } else if (effectiveDeadline.getTime() - now.getTime() >= 120 * 1000) {
        return {
          action: "SCHEDULE",
          triggerDate: new Date(now.getTime() + 60 * 1000),
          type: "Fallback-Hari-H",
        };
      } else {
        return { action: "SKIP_NEAR_EXPIRY", triggerDate: null, type: null };
      }
    }

    it("schedules H-1 reminder (24h before 23:59) when evaluated > 24 hours before deadline", () => {
      const deadline = "2026-10-25";
      const now = "2026-10-23T10:00:00.000Z"; // ~2.5 days before
      const res = computeTaskReminderSchedule(deadline, now);

      assert.equal(res.action, "SCHEDULE");
      assert.equal(res.type, "H-1");
      // H-1 trigger: 2026-10-24 23:59:00 UTC
      assert.equal(res.triggerDate.toISOString(), "2026-10-24T23:59:00.000Z");
    });

    it("falls back to H-2h reminder when evaluated between 2h and 24h before deadline", () => {
      const deadline = "2026-10-25";
      // 10:00 AM on deadline day (14 hours before 23:59:00)
      const now = "2026-10-25T10:00:00.000Z";
      const res = computeTaskReminderSchedule(deadline, now);

      assert.equal(res.action, "SCHEDULE");
      assert.equal(res.type, "H-2h");
      // H-2h trigger: 2026-10-25 21:59:00 UTC
      assert.equal(res.triggerDate.toISOString(), "2026-10-25T21:59:00.000Z");
    });

    it("falls back to Fallback-Hari-H (+60s) when remaining time is between 2m and 2h", () => {
      const deadline = "2026-10-25";
      // 23:00 on deadline day (59 minutes before 23:59:00)
      const now = "2026-10-25T23:00:00.000Z";
      const res = computeTaskReminderSchedule(deadline, now);

      assert.equal(res.action, "SCHEDULE");
      assert.equal(res.type, "Fallback-Hari-H");
      assert.equal(res.triggerDate.toISOString(), "2026-10-25T23:01:00.000Z");
    });

    it("cancels reminder immediately when deadline has already passed", () => {
      const deadline = "2026-10-25";
      // Next day
      const now = "2026-10-26T08:00:00.000Z";
      const res = computeTaskReminderSchedule(deadline, now);

      assert.equal(res.action, "CANCEL_EXPIRED");
      assert.equal(res.triggerDate, null);
    });

    it("skips new notification creation when within 2 minutes of deadline", () => {
      const deadline = "2026-10-25";
      // 23:58 on deadline day (1 minute before 23:59)
      const now = "2026-10-25T23:58:00.000Z";
      const res = computeTaskReminderSchedule(deadline, now);

      assert.equal(res.action, "SKIP_NEAR_EXPIRY");
      assert.equal(res.triggerDate, null);
    });
  });

  // =========================================================================
  // 2. Exam Reminder Scheduling Rules
  // =========================================================================
  describe("2. Exam Reminder Scheduling Rules", () => {
    function computeExamReminderSchedule(examDateStr, startTimeStr, nowIso, leadTimeHours = 24) {
      const now = new Date(nowIso);
      const [y, m, d] = examDateStr.split("-").map(Number);
      const [h, min] = (startTimeStr || "08:00").split(":").map(Number);
      const examStart = new Date(Date.UTC(y, m - 1, d, h, min, 0));

      if (examStart <= now) {
        return { action: "CANCEL_EXPIRED", triggerDate: null, type: null };
      }

      const leadTrigger = new Date(examStart.getTime() - leadTimeHours * 3600 * 1000);
      const hMinus2 = new Date(examStart.getTime() - 7200 * 1000);

      if (leadTrigger > now) {
        return { action: "SCHEDULE", triggerDate: leadTrigger, type: "H-Lead" };
      } else if (hMinus2 > now) {
        return { action: "SCHEDULE", triggerDate: hMinus2, type: "H-2h" };
      } else if (examStart.getTime() - now.getTime() >= 120 * 1000) {
        return {
          action: "SCHEDULE",
          triggerDate: new Date(now.getTime() + 60 * 1000),
          type: "Fallback-Hari-H",
        };
      } else {
        return { action: "SKIP_NEAR_EXPIRY", triggerDate: null, type: null };
      }
    }

    it("schedules exam reminder at 24h lead time when evaluated in advance", () => {
      const res = computeExamReminderSchedule(
        "2026-10-25",
        "09:00",
        "2026-10-23T12:00:00.000Z"
      );
      assert.equal(res.action, "SCHEDULE");
      assert.equal(res.type, "H-Lead");
      // 24h before 2026-10-25 09:00 -> 2026-10-24 09:00
      assert.equal(res.triggerDate.toISOString(), "2026-10-24T09:00:00.000Z");
    });

    it("falls back to H-2h when evaluated the evening before the exam", () => {
      const res = computeExamReminderSchedule(
        "2026-10-25",
        "09:00",
        "2026-10-25T01:00:00.000Z" // 8h before exam
      );
      assert.equal(res.action, "SCHEDULE");
      assert.equal(res.type, "H-2h");
      // H-2h: 07:00
      assert.equal(res.triggerDate.toISOString(), "2026-10-25T07:00:00.000Z");
    });
  });

  // =========================================================================
  // 3. Recurring Course Reminder Lead-Time & Weekday Mapping
  // =========================================================================
  describe("3. Recurring Course Reminders & Weekday Mapping", () => {
    function computeCourseReminderComponents(dayName, startTimeStr, leadTimeMinutes = 15) {
      const dayMap = {
        minggu: 1, sunday: 1,
        senin: 2, monday: 2,
        selasa: 3, tuesday: 3,
        rabu: 4, wednesday: 4,
        kamis: 5, thursday: 5,
        jumat: 6, "jum'at": 6, friday: 6,
        sabtu: 7, saturday: 7,
      };

      const weekday = dayMap[dayName.trim().toLowerCase()] ?? 2;
      const [h, m] = startTimeStr.split(":").map(Number);
      let totalMinutes = h * 60 + m - leadTimeMinutes;
      let targetWeekday = weekday;

      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
        targetWeekday = targetWeekday === 1 ? 7 : targetWeekday - 1;
      }

      return {
        weekday: targetWeekday,
        hour: Math.floor(totalMinutes / 60),
        minute: totalMinutes % 60,
      };
    }

    it("calculates exact reminder time with 15-minute lead time", () => {
      const res = computeCourseReminderComponents("Senin", "08:00", 15);
      assert.equal(res.weekday, 2); // Monday
      assert.equal(res.hour, 7);
      assert.equal(res.minute, 45);
    });

    it("correctly handles midnight underflow by shifting to previous day", () => {
      // Monday at 00:10 with 15-minute lead time -> Sunday at 23:55
      const res = computeCourseReminderComponents("Senin", "00:10", 15);
      assert.equal(res.weekday, 1); // Sunday
      assert.equal(res.hour, 23);
      assert.equal(res.minute, 55);
    });

    it("maps all Indonesian day names accurately without drift", () => {
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      for (let i = 0; i < days.length; i++) {
        const res = computeCourseReminderComponents(days[i], "10:00", 0);
        assert.equal(res.weekday, i + 1, `Day ${days[i]} should map to weekday ${i + 1}`);
      }
    });
  });

  // =========================================================================
  // 4. Stale Notification Deduplication & Synchronization (syncAllReminders)
  // =========================================================================
  describe("4. Notification Synchronization & Stale Request Cleanup", () => {
    function simulateSyncAllReminders(pendingIds, activeCourses, activeTasks, activeExams) {
      const validCourseIds = new Set(activeCourses.map((c) => `course-${c.id}`));
      const activeUncompletedTasks = activeTasks.filter((t) => t.status !== "Selesai");
      const validTaskIds = new Set(activeUncompletedTasks.map((t) => `task-${t.id}`));
      const validExamIds = new Set(activeExams.map((e) => `exam-${e.id}`));

      const staleCourseIds = pendingIds.filter(
        (id) => id.startsWith("course-") && !validCourseIds.has(id)
      );
      const staleTaskIds = pendingIds.filter(
        (id) => id.startsWith("task-") && !validTaskIds.has(id)
      );
      const staleExamIds = pendingIds.filter(
        (id) => id.startsWith("exam-") && !validExamIds.has(id)
      );

      const allStale = [...staleCourseIds, ...staleTaskIds, ...staleExamIds];
      const retainedIds = pendingIds.filter((id) => !allStale.includes(id));

      return {
        staleRemoved: allStale,
        retained: retainedIds,
      };
    }

    it("removes task reminders immediately when tasks are marked 'Selesai' or deleted", () => {
      const initialPending = ["task-1", "task-2", "task-3", "course-10"];
      const courses = [{ id: 10 }];
      const tasks = [
        { id: 1, status: "Belum Dikerjakan" },
        { id: 2, status: "Selesai" }, // Task 2 finished
        // Task 3 deleted
      ];
      const exams = [];

      const result = simulateSyncAllReminders(initialPending, courses, tasks, exams);

      assert.deepEqual(result.staleRemoved.sort(), ["task-2", "task-3"].sort());
      assert.deepEqual(result.retained.sort(), ["task-1", "course-10"].sort());
    });

    it("removes course reminders when courses are deleted from timetable", () => {
      const initialPending = ["course-1", "course-2", "task-1"];
      const courses = [{ id: 1 }]; // Course 2 deleted
      const tasks = [{ id: 1, status: "Belum Dikerjakan" }];
      const exams = [];

      const result = simulateSyncAllReminders(initialPending, courses, tasks, exams);

      assert.deepEqual(result.staleRemoved, ["course-2"]);
      assert.deepEqual(result.retained.sort(), ["course-1", "task-1"].sort());
    });
  });

  // =========================================================================
  // 5. Deep Link Navigation Payload & Cold-Start Race Condition Safety
  // =========================================================================
  describe("5. Deep Link Payload & Cold-Start Atomic Consumption", () => {
    class MockPendingStorage {
      constructor() {
        this.destination = null;
        this.userInfo = null;
      }
      set(dest, uInfo) {
        this.destination = dest;
        this.userInfo = uInfo;
      }
      consume() {
        if (!this.destination) return null;
        const result = {
          destination: this.destination,
          userInfo: this.userInfo || {},
        };
        this.destination = null;
        this.userInfo = null;
        return result;
      }
    }

    it("stores and consumes deep link destination atomically with item ID payload", () => {
      const storage = new MockPendingStorage();
      storage.set("tasks", { destination: "tasks", taskId: 42 });

      // First consume on cold-start
      const consumed = storage.consume();
      assert.ok(consumed);
      assert.equal(consumed.destination, "tasks");
      assert.equal(consumed.userInfo.taskId, 42);

      // Second consume must be empty (single-use guarantee, preventing double-navigation)
      assert.equal(storage.consume(), null);
    });
  });

  // =========================================================================
  // 6. Web Dashboard Urgent Reminder Aggregator
  // =========================================================================
  describe("6. Web Dashboard Urgent Reminder Notification Generator", () => {
    it("aggregates both urgent tasks and upcoming exams within 2 days with correct badges", () => {
      const urgentTasks = [
        { id: 1, namaTugas: "Tugas Fisika", deadline: "2026-10-21", jadwal: { namaMatkul: "Fisika" } },
        { id: 2, namaTugas: "Tugas Jauh", deadline: "2026-10-30", jadwal: { namaMatkul: "Kalkulus" } },
      ];

      const upcomingExams = [
        { id: 10, jenisUjian: "UTS", tanggal: "2026-10-20", jadwal: { namaMatkul: "Fisika" } },
        { id: 11, jenisUjian: "UAS", tanggal: "2026-11-20", jadwal: { namaMatkul: "Kalkulus" } },
      ];

      const refDate = "2026-10-20";
      const notifications = [];

      for (const t of urgentTasks) {
        const daysDiff = getDaysDifference(t.deadline, refDate);
        if (daysDiff >= 0 && daysDiff <= 2) {
          notifications.push({
            id: `task-${t.id}`,
            judul: t.namaTugas,
            namaMatkul: t.jadwal?.namaMatkul || "",
            tipe: "Tugas",
            isUrgent: true,
          });
        }
      }

      for (const e of upcomingExams) {
        const daysDiff = getDaysDifference(e.tanggal, refDate);
        if (daysDiff >= 0 && daysDiff <= 2) {
          notifications.push({
            id: `exam-${e.id}`,
            judul: `Ujian ${e.jenisUjian}`,
            namaMatkul: e.jadwal?.namaMatkul || "",
            tipe: "Ujian",
            isUrgent: daysDiff === 0 || daysDiff === 1,
          });
        }
      }

      assert.equal(notifications.length, 2);
      assert.equal(notifications[0].id, "task-1");
      assert.equal(notifications[0].tipe, "Tugas");
      assert.equal(notifications[1].id, "exam-10");
      assert.equal(notifications[1].tipe, "Ujian");
      assert.equal(notifications[1].isUrgent, true);
    });
  });
});


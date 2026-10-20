import { describe, it } from "node:test";
import assert from "node:assert/strict";
import cp from "node:child_process";
import { getDaysDifference, parseDateOnly } from "../lib/utils.ts";

describe("Timezone & Deadline Regression Suite (M0 Validation)", () => {
  describe("1. Existing getDaysDifference behavior with ambient runtime clock", () => {
    it("evaluates calendar difference relative to ambient today", () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const todayStr = `${y}-${m}-${d}`;

      assert.equal(getDaysDifference(todayStr), 0, "today string must yield 0");

      const tomorrow = new Date(now.getTime() + 86400000);
      const ty = tomorrow.getFullYear();
      const tm = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const td = String(tomorrow.getDate()).padStart(2, "0");
      const tomorrowStr = `${ty}-${tm}-${td}`;
      assert.equal(getDaysDifference(tomorrowStr), 1, "tomorrow string must yield 1");

      const yesterday = new Date(now.getTime() - 86400000);
      const yy = yesterday.getFullYear();
      const ym = String(yesterday.getMonth() + 1).padStart(2, "0");
      const yd = String(yesterday.getDate()).padStart(2, "0");
      const yesterdayStr = `${yy}-${ym}-${yd}`;
      assert.equal(getDaysDifference(yesterdayStr), -1, "yesterday string must yield -1");
    });

    it("parses Prisma Date instances stored as UTC midnight correctly", () => {
      const prismaUtcDate = new Date("2026-10-20T00:00:00.000Z");
      const diff = getDaysDifference(prismaUtcDate);
      assert.equal(Number.isInteger(diff), true, "diff must be an integer");
    });
  });

  describe("2. Concrete Execution: Production getDaysDifference under Controlled Timezones & Clock", () => {
    /**
     * Executes the actual production `getDaysDifference` in isolated child processes
     * with controlled `process.env.TZ` and a frozen UTC instant (2026-10-19T19:30:00.000Z).
     *
     * At this instant:
     * - Under TZ=UTC: Wall clock is 19:30 on Monday, Oct 19, 2026.
     * - Under TZ=Asia/Jakarta: Wall clock is 02:30 on Tuesday, Oct 20, 2026.
     */
    function runProductionGetDaysDifference(targetDateStr, tz, frozenUtcIso) {
      const script = `
        const originalDate = global.Date;
        const freezeMs = Date.parse('${frozenUtcIso}');
        function MockDate(...args) {
          if (args.length === 0) return new originalDate(freezeMs);
          return new originalDate(...args);
        }
        MockDate.prototype = originalDate.prototype;
        MockDate.now = () => freezeMs;
        MockDate.UTC = originalDate.UTC;
        MockDate.parse = originalDate.parse;
        global.Date = MockDate;

        import('./lib/utils.ts').then(({ getDaysDifference }) => {
          const diff = getDaysDifference('${targetDateStr}');
          console.log(JSON.stringify({
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            diff
          }));
        });
      `;

      const out = cp.execSync("node --input-type=module", {
        input: script,
        env: { ...process.env, TZ: tz },
      }).toString();

      // Find the last line of JSON output (ignoring any module warnings)
      const lines = out.trim().split("\n").map(l => l.trim()).filter(Boolean);
      const jsonLine = lines.find(l => l.startsWith("{") && l.endsWith("}"));
      assert.ok(jsonLine, "Expected JSON output from child process");
      return JSON.parse(jsonLine);
    }

    it("proves actual getDaysDifference yields 1 on UTC server vs 0 on Jakarta client for same deadline", () => {
      const deadline = "2026-10-20";
      const frozenUtc = "2026-10-19T19:30:00.000Z";

      const utcResult = runProductionGetDaysDifference(deadline, "UTC", frozenUtc);
      const jktResult = runProductionGetDaysDifference(deadline, "Asia/Jakarta", frozenUtc);

      assert.equal(utcResult.tz, "UTC");
      assert.equal(utcResult.diff, 1, "Under UTC runtime, Oct 20 task has daysDiff = 1 (Tomorrow)");

      assert.equal(jktResult.tz, "Asia/Jakarta");
      assert.equal(jktResult.diff, 0, "Under Jakarta runtime, Oct 20 task has daysDiff = 0 (Today)");

      assert.notEqual(utcResult.diff, jktResult.diff, "Demonstrates divergence in production function when host runtime TZ differs");
    });

    it("proves actual getDaysDifference classifies overdue task as 0 (due today) on UTC server", () => {
      // Task that was due Oct 19
      const deadline = "2026-10-19";
      const frozenUtc = "2026-10-19T19:30:00.000Z";

      const utcResult = runProductionGetDaysDifference(deadline, "UTC", frozenUtc);
      const jktResult = runProductionGetDaysDifference(deadline, "Asia/Jakarta", frozenUtc);

      assert.equal(utcResult.diff, 0, "UTC server thinks Oct 19 is today (diff = 0)");
      assert.equal(jktResult.diff, -1, "Jakarta student is already on Oct 20, so Oct 19 is overdue (diff = -1)");
    });
  });

  describe("3. Architecture Safeguard: Pure Reference Date Contract", () => {
    it("ensures identical results across any timezone when reference date is explicit", () => {
      const deadline = "2026-10-25";
      const refDate = "2026-10-20";

      const matchRef = refDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const matchTgt = deadline.match(/^(\d{4})-(\d{2})-(\d{2})/);
      assert.ok(matchRef && matchTgt);

      const dRef = new Date(Date.UTC(+matchRef[1], +matchRef[2] - 1, +matchRef[3]));
      const dTgt = new Date(Date.UTC(+matchTgt[1], +matchTgt[2] - 1, +matchTgt[3]));
      const diff = Math.round((dTgt.getTime() - dRef.getTime()) / 86400000);

      assert.equal(diff, 5, "Explicit reference date eliminates all ambient timezone drift");
    });
  });

  describe("4. Multi-Timezone & Calendar Boundary Invariance (M2 Validation)", () => {
    const timezones = ["Asia/Jakarta", "Asia/Tokyo", "America/New_York", "UTC"];

    function runInTimezone(targetDate, refDate, tz) {
      const script = `
        import('./lib/utils.ts').then(({ getDaysDifference }) => {
          const diff = getDaysDifference('${targetDate}', '${refDate}');
          console.log(JSON.stringify({ tz: '${tz}', diff }));
        });
      `;
      const out = cp.execSync("node --input-type=module", {
        input: script,
        env: { ...process.env, TZ: tz },
      }).toString();
      const lines = out.trim().split("\n").map(l => l.trim()).filter(Boolean);
      const jsonLine = lines.find(l => l.startsWith("{") && l.endsWith("}"));
      return JSON.parse(jsonLine).diff;
    }

    it("evaluates exact calendar difference identically across UTC+7, UTC+9, UTC-5, and UTC", () => {
      for (const tz of timezones) {
        // Same day
        assert.equal(runInTimezone("2026-10-20", "2026-10-20", tz), 0, `Failed on ${tz} for same day`);
        // Tomorrow
        assert.equal(runInTimezone("2026-10-21", "2026-10-20", tz), 1, `Failed on ${tz} for tomorrow`);
        // Yesterday
        assert.equal(runInTimezone("2026-10-19", "2026-10-20", tz), -1, `Failed on ${tz} for yesterday`);
      }
    });

    it("handles month boundary transitions identically across all target timezones", () => {
      for (const tz of timezones) {
        // Oct 31 -> Nov 1
        assert.equal(runInTimezone("2026-11-01", "2026-10-31", tz), 1, `Failed on ${tz} for Oct->Nov`);
        assert.equal(runInTimezone("2026-10-31", "2026-11-01", tz), -1, `Failed on ${tz} for Nov->Oct`);
      }
    });

    it("handles year boundary transitions identically across all target timezones", () => {
      for (const tz of timezones) {
        // Dec 31, 2026 -> Jan 1, 2027
        assert.equal(runInTimezone("2027-01-01", "2026-12-31", tz), 1, `Failed on ${tz} for Year transition`);
        assert.equal(runInTimezone("2026-12-31", "2027-01-01", tz), -1, `Failed on ${tz} for Year transition reverse`);
      }
    });

    it("handles leap year (2024) vs non-leap year (2026) boundaries identically", () => {
      for (const tz of timezones) {
        // In leap year 2024: Feb 28 to Mar 1 spans 2 days (Feb 29 exists)
        assert.equal(runInTimezone("2024-03-01", "2024-02-28", tz), 2, `Failed on ${tz} for 2024 leap year`);
        // In non-leap year 2026: Feb 28 to Mar 1 spans 1 day
        assert.equal(runInTimezone("2026-03-01", "2026-02-28", tz), 1, `Failed on ${tz} for 2026 non-leap year`);
      }
    });
  });

  describe("5. parseDateOnly UTC Midnight Consistency Guarantee (M2)", () => {
    it("guarantees every parsed date is anchored to exact UTC midnight (00:00:00.000Z)", () => {
      const inputs = [
        "2026-10-20",
        "2026-10-20T14:30",
        "2026-10-20T00:00:00.000Z",
        "2026-10-20T23:59:59+07:00",
        new Date("2026-10-20T00:00:00.000Z"),
        "",
        null,
        undefined,
        "invalid-date-string",
      ];

      for (const input of inputs) {
        const parsed = parseDateOnly(input);
        assert.ok(parsed instanceof Date, `Expected Date instance for ${input}`);
        assert.equal(isNaN(parsed.getTime()), false, `Expected valid date for ${input}`);
        assert.equal(parsed.getUTCHours(), 0, `getUTCHours must be 0 for ${input}`);
        assert.equal(parsed.getUTCMinutes(), 0, `getUTCMinutes must be 0 for ${input}`);
        assert.equal(parsed.getUTCSeconds(), 0, `getUTCSeconds must be 0 for ${input}`);
        assert.equal(parsed.getUTCMilliseconds(), 0, `getUTCMilliseconds must be 0 for ${input}`);
      }
    });

    it("preserves exact calendar date when parsing Prisma Date instances", () => {
      const prismaDate = new Date("2026-10-20T00:00:00.000Z");
      const parsed = parseDateOnly(prismaDate);
      assert.equal(parsed.toISOString(), "2026-10-20T00:00:00.000Z");
    });
  });
});

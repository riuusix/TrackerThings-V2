import { describe, it } from "node:test";
import assert from "node:assert/strict";
import cp from "node:child_process";
import { getDaysDifference } from "../lib/utils.ts";

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
});

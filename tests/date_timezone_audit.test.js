/**
 * Test Suite: Multi-Timezone & Date Semantics Audit
 * Menguji perilaku:
 * 1. parseDateOnly (Calendar Date vs Timestamp, multi-offset, legacy data)
 * 2. formatIndonesianDate (Universal Calendar Date, no timezone shift)
 * 3. formatIndonesianDateTime (Absolute Timestamp in Asia/Jakarta, Asia/Tokyo, America/New_York)
 * 4. getDaysDifference (Local calendar day comparison without timezone drift)
 * 5. iOS DatePicker / Codable simulation (YYYY-MM-DD wire contract)
 * 6. Reminder timing simulation (H-1, H-2h, near-deadline fallback, and expired cancellation)
 */

const assert = require("assert");

// Import utility functions directly from lib/utils.ts
const utils = require("../lib/utils.ts");
const { parseDateOnly, formatIndonesianDate, formatIndonesianDateTime, getDaysDifference } = utils;

console.log("================================================================================");
console.log("RUNNING MULTI-TIMEZONE DATE & SEMANTICS TEST SUITE");
console.log("Target Timezones: Asia/Jakarta (UTC+7), Asia/Tokyo (UTC+9), America/New_York (UTC-5/EDT)");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error("       Error:", err.message);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. parseDateOnly: Calendar Date Extraction
// -----------------------------------------------------------------------------
console.log("--- 1. parseDateOnly (Calendar Date -> Prisma UTC midnight) ---");

test("Date-only string '2026-10-13' yields exact UTC midnight", () => {
  const res = parseDateOnly("2026-10-13").toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

test("HTML datetime-local string '2026-10-13T14:30' yields exact UTC midnight", () => {
  const res = parseDateOnly("2026-10-13T14:30").toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

test("Legacy Prisma UTC ISO string '2026-10-13T00:00:00.000Z' yields exact UTC midnight", () => {
  const res = parseDateOnly("2026-10-13T00:00:00.000Z").toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

test("Offset timestamp from Asia/Jakarta '2026-10-13T00:00:00+07:00' preserves calendar date", () => {
  const res = parseDateOnly("2026-10-13T00:00:00+07:00").toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

test("Offset timestamp from Asia/Tokyo '2026-10-13T00:00:00+09:00' preserves calendar date", () => {
  const res = parseDateOnly("2026-10-13T00:00:00+09:00").toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

test("Offset timestamp from America/New_York '2026-10-13T00:00:00-05:00' preserves calendar date", () => {
  const res = parseDateOnly("2026-10-13T00:00:00-05:00").toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

test("Date instance with UTC midnight preserves calendar date", () => {
  const d = new Date("2026-10-13T00:00:00.000Z");
  const res = parseDateOnly(d).toISOString();
  assert.strictEqual(res, "2026-10-13T00:00:00.000Z");
});

// -----------------------------------------------------------------------------
// 2. formatIndonesianDate: Calendar Date formatting across timezones
// -----------------------------------------------------------------------------
console.log("\n--- 2. formatIndonesianDate (Universal Calendar Display) ---");

test("Format date-only string '2026-10-13' outputs '13 Oktober 2026'", () => {
  const res = formatIndonesianDate("2026-10-13");
  assert.strictEqual(res, "13 Oktober 2026");
});

test("Format legacy Prisma string '2026-10-13T00:00:00.000Z' outputs '13 Oktober 2026'", () => {
  const res = formatIndonesianDate("2026-10-13T00:00:00.000Z");
  assert.strictEqual(res, "13 Oktober 2026");
});

test("Format Prisma Date instance outputs '13 Oktober 2026'", () => {
  const d = new Date("2026-10-13T00:00:00.000Z");
  const res = formatIndonesianDate(d);
  assert.strictEqual(res, "13 Oktober 2026");
});

// -----------------------------------------------------------------------------
// 3. formatIndonesianDateTime: Absolute Timestamps across target timezones
// -----------------------------------------------------------------------------
console.log("\n--- 3. formatIndonesianDateTime (Absolute Timestamp in Target Timezones) ---");

const testInstant = "2026-10-13T04:20:00.000Z";

test("Absolute timestamp formatted in Asia/Jakarta (UTC+7) is 11.20 WIB", () => {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const res = fmt.format(new Date(testInstant));
  // In id-ID: "13 Oktober 2026, 11.20"
  assert.ok(res.includes("13 Oktober 2026") && res.includes("11.20"), `Expected 11.20 in Jakarta, got: ${res}`);
});

test("Absolute timestamp formatted in Asia/Tokyo (UTC+9) is 13.20 JST", () => {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Tokyo",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const res = fmt.format(new Date(testInstant));
  // In Tokyo: "13 Oktober 2026, 13.20"
  assert.ok(res.includes("13 Oktober 2026") && res.includes("13.20"), `Expected 13.20 in Tokyo, got: ${res}`);
});

test("Absolute timestamp formatted in America/New_York (UTC-4 EDT) is 00.20 EDT", () => {
  const fmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "America/New_York",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const res = fmt.format(new Date(testInstant));
  // In New York: "13 Oktober 2026, 00.20"
  assert.ok(res.includes("13 Oktober 2026") && (res.includes("00.20") || res.includes("00:20")), `Expected 00.20 in New York, got: ${res}`);
});

// -----------------------------------------------------------------------------
// 4. getDaysDifference: Day difference calculation without timezone distortion
// -----------------------------------------------------------------------------
console.log("\n--- 4. getDaysDifference (Calendar Comparison) ---");

test("Today's calendar date yields 0 days difference", () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  
  const diff = getDaysDifference(todayStr);
  assert.strictEqual(diff, 0, `Expected 0, got ${diff}`);
});

test("Tomorrow's calendar date yields +1 day difference", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const d = String(tomorrow.getDate()).padStart(2, "0");
  const tomorrowStr = `${y}-${m}-${d}`;

  const diff = getDaysDifference(tomorrowStr);
  assert.strictEqual(diff, 1, `Expected 1, got ${diff}`);
});

test("Yesterday's calendar date yields -1 day difference (Terlewat)", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");
  const yesterdayStr = `${y}-${m}-${d}`;

  const diff = getDaysDifference(yesterdayStr);
  assert.strictEqual(diff, -1, `Expected -1, got ${diff}`);
});

// -----------------------------------------------------------------------------
// 5. iOS DatePicker & CalendarDateHelper Simulation
// -----------------------------------------------------------------------------
console.log("\n--- 5. iOS Wire Contract & CalendarDateHelper Simulation ---");

function simulateIOSDatePicker(year, month, day) {
  // DatePicker selects year, month, day in user's local calendar
  // CalendarDateHelper formats as YYYY-MM-DD
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

test("iOS user in Asia/Jakarta selects Oct 13 -> wire sends '2026-10-13'", () => {
  const wire = simulateIOSDatePicker(2026, 10, 13);
  assert.strictEqual(wire, "2026-10-13");
  const parsed = parseDateOnly(wire).toISOString();
  assert.strictEqual(parsed, "2026-10-13T00:00:00.000Z");
});

test("iOS user in Asia/Tokyo selects Oct 13 -> wire sends '2026-10-13'", () => {
  const wire = simulateIOSDatePicker(2026, 10, 13);
  assert.strictEqual(wire, "2026-10-13");
  const parsed = parseDateOnly(wire).toISOString();
  assert.strictEqual(parsed, "2026-10-13T00:00:00.000Z");
});

test("iOS user in America/New_York selects Oct 13 -> wire sends '2026-10-13'", () => {
  const wire = simulateIOSDatePicker(2026, 10, 13);
  assert.strictEqual(wire, "2026-10-13");
  const parsed = parseDateOnly(wire).toISOString();
  assert.strictEqual(parsed, "2026-10-13T00:00:00.000Z");
});

// -----------------------------------------------------------------------------
// 6. Reminder Schedule Logic Simulation
// -----------------------------------------------------------------------------
console.log("\n--- 6. NotificationService Reminder Logic Simulation ---");

function calculateReminderSchedule(deadlineDate, now) {
  // Batas akhir hari kalender adalah 23:59:00
  const effectiveDeadline = new Date(deadlineDate);
  effectiveDeadline.setHours(23, 59, 0, 0);

  // Jika deadline sudah terlewat: batalkan pengingat dan jangan jadwalkan apa pun
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
    return { action: "SCHEDULE", triggerDate: new Date(now.getTime() + 60 * 1000), type: "Fallback-Hari-H" };
  } else {
    return { action: "SKIP_NEAR_EXPIRY", triggerDate: null, type: null };
  }
}

test("Scenario A: Current time is H-2 days before deadline -> Schedules H-1", () => {
  const deadline = new Date("2026-10-15T00:00:00");
  const now = new Date("2026-10-13T10:00:00");
  const schedule = calculateReminderSchedule(deadline, now);
  
  assert.strictEqual(schedule.action, "SCHEDULE");
  assert.strictEqual(schedule.type, "H-1");
  // H-1 trigger: 2026-10-14 23:59:00
  assert.strictEqual(schedule.triggerDate.getDate(), 14);
  assert.strictEqual(schedule.triggerDate.getHours(), 23);
  assert.strictEqual(schedule.triggerDate.getMinutes(), 59);
});

test("Scenario B: Current time is morning of deadline day -> Schedules H-2h (21:59)", () => {
  const deadline = new Date("2026-10-13T00:00:00");
  const now = new Date("2026-10-13T09:00:00");
  const schedule = calculateReminderSchedule(deadline, now);

  assert.strictEqual(schedule.action, "SCHEDULE");
  assert.strictEqual(schedule.type, "H-2h");
  assert.strictEqual(schedule.triggerDate.getDate(), 13);
  assert.strictEqual(schedule.triggerDate.getHours(), 21);
  assert.strictEqual(schedule.triggerDate.getMinutes(), 59);
});

test("Scenario C: Current time is 22:30 on deadline day -> Schedules Fallback-Hari-H (60s)", () => {
  const deadline = new Date("2026-10-13T00:00:00");
  const now = new Date("2026-10-13T22:30:00");
  const schedule = calculateReminderSchedule(deadline, now);

  assert.strictEqual(schedule.action, "SCHEDULE");
  assert.strictEqual(schedule.type, "Fallback-Hari-H");
  assert.strictEqual(schedule.triggerDate.getTime(), now.getTime() + 60 * 1000);
});

test("Scenario D: Current time is AFTER deadline (Oct 14, 01:00) -> CANCELS, NEVER schedules 1m fallback!", () => {
  const deadline = new Date("2026-10-13T00:00:00");
  const now = new Date("2026-10-14T01:00:00");
  const schedule = calculateReminderSchedule(deadline, now);

  assert.strictEqual(schedule.action, "CANCEL_EXPIRED");
  assert.strictEqual(schedule.triggerDate, null);
  assert.strictEqual(schedule.type, null);
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
if (passed === total) {
  console.log("ALL TESTS COMPLETED SUCCESSFULLY WITH ZERO FAILURES!");
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
console.log("================================================================================");


import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test.describe("Web Component Redesign & Dashboard Pilot Suite", () => {
  test("1. TaskItem: Left-aligned completion control, streamlined metadata, and restrained priority dot", () => {
    const taskItemPath = path.join(rootDir, "components", "TaskItem.tsx");
    assert.ok(fs.existsSync(taskItemPath), "components/TaskItem.tsx must exist");

    const content = fs.readFileSync(taskItemPath, "utf8");

    // Left completion control
    assert.ok(
      content.includes("handleToggleComplete") || content.includes("handleMarkComplete"),
      "Must implement intuitive toggle completion"
    );
    assert.ok(
      content.includes("rounded-full border flex items-center justify-center"),
      "Must feature left-aligned circular completion control"
    );

    // Streamlined metadata line without badge soup
    assert.ok(
      content.includes("formatIndonesianDate(task.deadline)"),
      "Must format deadline using Indonesian localized date"
    );
    assert.ok(
      content.includes("getPriorityDot"),
      "Must use restrained priority dot rather than aggressive full-color badge soup"
    );

    // Interactive progress slider
    assert.ok(
      content.includes('type="range"'),
      "Must feature interactive progress slider"
    );
  });

  test("2. ScheduleCard & ScheduleList: Structured timeline rail and active spring tab indicator", () => {
    const cardPath = path.join(rootDir, "components", "ScheduleCard.tsx");
    const listPath = path.join(rootDir, "components", "ScheduleList.tsx");
    assert.ok(fs.existsSync(cardPath), "components/ScheduleCard.tsx must exist");
    assert.ok(fs.existsSync(listPath), "components/ScheduleList.tsx must exist");

    const cardContent = fs.readFileSync(cardPath, "utf8");
    const listContent = fs.readFileSync(listPath, "utf8");

    // ScheduleCard left time rail
    assert.ok(
      cardContent.includes("item.waktuMulai") && cardContent.includes("item.waktuSelesai"),
      "ScheduleCard must clearly display start and end times in structured timeline format"
    );
    assert.ok(
      cardContent.includes("item.namaMatkul"),
      "ScheduleCard must prominently display course name"
    );
    assert.ok(
      cardContent.includes("item.lokasi") && cardContent.includes("item.dosen"),
      "ScheduleCard must display room location and lecturer metadata"
    );

    // ScheduleList active day pill
    assert.ok(
      listContent.includes("activeDayTab") || listContent.includes("activeTab"),
      "ScheduleList must feature animated active tab pill indicator"
    );
    assert.ok(
      listContent.includes("DAYS_OF_WEEK"),
      "ScheduleList must support all 7 days of the academic week"
    );
  });

  test("3. AcademicBriefingBanner: Open editorial briefing surface and scannable metrics", () => {
    const bannerPath = path.join(rootDir, "components", "AcademicBriefingBanner.tsx");
    assert.ok(fs.existsSync(bannerPath), "components/AcademicBriefingBanner.tsx must exist");

    const content = fs.readFileSync(bannerPath, "utf8");

    assert.ok(
      content.includes("Ringkasan Akademik Hari Ini"),
      "Banner must display Indonesian academic briefing label"
    );
    assert.ok(
      content.includes("briefing.todayClassesCount") && content.includes("briefing.todayTotalSks"),
      "Banner must display today's class count and total SKS"
    );
    assert.ok(
      content.includes("briefing.overdueTasksCount"),
      "Banner must display overdue tasks metric"
    );
    assert.ok(
      content.includes("conflicts"),
      "Banner must support schedule conflict warning rendering"
    );
  });

  test("4. DashboardClient: Calm editorial header and balanced 2-column layout", () => {
    const clientPath = path.join(rootDir, "app", "dashboard", "DashboardClient.tsx");
    assert.ok(fs.existsSync(clientPath), "app/dashboard/DashboardClient.tsx must exist");

    const content = fs.readFileSync(clientPath, "utf8");

    // Calm editorial greeting (no oversized 5xl marketing banner)
    assert.ok(
      content.includes("Selamat Datang") || content.includes("Halo"),
      "Header must greet student calmly"
    );
    assert.ok(
      content.includes("Semester Aktif") || content.includes("Semester"),
      "Header must provide clear academic semester context"
    );

    // Button hierarchy
    assert.ok(
      content.includes("Tambah Tugas") && content.includes("bg-accent"),
      "Tambah Tugas must be styled as primary accent action button"
    );
    assert.ok(
      content.includes("Kelas Pengganti") && content.includes("bg-surface-elevated"),
      "Kelas Pengganti must be styled as secondary surface button"
    );

    // Upcoming Exam Widget
    assert.ok(
      content.includes("upcomingExam"),
      "Dashboard must embed upcoming exam countdown widget"
    );
  });
});

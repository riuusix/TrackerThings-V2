import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test.describe("Product-Wide Anti-Slop UI/UX Redesign Suite", () => {
  test("1. Audit Deliverable: docs/ui-ux/anti-slop-audit.md exists with route inventory and slice roadmap", () => {
    const auditPath = path.join(rootDir, "docs", "ui-ux", "anti-slop-audit.md");
    assert.ok(fs.existsSync(auditPath), "docs/ui-ux/anti-slop-audit.md must exist");

    const content = fs.readFileSync(auditPath, "utf8");
    assert.ok(content.includes("Editorial Distinctive"), "Audit must reference DESIGN.md identity");
    assert.ok(content.includes("ENERGY 2 / RHYTHM 2 / MOTION 1"), "Audit must declare antislop dials");
    assert.ok(content.includes("Complete Route & Component Inventory"), "Audit must contain complete route inventory");
  });

  test("2. Hard Gate R-02 & R-20: Zero em-dashes in UI copy and tabular-nums discipline across redesigned views", () => {
    const targetFiles = [
      "components/ScheduleCard.tsx",
      "components/AcademicBriefingBanner.tsx",
      "components/ScheduleList.tsx",
      "components/TaskItem.tsx",
      "components/TaskList.tsx",
      "app/dashboard/DashboardClient.tsx",
      "app/profile/ProfileClient.tsx",
      "app/settings/SettingsClient.tsx",
      "app/matakuliah/MatakuliahClient.tsx",
      "app/ujian/UjianClient.tsx",
      "app/history/page.tsx",
    ];

    for (const relPath of targetFiles) {
      const fullPath = path.join(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const content = fs.readFileSync(fullPath, "utf8");

      // Strip code comments before checking for literal em-dash (—)
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      assert.ok(
        !withoutComments.includes("—"),
        `${relPath} must not contain literal em-dashes (—) in UI copy (antislop R-02)`
      );
      assert.ok(
        content.includes("tabular-nums"),
        `${relPath} must apply tabular-nums for numeric alignment (antislop R-20)`
      );
    }
  });

  test("3. Containment Restraint (R-14): Hairline dividers replace nested metric cards in Briefing, Profile, and Settings", () => {
    const briefingContent = fs.readFileSync(
      path.join(rootDir, "components", "AcademicBriefingBanner.tsx"),
      "utf8"
    );
    const profileContent = fs.readFileSync(
      path.join(rootDir, "app", "profile", "ProfileClient.tsx"),
      "utf8"
    );
    const settingsContent = fs.readFileSync(
      path.join(rootDir, "app", "settings", "SettingsClient.tsx"),
      "utf8"
    );

    assert.ok(
      briefingContent.includes("divide-x divide-line"),
      "AcademicBriefingBanner must use hairline dividers instead of nested metric boxes"
    );
    assert.ok(
      profileContent.includes("divide-x divide-line"),
      "ProfileClient must use hairline dividers for contact metadata strip"
    );
    assert.ok(
      settingsContent.includes("divide-x divide-line"),
      "SettingsClient must use hairline dividers for Catatan Aktivitas Akun"
    );
    assert.ok(
      !settingsContent.includes("bg-emerald-600"),
      "SettingsClient must use unified --accent primary buttons instead of mismatched green CTAs"
    );
  });

  test("4. Distinctive Page Architectures: Mata Kuliah vs. Jadwal Ujian vs. Riwayat Kelas", () => {
    const matkulContent = fs.readFileSync(
      path.join(rootDir, "app", "matakuliah", "MatakuliahClient.tsx"),
      "utf8"
    );
    const ujianContent = fs.readFileSync(
      path.join(rootDir, "app", "ujian", "UjianClient.tsx"),
      "utf8"
    );
    const historyContent = fs.readFileSync(
      path.join(rootDir, "app", "history", "page.tsx"),
      "utf8"
    );

    // Neither Matakuliah nor Ujian should use the generic 3-column equal card grid
    assert.ok(
      !matkulContent.includes("lg:grid-cols-3"),
      "MatakuliahClient must not use a generic 3-column equal card grid"
    );
    assert.ok(
      !ujianContent.includes("lg:grid-cols-3"),
      "UjianClient must not use a generic 3-column equal card grid"
    );

    // Matakuliah groups courses by day in a hairline-divided directory
    assert.ok(
      matkulContent.includes("groupedByDay") && matkulContent.includes("divide-y divide-line"),
      "MatakuliahClient must organize courses into a Day-Grouped Editorial Directory"
    );

    // Ujian partitions upcomingExams vs pastExams with countdown blocks
    assert.ok(
      ujianContent.includes("upcomingExams") && ujianContent.includes("pastExams"),
      "UjianClient must partition upcoming and past exams into chronological evaluation sections"
    );

    // History uses a unified archive ledger
    assert.ok(
      historyContent.includes("divide-y divide-line"),
      "HistoryPage must render a unified calm archive ledger"
    );
  });
});

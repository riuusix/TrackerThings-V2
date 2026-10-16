import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Phase 4 — Detail Views, CRUD Contracts & Profile Storage Audit", () => {
  it("provides PUT and DELETE endpoints for kelas-pengganti/[id] with auth & IDOR guards", () => {
    const routeSource = readRepoFile("app/api/kelas-pengganti/[id]/route.ts");

    assert.match(routeSource, /export async function PUT/);
    assert.match(routeSource, /export async function DELETE/);
    assert.match(routeSource, /getAuthSession\(req\)/);
    assert.match(routeSource, /existing\.userId !== session\.userId/);
    assert.match(routeSource, /id:\s*parsedJadwalId,\s*userId:\s*session\.userId/);
    assert.match(routeSource, /parseDateOnly/);
    assert.match(routeSource, /parseTimeToDate/);
    assert.match(routeSource, /apiSuccess/);
    assert.match(routeSource, /apiError/);
  });

  it("supports optional progress and status updates in PUT app/api/tugas/[id]/route.ts", () => {
    const tugasRoute = readRepoFile("app/api/tugas/[id]/route.ts");

    assert.match(tugasRoute, /body\.progress !== undefined/);
    assert.match(tugasRoute, /updateData\.progress = clamped/);
    assert.match(tugasRoute, /updateData\.status =/);
  });

  it("exposes full CRUD methods for KelasPengganti in TrackerDataService", () => {
    const serviceSource = readRepoFile("Sources/TrackerThings/Services/TrackerDataService.swift");

    assert.match(serviceSource, /func updateKelasPengganti\(_ item: KelasPenggantiItem\) async throws -> BaseResponse/);
    assert.match(serviceSource, /func deleteKelasPengganti\(id: Int\) async throws -> BaseResponse/);
    assert.match(serviceSource, /endpoint:\s*"kelas-pengganti\/\\\(item\.id\)"/);
    assert.match(serviceSource, /endpoint:\s*"kelas-pengganti\/\\\(id\)"/);
  });

  it("implements full CRUD and cache sync across CourseViewModel, ExamViewModel, and DashboardViewModel", () => {
    const courseVM = readRepoFile("Sources/TrackerThings/ViewModels/CourseViewModel.swift");
    const examVM = readRepoFile("Sources/TrackerThings/ViewModels/ExamViewModel.swift");
    const dashboardVM = readRepoFile("Sources/TrackerThings/ViewModels/DashboardViewModel.swift");

    // CourseViewModel
    assert.match(courseVM, /@discardableResult\s+public func deleteCourse\(id: Int\) async -> Bool/);
    assert.match(courseVM, /LocalCacheService\.shared\.save\(courses,\s*forKey:\s*LocalCacheService\.keyJadwal\)/);

    // ExamViewModel
    assert.match(examVM, /@discardableResult\s+public func deleteExam\(id: Int\) async -> Bool/);
    assert.match(examVM, /LocalCacheService\.shared\.save\(exams,\s*forKey:\s*LocalCacheService\.keyUjian\)/);

    // DashboardViewModel
    assert.match(dashboardVM, /public var allExams:\s*\[UjianItem\]/);
    assert.match(dashboardVM, /public var editingTask:\s*TugasItem\?/);
    assert.match(dashboardVM, /public var editingReplacement:\s*KelasPenggantiItem\?/);
    assert.match(dashboardVM, /dataService\.updateTugas\(updatedTask\)/);
    assert.match(dashboardVM, /dataService\.updateKelasPengganti\(updatedKP\)/);
    assert.match(dashboardVM, /dataService\.deleteKelasPengganti\(id:\s*id\)/);
    assert.match(dashboardVM, /public func markReplacementCompletedById\(_ id:\s*Int\) async -> Bool/);
  });

  it("provides native Detail Views for Course, Task, Exam, and ReplacementClass with destructive confirmations", () => {
    const courseDetail = readRepoFile("Sources/TrackerThings/Views/Courses/CourseDetailView.swift");
    const taskDetail = readRepoFile("Sources/TrackerThings/Views/Tasks/TaskDetailView.swift");
    const examDetail = readRepoFile("Sources/TrackerThings/Views/Exams/ExamDetailView.swift");
    const kpDetail = readRepoFile("Sources/TrackerThings/Views/Dashboard/ReplacementClassDetailView.swift");

    // CourseDetailView shows related Tasks, Exams, and ReplacementClasses
    assert.match(courseDetail, /public struct CourseDetailView:\s*View/);
    assert.match(courseDetail, /TaskDetailView\(/);
    assert.match(courseDetail, /ExamDetailView\(/);
    assert.match(courseDetail, /ReplacementClassDetailView\(/);
    assert.match(courseDetail, /\.confirmationDialog\(/);
    assert.match(courseDetail, /OfflineBannerView/);
    assert.match(courseDetail, /ContentUnavailableView/);

    // TaskDetailView
    assert.match(taskDetail, /public struct TaskDetailView:\s*View/);
    assert.match(taskDetail, /updateTaskProgress/);
    assert.match(taskDetail, /TaskFormSheet\(viewModel:\s*viewModel\)/);
    assert.match(taskDetail, /\.confirmationDialog\(/);
    assert.match(taskDetail, /deleteTask\(id:\s*task\.id\)/);

    // ExamDetailView
    assert.match(examDetail, /public struct ExamDetailView:\s*View/);
    assert.match(examDetail, /ExamFormSheet\(viewModel:\s*viewModel\)/);
    assert.match(examDetail, /\.confirmationDialog\(/);
    assert.match(examDetail, /deleteExam\(id:\s*exam\.id\)/);

    // ReplacementClassDetailView
    assert.match(kpDetail, /public struct ReplacementClassDetailView:\s*View/);
    assert.match(kpDetail, /markReplacementCompletedById\(kp\.id\)/);
    assert.match(kpDetail, /KelasPenggantiFormSheet\(viewModel:\s*viewModel\)/);
    assert.match(kpDetail, /\.confirmationDialog\(/);
    assert.match(kpDetail, /deleteKelasPengganti\(id:\s*kp\.id\)/);
  });

  it("wires NavigationLink to detail views in CourseListView, ExamListView, and DashboardView", () => {
    const courseList = readRepoFile("Sources/TrackerThings/Views/Courses/CourseListView.swift");
    const examList = readRepoFile("Sources/TrackerThings/Views/Exams/ExamListView.swift");
    const dashboard = readRepoFile("Sources/TrackerThings/Views/Dashboard/DashboardView.swift");

    assert.match(courseList, /CourseDetailView\(/);
    assert.match(examList, /ExamDetailView\(/);
    assert.match(dashboard, /CourseDetailView\(/);
    assert.match(dashboard, /TaskDetailView\(/);
    assert.match(dashboard, /ExamDetailView\(/);
    assert.match(dashboard, /ReplacementClassDetailView\(/);
  });

  it("preserves adaptive Pengguna identity fallback and does not store Base64 profile photos", () => {
    const badgeSource = readRepoFile("Sources/TrackerThings/Views/Components/UserAccountStatusBadge.swift");
    const editProfileSource = readRepoFile("Sources/TrackerThings/Views/Settings/EditProfileView.swift");

    assert.match(badgeSource, /return "Pengguna"/);
    assert.doesNotMatch(badgeSource, /return "Mahasiswa"/);
    assert.doesNotMatch(editProfileSource, /base64EncodedString/);
  });
});

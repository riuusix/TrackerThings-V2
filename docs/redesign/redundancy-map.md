# TrackerThings V2 — Redundancy & Duplication Map (`redundancy-map.md`)

**Repository:** `riuusix/TrackerThings-V2`  
**Baseline Commit:** `78c9c6939ad9bc382aac8a31a2b3e7de3c3e214c`  
**Audit Date:** 2026-11-12  

---

## 1. Network & Data-Fetching Redundancies

### 1.1 Duplicate Full-Dashboard Refetches on Single-Task Mutations (iOS)
- **Location**: `Sources/TrackerThings/ViewModels/DashboardViewModel.swift` (`updateTaskProgress`, `saveTask`, `deleteTask`).
- **Symptom**: Updating a single task's progress (e.g., tapping `50%` or `100%`) calls `await loadDashboardData()`, which fires **5 HTTP GET requests** (`/api/jadwal`, `/api/tugas`, `/api/ujian`, `/api/kelas-pengganti`, `/api/intelligence/academic`).
- **Resolution**: Patch the mutated `TugasItem` in-place inside `DashboardViewModel` (`urgentTasks` / `completedTasks`) and `TrackerDataService`'s user-scoped cache, and recompute local notifications/urgency without re-downloading unchanged courses, exams, and replacement classes.

### 1.2 Duplicate Cross-Tab Fetches on Tab Switching (iOS)
- **Location**: `RootTabView.swift`, `DashboardView.swift`, `CourseListView.swift`, `ExamListView.swift`.
- **Symptom**:
  - `DashboardView.task` fetches `getJadwalList()`, `getTugasList()`, `getUjianList()`, `getKelasPenggantiList()`.
  - Switching to the `Jadwal` (`CourseListView`) tab immediately invokes `courseViewModel.fetchCourses()` → `getJadwalList()`, hitting `/api/jadwal` a second time even if it was fetched `< 1s` ago.
  - Switching to the `Ujian` (`ExamListView`) tab immediately invokes `examViewModel.fetchExams()` → `getUjianList()`, hitting `/api/ujian` a second time.
  - Returning app to foreground triggers `RootTabView.onChange(of: scenePhase)` AND view `.task` simultaneously without in-flight request coalescing.
- **Resolution**:
  - Implement **In-Flight GET Request Coalescing** in `NetworkService` so concurrent identical GET requests share the same flight.
  - Implement **User-Scoped Memory + Disk TTL Cache** in `TrackerDataService` (default 30s fresh TTL) so switching tabs reuses fresh cached data instantaneously (`0ms` network overhead) unless explicitly pull-to-refreshed (`forceRefresh: true`) or invalidated by a mutation.

### 1.3 Redundant Database Queries in Academic Intelligence Endpoint (Backend)
- **Location**: `app/api/intelligence/academic/route.ts` vs `app/dashboard/page.tsx`.
- **Symptom**: When `/api/intelligence/academic` is called rapidly with the same `(userId, referenceDate, timezone, upcomingWindowDays)`, it executes 4 parallel Prisma queries (`tugas`, `ujian`, `jadwal`, `kelasPengganti`) every time without server-side per-user memoization.
- **Resolution**: Add a lightweight user-scoped server memory cache (`lib/serverCache.ts`, 20s TTL invalidated on any task/course/exam/replacement mutation) so repeated intelligence requests within the same dashboard session return in `< 2ms`.

### 1.4 Unthrottled Range Slider Revalidation Storms (Web)
- **Location**: `components/TaskItem.tsx` (`onChange` on `<input type="range">`) → `app/actions/tugas.ts` (`updateTugasProgressAction` → `revalidatePath("/dashboard")`).
- **Symptom**: Dragging the task progress slider from `0%` to `75%` fires `onChange` up to 15 times (`5, 10, 15, ..., 75`), triggering 15 server actions and 15 full `/dashboard` SSR revalidations.
- **Resolution**: Update `progress` state locally on `onChange` for 60fps visual feedback, and commit the server mutation only on pointer/keyboard release (`onPointerUp` / `onTouchEnd` / `onKeyUp` / debounced commit) paired with `lib/requestCache.ts` optimistic cache update.

---

## 2. UI, Navigation & Visual Structure Redundancies

### 2.1 Unbounded Vertical Task Stacks on Dashboard & History (Web & iOS)
- **Location**:
  - Web: `components/TaskList.tsx` (renders all `urgentTasks` and all `completedTasks` in one tall vertical stack).
  - iOS: `Sources/TrackerThings/Views/Dashboard/DashboardView.swift` (lines 382–387 `pinnedTasks` and lines 436–441 `unpinnedUrgentTasks`).
- **Symptom**: When a student has 8–15 active or completed tasks, the Dashboard becomes a long, repetitive wall of identical cards that pushes `Kelas Pengganti` and other sections far below the fold.
- **Resolution**: Replace unbounded vertical task lists with **Invisible Pagination (`InvisibleTaskDeck` on Web, `InvisibleTaskPager` on iOS)** capped at **at most 3 tasks per group/page**, with horizontal swipe + compact inline deck navigation (`1 / N` + prev/next controls).

### 2.2 Missing `isPinned` Split & Pin Action on Web Dashboard
- **Location**: `app/dashboard/page.tsx` (lines 169–188), `types/index.ts`, `components/TaskList.tsx`, `components/TaskItem.tsx`.
- **Symptom**: Although `prisma/schema.prisma` and `app/api/tugas/route.ts` support `isPinned` (`is_pinned`) and iOS `DashboardView` separates `Disematkan` from `Daftar Tugas Aktif`, Web `app/dashboard/page.tsx` drops `isPinned` when mapping tasks and `TaskList.tsx` mixes pinned and unpinned tasks together.
- **Resolution**: Map `isPinned` and `reminderAt` in `app/dashboard/page.tsx` and `types/index.ts`, separate `Disematkan` (max 3 per page) and `Daftar Tugas Aktif` (max 3 per page) in `TaskList.tsx`, and add one-tap Pin/Unpin support on Web task cards.

### 2.3 Stock Tab Bar Chrome Competing with Floating Interactive Layer (iOS)
- **Location**: `Sources/TrackerThings/Views/RootTabView.swift`.
- **Symptom**: Stock `UITabBar` spans edge-to-edge at the bottom while `GooeyActionDock` floats above it, creating two different visual languages (flat system bar vs. floating tactile bubble).
- **Resolution**: Hide the stock tab barchrome and replace it with the floating **`FrostedGlideTabBar`** capsule housing all 5 canonical tabs (`Beranda`, `Jadwal`, `Tugas`, `Ujian`, `Profil`), coordinated in safe-area space with `GooeyActionDock`.

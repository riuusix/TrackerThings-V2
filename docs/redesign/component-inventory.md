# TrackerThings V2 — Component & Architecture Inventory (`component-inventory.md`)

**Repository:** `riuusix/TrackerThings-V2`  
**Baseline Commit:** `78c9c6939ad9bc382aac8a31a2b3e7de3c3e214c`  
**Audit Date:** 2026-11-12  

---

## 1. Web Application Inventory (Next.js App Router + Prisma)

### 1.1 Pages & Server Components

| File | Responsibility | Current Data Fetching Strategy | Identified Bottlenecks / Issues |
|---|---|---|---|
| `app/dashboard/page.tsx` | Main academic dashboard SSR page | `Promise.all` with 5 Prisma queries (`user`, `jadwal`, `kelasPengganti`, `ujian`, `tugas`) | Fetches all tasks (active + completed) unbounded; omits `isPinned` and `reminderAt` when mapping `allTasks` to `TugasItem`; full SSR re-render triggered via `revalidatePath("/dashboard")` on every single task progress slider tick. |
| `app/dashboard/DashboardClient.tsx` | Client shell for Dashboard | Receives SSR props; manages `TaskModal` & `KelasPenggantiModal` | Does not maintain a client-side optimistic store or user-scoped request cache; relies on full page revalidation for task mutations. |
| `app/history/page.tsx` | Replacement class archive page | `Promise.all` (`kelasPengganti`, `user`) | Only displays replacement class history; completed tasks (`Riwayat Tugas`) are buried at the bottom of the right column on `/dashboard` without search, filter, sort, or URL pagination. |
| `app/matakuliah/page.tsx` & `MatakuliahClient.tsx` | Course schedule management | SSR initial load + Server Actions | Full route revalidation on single course edit. |
| `app/ujian/page.tsx` & `UjianClient.tsx` | Exam schedule management | SSR initial load + Server Actions | Full route revalidation on single exam mutation. |
| `app/profile/page.tsx` & `ProfileClient.tsx` | User profile & security settings | SSR initial load + `/api/profile` | Clean editorial layout already aligned with `DESIGN.md`. |

### 1.2 Reusable Web UI Components

| Component | File | Current Role | Redesign Action |
|---|---|---|---|
| `Navbar` | `components/Navbar.tsx` | Sticky top bar with centered desktop links, notification popover, theme toggle, profile menu | Preserve editorial structure; ensure cache purge hook runs on logout (`logoutAction`). |
| `TaskList` | `components/TaskList.tsx` | Renders `urgentTasks` vertically and a collapsible `completedTasks` list | **Redesign with `InvisibleTaskDeck`**: Split active tasks into `Disematkan` (Pinned) and `Prioritas & Tugas Aktif` (Unpinned), each capped at **max 3 tasks per deck page** with horizontal swipe + inline pagination. Upgrade `Riwayat Tugas Selesai` with search, filter (course/priority), sort, URL query sync, and 3-per-page invisible pagination. |
| `TaskItem` | `components/TaskItem.tsx` | Individual task card with completion checkbox, metadata, edit/delete buttons, and range slider | Add Pin/Unpin toggle button, commit slider progress on release (`onMouseUp`/`onTouchEnd`/`onKeyUp`) with optimistic single-task cache update instead of spamming server revalidations on every drag pixel. |
| `ScheduleList` & `ScheduleCard` | `components/ScheduleList.tsx`, `components/ScheduleCard.tsx` | Day-tabbed schedule list | Keep cohesive Soft Blue Editorial styling. |
| `AcademicBriefingBanner` | `components/AcademicBriefingBanner.tsx` | Explainable daily academic intelligence summary | Keep clean banner hierarchy. |

### 1.3 Backend API Routes & Database Schema

| File | Endpoints / Models | Current Behavior | Redesign Action |
|---|---|---|---|
| `prisma/schema.prisma` | `User`, `Jadwal`, `Tugas`, `Ujian`, `KelasPengganti`, `Announcement`, `AdminLog`, `SystemSetting` | **0 secondary or composite indexes defined** (`@@index` absent on all tables). | Add composite B-tree indexes matching all `WHERE` + `ORDER BY` access patterns and safe SQL migration `prisma/migrations/20261112_add_performance_indexes.sql`. |
| `app/api/tugas/route.ts` | `GET`, `POST`, `PATCH /api/tugas` | `GET` always returns all tasks for `userId` with no pagination or filtering. | Support optional `status`, `pinned`, `prioritas`, `idJadwal`, `q` (search), `sort`, `page`, `limit`, and `cursor` query parameters + pagination metadata (`pagination: { page, limit, totalCount, totalPages, hasMore, nextCursor }`) while keeping 100% backward compatibility (`data` array + `tasks` array). |
| `app/api/intelligence/academic/route.ts` | `GET /api/intelligence/academic` | Re-queries `tugas`, `ujian`, `jadwal`, and `kelasPengganti` on every call. | Add short-lived per-user server response caching / ETag / Cache-Control and client-side SWR caching. |

---

## 2. Native iOS Application Inventory (`Sources/TrackerThings/`)

### 2.1 Navigation & Root Container

| File | Component | Current Behavior | Redesign Action |
|---|---|---|---|
| `Sources/TrackerThings/Navigation/AppRoute.swift` | `AppRoute`, `AppTab` | `AppTab` has 4 cases (`.home`, `.courses`, `.exams`, `.settings`). | Expand `AppTab` to the 5 canonical tabs: `.home` (`Beranda`), `.courses` (`Jadwal`), `.tasks` (`Tugas`), `.exams` (`Ujian`), `.settings` (`Profil`), preserving all existing route & notification contracts. |
| `Sources/TrackerThings/Navigation/AppNavigationCoordinator.swift` | `AppNavigationCoordinator` | Manages `selectedTab` and per-tab `NavigationPath` (`homePath`, `coursesPath`, `examsPath`, `settingsPath`). | Add `tasksPath = NavigationPath()` for the dedicated `Tugas` tab while preserving cold-start queuing, deep links, and notification deduplication. |
| `Sources/TrackerThings/Views/RootTabView.swift` | `RootTabView` | Uses stock iOS `TabView` tab bar with `GooeyActionDock`, `MorphingQuickComposer`, and `FlyToInboxOverlay`. | Replace stock tab bar chrome with custom floating **`FrostedGlideTabBar`** capsule while keeping `TabView` state preservation, independent `NavigationStack`s, and safe-area coordination with `GooeyActionDock`. |

### 2.2 Views & Interactive Components

| File | Component | Current Behavior | Redesign Action |
|---|---|---|---|
| `Sources/TrackerThings/Views/Dashboard/DashboardView.swift` | `DashboardView` | Renders all `pinnedTasks` and all `unpinnedUrgentTasks` in unbounded vertical `LazyVStack`s; does not surface completed task history. | Integrate **`InvisibleTaskPager`** (max 3 tasks per group/page) for `Disematkan`, `Daftar Tugas Aktif`, and a compact `Riwayat Tugas Selesai` deck. |
| `Sources/TrackerThings/Views/Tasks/TaskListView.swift` | *(Missing dedicated view)* | Currently tasks only live inside `DashboardView`. | Create `Sources/TrackerThings/Views/Tasks/TaskListView.swift` for the `Tugas` tab featuring Active Tasks (`Disematkan` & `Prioritas Mendesak`) and `Riwayat Tugas` (Completed Tasks) with search, course/priority filter, sort, and `InvisibleTaskPager` (max 3 per page) that preserves page state when returning from `TaskDetailView`. |
| `Sources/TrackerThings/Views/Components/GooeyActionDock.swift` | `GooeyActionDock`, `QuickActionDockController` | Uses boolean `isExpanded` with simultaneous scale/offset transition and static `GooeyDockBridgeShape`. | Reconstruct into multi-stage choreographed morph (`GooeyDockPhase`: press compression → bubble emergence → panel morph → staggered item reveal; reverse asymmetric close: items exit first → panel shrinks to bubble → clean `+` button). |
| `Sources/TrackerThings/Views/Components/SwipeableTaskRow.swift` | `SwipeableTaskRow`, `TaskSwipeCoordinator` | Horizontal row swipe for Pin (leading) and Reminder (trailing). | Preserve direction-locked row swipe and coordinate cleanly with `InvisibleTaskPager` deck controls. |
| `Sources/TrackerThings/Views/Components/TaskCardView.swift` | `TaskCardView` | Task card with completion ring, metadata pills, and expandable progress drawer. | Keep tactile progress ring and inline drawer; ensure single-item mutations update view model state in-place without full-dashboard reload storms. |

### 2.3 Data, Networking & Caching Services

| File | Service | Current Behavior | Redesign Action |
|---|---|---|---|
| `Sources/TrackerThings/Services/NetworkService.swift` | `NetworkService` (`actor`) | Executes raw `URLSession` requests; no in-flight GET request deduplication. | Add in-flight GET request coalescing keyed by `(userScope, method, endpoint)` so concurrent identical GETs share a single network flight. |
| `Sources/TrackerThings/Services/TrackerDataService.swift` | `TrackerDataService` (`actor`) | Calls `network.request` on every invocation and writes to global `LocalCacheService` keys. | Add user-scoped memory + disk TTL cache with stale-while-revalidate, targeted single-entity cache patching on task mutations, and explicit `forceRefresh` support. |
| `Sources/TrackerThings/Services/LocalCacheService.swift` | `LocalCacheService` | Saves JSON files using static global keys (`cached_jadwal_list.json`, `cached_tugas_list.json`). | Scope cache keys by active `userId` (`user_<id>_<key>`) to prevent cross-account cache bleed, with TTL validation and full user cache purge on logout. |
| `Sources/TrackerThings/ViewModels/DashboardViewModel.swift` | `DashboardViewModel` | Calls `await loadDashboardData()` (5 parallel HTTP requests) after `updateTaskProgress`, `saveTask`, and `deleteTask`. | Update `updateTaskProgress`, `toggleTaskPin`, `updateTaskCustomReminder`, `saveTask`, and `deleteTask` to patch local state and `TrackerDataService` cache in-place, only refreshing Academic Intelligence locally or selectively. |

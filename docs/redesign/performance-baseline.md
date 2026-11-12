# TrackerThings V2 — Performance Baseline & Optimization Targets (`performance-baseline.md`)

**Repository:** `riuusix/TrackerThings-V2`  
**Baseline Commit:** `78c9c6939ad9bc382aac8a31a2b3e7de3c3e214c`  
**Audit Date:** 2026-11-12  

---

## 1. Baseline Architecture Audit Findings

### 1.1 Database Index Audit (`prisma/schema.prisma`)
Inspection of `prisma/schema.prisma` (lines 10–132) and `prisma/migrations/` confirmed that **zero secondary or composite B-tree indexes (`@@index`)** were defined on any application table:

| Table | High-Frequency Query Pattern | Baseline Index State | Impact |
|---|---|---|---|
| `tugas` | `WHERE user_id = $1 ORDER BY deadline ASC` | **None** (PK `id` only) | Sequential scan + in-memory sort on every Dashboard & API call. |
| `tugas` | `WHERE user_id = $1 AND status = $2 AND is_pinned = $3 ORDER BY deadline ASC` | **None** | Sequential scan when filtering active/completed/pinned tasks. |
| `tugas` | `WHERE id_jadwal = $1` (JOIN / cascade delete) | **None** | Unindexed foreign key lookup on course join & delete. |
| `jadwal` | `WHERE user_id = $1 ORDER BY hari ASC, waktu_mulai ASC` | **None** (PK `id` only) | Sequential scan on every schedule fetch and task/exam ownership check. |
| `ujian` | `WHERE user_id = $1 AND tanggal >= $2 ORDER BY tanggal ASC, waktu_mulai ASC` | **None** (PK `id` only) | Sequential scan on upcoming exam queries. |
| `kelas_pengganti` | `WHERE user_id = $1 AND status != 'Selesai' ORDER BY tanggal ASC, waktu_mulai ASC` | **None** (PK `id` only) | Sequential scan on active replacement class queries and history archive. |
| `announcements` | `WHERE is_active = true ORDER BY created_at DESC` | **None** (PK `id` only) | Sequential scan on active announcement lookup. |

### 1.2 API & Client Request Baseline Metrics (Before Redesign)

| Metric | Web Baseline (Before) | Native iOS Baseline (Before) | Root Cause |
|---|---|---|---|
| **HTTP Requests on Initial Dashboard Open** | 1 SSR document (5 Prisma queries) | **5–10 HTTP GET requests** (`loadDashboardData()` triggered by `.task` AND `scenePhase == .active` concurrently) | No in-flight GET request coalescing in `NetworkService`. |
| **HTTP Requests When Switching Across All 5 Tabs (`Home → Jadwal → Tugas → Ujian → Profil`)** | 4 full SSR route fetches | **8 HTTP GET requests** (`Dashboard`: 5, `Courses`: 1, `Exams`: 1, `Profile`: 1) | `CourseListView` and `ExamListView` re-fetch `/api/jadwal` and `/api/ujian` without checking a user-scoped TTL cache. |
| **HTTP Requests on Single Task Progress Update (`25% → 50%`)** | 1 POST action + full `/dashboard` SSR re-query (5 Prisma queries) | **1 PATCH + 5 GET requests** (`updateTaskProgress` calls `await loadDashboardData()`) | Full dashboard refetch instead of targeted single-item cache patching. |
| **Slider Drag (`0% → 75%` in 5% steps)** | Up to **15 Server Actions** + 15 SSR revalidations | 1 PATCH (on `onEditingChanged == false`) + 5 GETs | Web `<input type="range">` triggers server action on every `onChange` tick instead of committing on release. |
| **Task List Payload & DOM/View Count (User with 24 Active + 30 Completed Tasks)** | Renders **54 task cards** in DOM (`100%` of tasks fetched at once) | Renders **24 active task rows** simultaneously in `DashboardView` | No invisible pagination (3-per-group cap) and no server-side pagination parameters on `GET /api/tugas`. |
| **Cross-Account Cache Isolation on Device** | Browser session cookie only | **Global static files** (`cached_jadwal_list.json`, `cached_tugas_list.json`) | `LocalCacheService` keys were not namespaced by `userId`. |

---

## 2. Database & API Optimization Plan (Phase B & Phase E)

### 2.1 Composite PostgreSQL Indexes Added
1. `tugas`:
   - `@@index([userId, status, isPinned, deadline], map: "idx_tugas_user_status_pinned_deadline")`
   - `@@index([userId, deadline], map: "idx_tugas_user_deadline")`
   - `@@index([idJadwal], map: "idx_tugas_id_jadwal")`
2. `jadwal`:
   - `@@index([userId, hari, waktuMulai], map: "idx_jadwal_user_hari_waktu")`
   - `@@index([userId, waktuMulai], map: "idx_jadwal_user_waktu")`
3. `ujian`:
   - `@@index([userId, tanggal, waktuMulai], map: "idx_ujian_user_tanggal_waktu")`
   - `@@index([idJadwal], map: "idx_ujian_id_jadwal")`
4. `kelas_pengganti`:
   - `@@index([userId, status, tanggal, waktuMulai], map: "idx_kelas_pengganti_user_status_tanggal")`
   - `@@index([idJadwal], map: "idx_kelas_pengganti_id_jadwal")`
5. `announcements`:
   - `@@index([isActive, createdAt], map: "idx_announcements_active_created")`

### 2.2 Server-Side Pagination & Filtering on `GET /api/tugas`
- Supports query parameters:
  - `status`: `"active"` (not Selesai), `"completed"` (`Selesai`), or exact status string
  - `pinned`: `"true"` | `"false"`
  - `prioritas`: `"Tinggi"` | `"Sedang"` | `"Rendah"`
  - `idJadwal`: course ID filter
  - `q`: case-insensitive search on `namaTugas` or course `namaMatkul`
  - `sort`: `"deadline_asc"` | `"deadline_desc"` | `"priority_desc"` | `"progress_desc"`
  - `page` (1-based) & `limit` (e.g. `3`, `9`, `12`, max `100`) or `cursor` (task ID)
- Returns backward-compatible `data: [...]` and `tasks: [...]` plus structured `pagination: { page, limit, totalCount, totalPages, hasMore, nextCursor }`.

### 2.3 Client & Server Caching Architecture
- **Web (`lib/requestCache.ts`)**:
  - In-flight GET request deduplication (`inFlightRequests` Map).
  - User-scoped memory + `sessionStorage` cache (`tt_cache_v2:${userId}:${key}`) with resource TTL (`30s` fresh, `120s` stale-while-revalidate).
  - Selective next-page prefetch (`prefetchNextPage`) for Invisible Pagination decks.
  - Optimistic single-task cache patching (`patchCachedTask`, `removeCachedTask`) so updating progress, pinning, or deleting a task updates the UI immediately without refetching all dashboard resources.
  - Full user cache purge (`clearUserCache`) on logout.
- **iOS (`NetworkService.swift`, `TrackerDataService.swift`, `LocalCacheService.swift`)**:
  - Actor-isolated in-flight GET request coalescing in `NetworkService` (`inFlightGETTasks: [String: Task<(Data, URLResponse), Error>]`).
  - User-scoped memory + disk cache in `TrackerDataService` & `LocalCacheService` (`user_<userId>_<resource>`), preventing cross-account data leaks and eliminating redundant network calls on tab switches.
  - Single-task mutation patching in `DashboardViewModel` and `TrackerDataService` (eliminating the 5-endpoint `loadDashboardData()` storm after progress updates).

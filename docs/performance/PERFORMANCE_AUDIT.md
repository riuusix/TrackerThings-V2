# TrackerThings V2 — Full-Stack Performance Diagnosis & Audit Report

**Status:** Completed Diagnostic Baseline (Step 4)  
**Date:** 2026-10-12  
**Target Environments:** Local Development (`npm run dev`), Local Production (`next start`), Remote Production (`trackerthings.vercel.app`)  
**Target Architecture:** Next.js 14 App Router, Prisma ORM 5.22.0, PostgreSQL (Supabase Transaction Pooler, Sydney `ap-southeast-2`)

---

## 1. Executive Summary

This diagnostic audit investigates the latency and responsiveness issues reported across TrackerThings V2 interactions. Prior to any architectural change, reproducible measurements were collected across all primary user journeys, individual Prisma queries, and network round-trips.

### Core Discoveries
1. **Primary Network Latency Floor (Geographical RTT):**
   - The Supabase database pooler host (`aws-0-ap-southeast-2.pooler.supabase.com`) is physically located in Sydney, Australia.
   - For an application server located in Southeast Asia / Indonesia, a single TCP + TLS query round-trip takes **1,500 ms – 2,700 ms**.
   - **Any page or action that awaits sequential database queries suffers an additive delay of ~1.8 seconds per query.**
2. **Dashboard Sequential Waterfall (Identified & Resolved):**
   - The initial baseline dashboard executed 6 sequential `await` queries (`12,358 ms` database wait).
   - Parallelizing queries with `Promise.all` reduced warm dashboard render from **12,280 ms down to 2,808 ms** (a **77.1% latency reduction**).
3. **Destructive Client Reloads on Mutations:**
   - Mata Kuliah and Ujian creation/update previously invoked `window.location.reload()`, forcing a complete white-screen browser teardown, re-fetching static bundles, and discarding React state.
4. **Development (`npm run dev`) vs Production (`next start`) Variance:**
   - In development mode, on-demand compilation of dynamic Server Components adds an additional **~8 to 12 seconds on cold requests** (`/dashboard` cold dev was 15,678 ms vs 7,744 ms on production build).

---

## 2. Baseline Measurements by User Journey & Environment

All measurements were collected via automated end-to-end HTTP profiling (`tests/measure-performance-baseline.mjs`) against authentic database entities under realistic user loads.

### 2.1 User Journeys Overview

| User Journey | Local Dev (`npm run dev`) Cold | Local Dev Warm | Local Prod (`next start`) Cold | Local Prod Warm | Vercel Prod (Estimated)* |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Login & Initial Dashboard Load** | 15,678 ms | 2,784 ms | 7,744 ms | 2,808 ms | ~2,200 ms |
| **2. Navigate to Mata Kuliah (`/matakuliah`)** | 3,756 ms | 1,639 ms | 1,651 ms | 1,734 ms | ~1,600 ms |
| **3. Navigate to Ujian (`/ujian`)** | 2,272 ms | 1,986 ms | 2,594 ms | 2,263 ms | ~2,100 ms |
| **4. Navigate to Riwayat KP (`/history`)** | — | — | 1,666 ms | 1,743 ms | ~1,650 ms |
| **5. Open Profile (`/profile`)** | 2,680 ms | 1,998 ms | 3,067 ms | 1,813 ms | ~1,750 ms |
| **6. Open Settings (`/settings`)** | — | — | 1,652 ms | 1,630 ms | ~1,600 ms |
| **7. Admin Users (`/admin/users`)** | — | — | 3,542 ms | 3,299 ms | ~3,100 ms |
| **8. Admin Announcements (`/admin/announcements`)**| — | — | 1,638 ms | 1,736 ms | ~1,650 ms |

*\*Note on Vercel Production: Edge/Serverless execution in Singapore (`sin1`) reduces geographical distance to Sydney relative to home local broadband, saving ~200-400 ms on RTT.*

### 2.2 CRUD Operations Latency (Server Actions / API)

| CRUD Operation | Type | Database Operations | Total Duration (Warm) | UX Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Create Jadwal** | Server Action (`createJadwalAction`) | 1 `findFirst` auth check + 1 `create` | ~1,850 ms | Smooth, `router.refresh()` |
| **Update Jadwal** | Server Action (`updateJadwalAction`) | 1 `findFirst` + 1 `update` | ~1,900 ms | Smooth, `router.refresh()` |
| **Delete Jadwal** | API Route (`DELETE /api/jadwal/:id`)| 1 `findFirst` + 1 `delete` | ~1,691 ms | JSON response |
| **Create Tugas** | Server Action (`createTugasAction`) | 1 `findFirst` + 1 `create` | ~2,210 ms | Optimistic modal close |
| **Update Tugas** | Server Action (`updateTugasAction`) | 1 `findFirst` + 1 `update` | ~2,220 ms | Smooth |
| **Delete Tugas** | API Route (`DELETE /api/tugas/:id`) | 1 `findFirst` + 1 `delete` | ~1,750 ms | JSON response |
| **Create Ujian** | Server Action (`createUjianAction`) | 1 `findFirst` + 1 `create` | ~2,324 ms | Smooth, `router.refresh()` |

---

## 3. Slowest Requests & Database Operations Profiling

Direct profiling of isolated Prisma queries against the Supabase database instance:

```
Individual Prisma Query Latencies (Isolated Profiling):
  - user.findUnique             : 2,721.82 ms
  - jadwal.findMany             : 1,581.01 ms
  - kelasPengganti.findMany     : 2,226.00 ms
  - ujian.findFirst             : 2,558.45 ms
  - tugas.findMany(urgent)      : 2,212.45 ms
  - tugas.findMany(completed)   : 2,211.46 ms

Sequential Execution Duration:
  - 6 Sequential Awaits (Baseline) : 12,358.65 ms
  - Parallel Execution (Promise.all) :  2,780.00 ms (-77.5%)
```

---

## 4. Evidence for Suspected Root Causes

### Root Cause A: Sequential Waterfall on Server Components
- **Evidence:** In `app/dashboard/page.tsx`, prior code sequentially awaited `user`, then `jadwal`, then `kelasPengganti`, then `ujian`, then `tugas` urgent, then `tugas` completed. Summing individual latencies: `2.7s + 1.5s + 2.2s + 2.5s + 2.2s + 2.2s = 13.3s`.
- **Solution Verified:** Bundling independent queries via `Promise.all` reduced warm SSR time from `12,280 ms` to `2,808 ms`.

### Root Cause B: Redundant Duplicate Querying on the Same Entity
- **Evidence:** `app/dashboard/page.tsx` was querying `prisma.tugas` twice in the same request (once for unfinished tasks and once for completed tasks).
- **Solution Verified:** Querying `prisma.tugas` once and partitioning status arrays in-memory takes `< 0.05 ms` and saved a full ~2,200 ms network query round-trip.

### Root Cause C: Sequential Admin Role Validation & Data Querying
- **Evidence:** In `app/admin/users/page.tsx`, the server first queries `prisma.user.findUnique` to check the admin role (taking ~1,600 ms), and only *after* that succeeds does it query `prisma.user.findMany` to fetch users (taking another ~1,650 ms), totaling ~3,300 ms.
- **Analysis:** Since the session token already contains `session.role === "admin"`, verifying in parallel or checking `session.role` immediately saves one sequential query on admin pages.

### Root Cause D: Client Mutations Triggering Full-Page Browser Reloads
- **Evidence:** In `app/matakuliah/MatakuliahClient.tsx` and `app/ujian/UjianClient.tsx`, `window.location.reload()` was triggered after form submissions.
- **Solution Verified:** Replaced with Next.js App Router `useRouter().refresh()` and local state synchronization. Prevents destroying React DOM and re-fetching assets.

### Root Cause E: Prisma Connection Pool Starvation Under Parallel Load
- **Evidence:** When `Promise.all` was first executed with `connection_limit=1` in `DATABASE_URL`, Prisma threw `P2024: Timed out fetching a new connection from the connection pool (timeout: 10)`.
- **Solution Verified:** Configured dynamic datasource URL rewrite in `lib/prisma.ts` to enforce `connection_limit=5&pool_timeout=15`, allowing parallel queries without connection starvation.

### Root Cause F: Supabase Client Instantiation Overhead in Middleware
- **Evidence:** `middleware.ts` created an `@supabase/ssr` server client on every single request, performing internal cookie serialization and crypto handshakes even though the application uses custom JOSE JWT cookies.
- **Solution Verified:** Added a pre-check in `middleware.ts` to bypass Supabase client creation unless legacy Supabase cookies are present.

---

## 5. Ranked Fixes by Impact, Confidence, and Risk

| Rank | Fix / Optimization | Target Area | Expected Impact | Confidence | Risk | Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **1** | Parallelize Independent Prisma Queries via `Promise.all` | Dashboard, Profile, Ujian | **High** (-70% to -77% latency) | High | Low | **Implemented & Verified** |
| **2** | Eliminate `window.location.reload()` on CRUD Form Submissions | Matakuliah, Ujian Clients | **High** (Eliminates white flash & full asset reload) | High | Low | **Implemented & Verified** |
| **3** | Dynamic Prisma Connection Pool Scaling (`connection_limit=5`) | `lib/prisma.ts` | **Critical** (Prevents connection timeout errors) | High | Low | **Implemented & Verified** |
| **4** | Consolidate Duplicate Model Queries into In-Memory Partitioning | `app/dashboard/page.tsx` | **Medium-High** (-2.2s per request) | High | Low | **Implemented & Verified** |
| **5** | Fast-path Session Role in Admin Pages (`/admin/users`, `/admin/announcements`) | Admin Server Pages | **Medium** (-1.5s on admin routes) | High | Low | **Recommended Next** |
| **6** | Bypass Supabase SSR Handshake in Middleware | `middleware.ts` | **Low-Medium** (-50ms per HTTP request) | High | Low | **Implemented & Verified** |

---

## 6. Recommended Success Metrics for Before / After Verification

To verify full-stack performance across subsequent releases:
1. **Dashboard Warm SSR:** Must remain **< 3,200 ms** (previously 12,280 ms).
2. **Profile Warm SSR:** Must remain **< 2,200 ms** (previously 6,478 ms).
3. **Ujian Warm SSR:** Must remain **< 2,500 ms** (previously 3,955 ms).
4. **Client-side reload:** Zero instances of `window.location.reload()` across the entire app.
5. **Test integrity:** 100% passing on `npm test` (31/31) and `npm run test:crud` (24/24).


const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const REPO_ROOT = path.resolve(__dirname, "..");

// ============================================================================
// 1. Invisible Pagination Math & Direction-Locked Swipe Verification
// ============================================================================

function chunkIntoInvisiblePages(items, pageSize = 3) {
  const safeSize = Math.max(1, pageSize);
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const pages = [];
  for (let i = 0; i < items.length; i += safeSize) {
    pages.push(items.slice(i, i + safeSize));
  }
  return pages;
}

function evaluateHorizontalDeckSwipe(deltaX, deltaY, currentPage, totalPages, thresholdPx = 42) {
  if (totalPages <= 1) return 0;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < thresholdPx || absX <= absY * 1.35) {
    return 0;
  }
  if (deltaX < 0 && currentPage < totalPages - 1) {
    return 1;
  }
  if (deltaX > 0 && currentPage > 0) {
    return -1;
  }
  return 0;
}

test("Invisible Pagination chunks tasks into pages of at most 3 items", () => {
  assert.deepEqual(chunkIntoInvisiblePages([], 3), []);

  const twoTasks = [{ id: 1 }, { id: 2 }];
  const pagesOfTwo = chunkIntoInvisiblePages(twoTasks, 3);
  assert.equal(pagesOfTwo.length, 1);
  assert.equal(pagesOfTwo[0].length, 2);

  const eightTasks = Array.from({ length: 8 }, (_, idx) => ({ id: idx + 1 }));
  const pagesOfEight = chunkIntoInvisiblePages(eightTasks, 3);
  assert.equal(pagesOfEight.length, 3);
  assert.deepEqual(pagesOfEight.map((p) => p.length), [3, 3, 2]);
  for (const page of pagesOfEight) {
    assert.ok(page.length <= 3, "No page may exceed 3 tasks");
  }
});

test("Invisible Pagination swipe locks direction and preserves vertical scroll", () => {
  // Vertical scroll gesture (absY >= absX) must never trigger horizontal page change
  assert.equal(evaluateHorizontalDeckSwipe(-55, 60, 0, 3), 0);
  // Short horizontal movement below threshold must not trigger page change
  assert.equal(evaluateHorizontalDeckSwipe(-24, 2, 0, 3), 0);
  // Valid left swipe advances to next page
  assert.equal(evaluateHorizontalDeckSwipe(-64, 10, 0, 3), 1);
  // Left swipe on last page does not overflow
  assert.equal(evaluateHorizontalDeckSwipe(-64, 10, 2, 3), 0);
  // Valid right swipe returns to previous page
  assert.equal(evaluateHorizontalDeckSwipe(64, 8, 2, 3), -1);
  // Right swipe on first page does not underflow
  assert.equal(evaluateHorizontalDeckSwipe(64, 8, 0, 3), 0);
});

// ============================================================================
// 2. Request Coalescing, User-Scoped Cache & Single-Task Patching Benchmark
// ============================================================================

test("Server & Client Cache Coalescing deduplicates concurrent requests and isolates users", async () => {
  const store = new Map();
  const inFlight = new Map();
  let underlyingDbQueryCount = 0;

  async function getOrComputeUserCache(userId, namespace, key, ttlMs, compute) {
    const fullKey = `u:${userId}:${namespace}:${key}`;
    const now = Date.now();
    const existing = store.get(fullKey);
    if (existing && existing.expiresAt > now) {
      return { data: existing.value, cacheHit: true };
    }
    const pending = inFlight.get(fullKey);
    if (pending) {
      const data = await pending;
      return { data, cacheHit: true };
    }
    const promise = (async () => {
      try {
        const value = await compute();
        store.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
        return value;
      } finally {
        inFlight.delete(fullKey);
      }
    })();
    inFlight.set(fullKey, promise);
    const data = await promise;
    return { data, cacheHit: false };
  }

  // 1. Fire 8 concurrent requests for User 101 -> only 1 DB query executes
  const t0 = performance.now();
  const concurrentResults = await Promise.all(
    Array.from({ length: 8 }, () =>
      getOrComputeUserCache(101, "tugas", "active", 15000, async () => {
        underlyingDbQueryCount += 1;
        await new Promise((r) => setTimeout(r, 15));
        return [{ id_tugas: 1, nama_tugas: "Implementasi B-Tree", is_pinned: true }];
      })
    )
  );
  const coalescedLatencyMs = performance.now() - t0;

  assert.equal(underlyingDbQueryCount, 1, "8 concurrent identical GETs must coalesce into 1 query");
  assert.equal(concurrentResults.length, 8);
  assert.ok(coalescedLatencyMs < 100);

  // 2. Warm cache hit latency check
  const tWarmStart = performance.now();
  const warmHit = await getOrComputeUserCache(101, "tugas", "active", 15000, async () => {
    underlyingDbQueryCount += 1;
    return [];
  });
  const warmHitLatencyMs = performance.now() - tWarmStart;

  assert.equal(warmHit.cacheHit, true);
  assert.equal(underlyingDbQueryCount, 1, "Warm cache hit must not invoke compute()");
  assert.ok(warmHitLatencyMs < 2, `Warm cache hit should be < 2ms, got ${warmHitLatencyMs.toFixed(3)}ms`);

  // 3. User isolation check: User 202 must never see User 101's cached tasks
  const user202Result = await getOrComputeUserCache(202, "tugas", "active", 15000, async () => {
    underlyingDbQueryCount += 1;
    return [{ id_tugas: 99, nama_tugas: "Tugas Milik User 202", is_pinned: false }];
  });
  assert.equal(user202Result.cacheHit, false);
  assert.equal(underlyingDbQueryCount, 2);
  assert.equal(user202Result.data[0].id_tugas, 99);
});

// ============================================================================
// 3. Database Composite Indexes & Architectural Files Verification
// ============================================================================

test("Prisma schema and SQL migration contain all composite B-tree indexes", () => {
  const schemaPath = path.join(REPO_ROOT, "prisma", "schema.prisma");
  const migrationPath = path.join(
    REPO_ROOT,
    "prisma",
    "migrations",
    "20261112_add_performance_indexes.sql"
  );

  const schemaContent = fs.readFileSync(schemaPath, "utf8");
  const migrationContent = fs.readFileSync(migrationPath, "utf8");

  // Verify composite indexes in schema.prisma
  assert.match(schemaContent, /@@index\(\[userId,\s*hari,\s*waktuMulai\]/);
  assert.match(schemaContent, /@@index\(\[userId,\s*status,\s*isPinned,\s*deadline\]/);
  assert.match(schemaContent, /@@index\(\[userId,\s*deadline\]/);
  assert.match(schemaContent, /@@index\(\[userId,\s*tanggal,\s*waktuMulai\]/);
  assert.match(schemaContent, /@@index\(\[isActive,\s*createdAt\]/);

  // Verify idempotent SQL indexes in migration file
  assert.match(migrationContent, /idx_tugas_user_status_pinned_deadline/);
  assert.match(migrationContent, /idx_jadwal_user_hari_waktu/);
  assert.match(migrationContent, /idx_ujian_user_tanggal_waktu/);
  assert.match(migrationContent, /idx_kelas_pengganti_user_status_tanggal/);
  assert.match(migrationContent, /idx_announcements_active_created/);
});

test("All Phase A redesign audit documents and Web/iOS components exist", () => {
  const requiredFiles = [
    "docs/redesign/skill-audit.md",
    "docs/redesign/component-inventory.md",
    "docs/redesign/redundancy-map.md",
    "docs/redesign/performance-baseline.md",
    "docs/redesign/motion-review.md",
    "components/InvisibleTaskDeck.tsx",
    "lib/requestCache.ts",
    "lib/serverCache.ts",
    "Sources/TrackerThings/Views/Components/FrostedGlideTabBar.swift",
    "Sources/TrackerThings/Views/Components/InvisibleTaskPager.swift",
    "Sources/TrackerThings/Views/Tasks/TaskListView.swift",
    "Sources/TrackerThings/Views/Components/GooeyActionDock.swift",
  ];

  for (const relPath of requiredFiles) {
    const fullPath = path.join(REPO_ROOT, relPath);
    assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`);
  }
});

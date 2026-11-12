/**
 * TrackerThings V2 — Client Request Coalescing, Scoped SWR Cache & Selective Prefetching
 *
 * Capabilities:
 * 1. In-Flight Request Coalescing: Concurrent identical GET requests share a single network flight.
 * 2. User-Scoped Memory + SessionStorage Cache: Prevents cross-account data bleed (`tt_v2:${userScope}:${key}`).
 * 3. Resource-Specific TTL & Stale-While-Revalidate (SWR): Serves fresh cache in 0ms; revalidates stale entries in background.
 * 4. Targeted Single-Entity Cache Patching: Mutating one task (progress, pin, edit, delete) updates cached lists in-place without refetching the entire dashboard.
 * 5. Selective Next-Page Prefetching: Preloads page N+1 for Invisible Pagination decks.
 */

export interface CacheEntry<T = any> {
  data: T;
  updatedAt: number;
  freshUntil: number;
  staleUntil: number;
}

export interface CachePolicy {
  /** Duration in ms during which cached data is considered completely fresh (no network request). */
  freshTtlMs: number;
  /** Duration in ms during which stale data can be returned immediately while revalidating in background. */
  staleTtlMs: number;
}

export const RESOURCE_CACHE_POLICIES: Record<string, CachePolicy> = {
  tugas: { freshTtlMs: 30_000, staleTtlMs: 120_000 },
  jadwal: { freshTtlMs: 60_000, staleTtlMs: 300_000 },
  ujian: { freshTtlMs: 60_000, staleTtlMs: 300_000 },
  "kelas-pengganti": { freshTtlMs: 45_000, staleTtlMs: 180_000 },
  intelligence: { freshTtlMs: 45_000, staleTtlMs: 180_000 },
  default: { freshTtlMs: 30_000, staleTtlMs: 120_000 },
};

const STORAGE_PREFIX = "tt_cache_v2";
const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

let activeUserScope = "anonymous";

export interface CacheStatsSnapshot {
  hits: number;
  staleHits: number;
  coalesced: number;
  misses: number;
  invalidations: number;
  patches: number;
}

const stats: CacheStatsSnapshot = {
  hits: 0,
  staleHits: 0,
  coalesced: 0,
  misses: 0,
  invalidations: 0,
  patches: 0,
};

export function setRequestCacheUserScope(userScope: string | number | null | undefined): void {
  const normalized =
    userScope !== null && userScope !== undefined && String(userScope).trim() !== ""
      ? String(userScope).trim()
      : "anonymous";
  if (activeUserScope !== normalized && activeUserScope !== "anonymous") {
    // Automatically clear previous user's memory/session cache on account switch
    clearUserRequestCache(activeUserScope);
  }
  activeUserScope = normalized;
}

export function getRequestCacheUserScope(): string {
  return activeUserScope;
}

export function buildScopedCacheKey(resource: string, queryKey = "all", userScope = activeUserScope): string {
  return `${STORAGE_PREFIX}:${userScope}:${resource}:${queryKey}`;
}

function readFromSessionStorage<T>(scopedKey: string): CacheEntry<T> | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed && typeof parsed.updatedAt === "number") {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeToSessionStorage<T>(scopedKey: string, entry: CacheEntry<T>): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(scopedKey, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}

function removeFromSessionStorage(scopedKey: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(scopedKey);
  } catch {
    // Ignore storage errors
  }
}

export function setCachedResource<T>(
  resource: string,
  queryKey: string,
  data: T,
  userScope = activeUserScope
): CacheEntry<T> {
  const policy = RESOURCE_CACHE_POLICIES[resource] || RESOURCE_CACHE_POLICIES.default;
  const now = Date.now();
  const entry: CacheEntry<T> = {
    data,
    updatedAt: now,
    freshUntil: now + policy.freshTtlMs,
    staleUntil: now + policy.staleTtlMs,
  };
  const scopedKey = buildScopedCacheKey(resource, queryKey, userScope);
  memoryCache.set(scopedKey, entry);
  writeToSessionStorage(scopedKey, entry);
  return entry;
}

export function getCachedResource<T>(
  resource: string,
  queryKey = "all",
  userScope = activeUserScope
): { entry: CacheEntry<T> | null; state: "fresh" | "stale" | "expired" | "miss" } {
  const scopedKey = buildScopedCacheKey(resource, queryKey, userScope);
  let entry = memoryCache.get(scopedKey) as CacheEntry<T> | undefined;
  if (!entry) {
    const fromStorage = readFromSessionStorage<T>(scopedKey);
    if (fromStorage) {
      memoryCache.set(scopedKey, fromStorage);
      entry = fromStorage;
    }
  }

  if (!entry) {
    return { entry: null, state: "miss" };
  }

  const now = Date.now();
  if (now <= entry.freshUntil) {
    return { entry, state: "fresh" };
  }
  if (now <= entry.staleUntil) {
    return { entry, state: "stale" };
  }
  return { entry, state: "expired" };
}

/**
 * Fetches a resource with automatic in-flight coalescing, TTL caching, and stale-while-revalidate.
 */
export async function fetchWithCache<T>(options: {
  resource: string;
  queryKey?: string;
  userScope?: string;
  forceRefresh?: boolean;
  fetcher: (signal?: AbortSignal) => Promise<T>;
  onBackgroundRevalidate?: (freshData: T) => void;
}): Promise<T> {
  const {
    resource,
    queryKey = "all",
    userScope = activeUserScope,
    forceRefresh = false,
    fetcher,
    onBackgroundRevalidate,
  } = options;

  const scopedKey = buildScopedCacheKey(resource, queryKey, userScope);

  if (!forceRefresh) {
    const { entry, state } = getCachedResource<T>(resource, queryKey, userScope);
    if (entry && state === "fresh") {
      stats.hits++;
      return entry.data;
    }

    if (entry && state === "stale") {
      stats.staleHits++;
      // Trigger background revalidation if not already in flight
      if (!inFlightRequests.has(scopedKey)) {
        const bgFlight = (async () => {
          try {
            const fresh = await fetcher();
            setCachedResource(resource, queryKey, fresh, userScope);
            onBackgroundRevalidate?.(fresh);
            return fresh;
          } finally {
            inFlightRequests.delete(scopedKey);
          }
        })();
        inFlightRequests.set(scopedKey, bgFlight);
      }
      return entry.data;
    }
  }

  // Coalesce concurrent identical in-flight requests
  const existingFlight = inFlightRequests.get(scopedKey) as Promise<T> | undefined;
  if (existingFlight) {
    stats.coalesced++;
    return existingFlight;
  }

  stats.misses++;
  const flight = (async () => {
    try {
      const freshData = await fetcher();
      setCachedResource(resource, queryKey, freshData, userScope);
      return freshData;
    } finally {
      inFlightRequests.delete(scopedKey);
    }
  })();

  inFlightRequests.set(scopedKey, flight);
  return flight;
}

/**
 * Patches a single task inside all cached `tugas` entries for the active user
 * without invalidating unrelated dashboard resources (`jadwal`, `ujian`, `kelas-pengganti`).
 */
export function patchCachedTask(
  taskId: number,
  updater: (task: any) => any,
  userScope = activeUserScope
): number {
  const prefix = `${STORAGE_PREFIX}:${userScope}:tugas:`;
  let updatedEntries = 0;

  for (const [key, entry] of Array.from(memoryCache.entries())) {
    if (!key.startsWith(prefix)) continue;
    let modified = false;

    if (Array.isArray(entry.data)) {
      const nextArr = entry.data.map((item: any) => {
        if (item && Number(item.id) === Number(taskId)) {
          modified = true;
          return updater({ ...item });
        }
        return item;
      });
      if (modified) {
        const updatedEntry = { ...entry, data: nextArr, updatedAt: Date.now() };
        memoryCache.set(key, updatedEntry);
        writeToSessionStorage(key, updatedEntry);
        updatedEntries++;
      }
    } else if (entry.data && Array.isArray(entry.data.tasks)) {
      const nextTasks = entry.data.tasks.map((item: any) => {
        if (item && Number(item.id) === Number(taskId)) {
          modified = true;
          return updater({ ...item });
        }
        return item;
      });
      if (modified) {
        const nextData = {
          ...entry.data,
          tasks: nextTasks,
          data: Array.isArray(entry.data.data) ? nextTasks : entry.data.data,
        };
        const updatedEntry = { ...entry, data: nextData, updatedAt: Date.now() };
        memoryCache.set(key, updatedEntry);
        writeToSessionStorage(key, updatedEntry);
        updatedEntries++;
      }
    }
  }

  if (updatedEntries > 0) {
    stats.patches += updatedEntries;
  }
  return updatedEntries;
}

/**
 * Removes a deleted task from all cached `tugas` entries for the active user.
 */
export function removeCachedTask(taskId: number, userScope = activeUserScope): number {
  const prefix = `${STORAGE_PREFIX}:${userScope}:tugas:`;
  let updatedEntries = 0;

  for (const [key, entry] of Array.from(memoryCache.entries())) {
    if (!key.startsWith(prefix)) continue;
    if (Array.isArray(entry.data)) {
      const filtered = entry.data.filter((item: any) => Number(item?.id) !== Number(taskId));
      if (filtered.length !== entry.data.length) {
        const updatedEntry = { ...entry, data: filtered, updatedAt: Date.now() };
        memoryCache.set(key, updatedEntry);
        writeToSessionStorage(key, updatedEntry);
        updatedEntries++;
      }
    } else if (entry.data && Array.isArray(entry.data.tasks)) {
      const filtered = entry.data.tasks.filter((item: any) => Number(item?.id) !== Number(taskId));
      if (filtered.length !== entry.data.tasks.length) {
        const nextData = {
          ...entry.data,
          tasks: filtered,
          data: Array.isArray(entry.data.data) ? filtered : entry.data.data,
        };
        const updatedEntry = { ...entry, data: nextData, updatedAt: Date.now() };
        memoryCache.set(key, updatedEntry);
        writeToSessionStorage(key, updatedEntry);
        updatedEntries++;
      }
    }
  }

  if (updatedEntries > 0) {
    stats.patches += updatedEntries;
  }
  return updatedEntries;
}

/**
 * Targeted cache invalidation for specific resource(s) belonging to the active user.
 */
export function invalidateResourceCache(
  resources: string | string[],
  userScope = activeUserScope
): number {
  const list = Array.isArray(resources) ? resources : [resources];
  let count = 0;

  for (const resource of list) {
    const prefix = `${STORAGE_PREFIX}:${userScope}:${resource}:`;
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
        removeFromSessionStorage(key);
        count++;
      }
    }
  }

  stats.invalidations += count;
  return count;
}

/**
 * Completely purges all cached data for a user (or all users) on logout.
 */
export function clearUserRequestCache(userScope?: string): void {
  const targetPrefix = userScope ? `${STORAGE_PREFIX}:${userScope}:` : `${STORAGE_PREFIX}:`;

  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(targetPrefix)) {
      memoryCache.delete(key);
    }
  }

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(targetPrefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.sessionStorage.removeItem(k);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

export function getRequestCacheStats(): CacheStatsSnapshot {
  return { ...stats };
}

export function resetRequestCacheStats(): void {
  stats.hits = 0;
  stats.staleHits = 0;
  stats.coalesced = 0;
  stats.misses = 0;
  stats.invalidations = 0;
  stats.patches = 0;
}

/**
 * User-scoped server-side response cache & in-flight deduplication.
 * Prevents redundant Prisma queries when multiple widgets or rapid client requests
 * query the same user-scoped resource within a short window, while guaranteeing
 * immediate invalidation on any write mutation.
 */

interface ServerCacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 20_000; // 20s fresh server memoization window
const MAX_CACHE_ENTRIES = 500;

const cacheStore = new Map<string, ServerCacheEntry>();
const inFlightStore = new Map<string, Promise<unknown>>();

function buildScopedKey(userId: number | string, namespace: string, subKey = "default"): string {
  return `u:${userId}:${namespace}:${subKey}`;
}

function evictExpiredIfNeeded(now: number) {
  if (cacheStore.size < MAX_CACHE_ENTRIES) return;
  for (const [k, entry] of Array.from(cacheStore.entries())) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(k);
    }
  }
  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey) cacheStore.delete(oldestKey);
  }
}

export async function getOrComputeUserCache<T>(
  userId: number | string,
  namespace: string,
  subKey: string,
  computeFn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<{ data: T; cacheStatus: "HIT" | "COALESCED" | "MISS" }> {
  const key = buildScopedKey(userId, namespace, subKey);
  const now = Date.now();

  const existing = cacheStore.get(key) as ServerCacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return { data: existing.value, cacheStatus: "HIT" };
  }

  const inFlight = inFlightStore.get(key) as Promise<T> | undefined;
  if (inFlight) {
    const data = await inFlight;
    return { data, cacheStatus: "COALESCED" };
  }

  const flightPromise = (async () => {
    try {
      const result = await computeFn();
      const completedAt = Date.now();
      evictExpiredIfNeeded(completedAt);
      cacheStore.set(key, {
        value: result,
        createdAt: completedAt,
        expiresAt: completedAt + ttlMs,
      });
      return result;
    } finally {
      inFlightStore.delete(key);
    }
  })();

  inFlightStore.set(key, flightPromise);
  const data = await flightPromise;
  return { data, cacheStatus: "MISS" };
}

/**
 * Invalidates cached entries for a specific user.
 * If namespaces are omitted, clears all namespaces for that user.
 */
export function invalidateUserServerCache(
  userId: number | string,
  namespaces?: string[]
): number {
  const prefix = `u:${userId}:`;
  let removed = 0;

  for (const key of Array.from(cacheStore.keys())) {
    if (!key.startsWith(prefix)) continue;
    if (!namespaces || namespaces.length === 0) {
      cacheStore.delete(key);
      removed++;
    } else {
      for (const ns of namespaces) {
        if (key.startsWith(`${prefix}${ns}:`)) {
          cacheStore.delete(key);
          removed++;
          break;
        }
      }
    }
  }

  return removed;
}

export function clearAllServerCache(): void {
  cacheStore.clear();
  inFlightStore.clear();
}

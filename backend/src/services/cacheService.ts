import * as Sentry from "@sentry/node";
import Redis from "ioredis";
import { config } from "../config";
import { normalizeKey } from "../utils/normalizeKey";

let redis: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis | null {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 3000);
      },
      reconnectOnError(err: Error) {
        return err.message.includes("READONLY");
      },
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redis.on("connect", () => {
      isConnected = true;
      console.info("[Redis] Connected");
    });

    redis.on("error", (err: Error) => {
      isConnected = false;
      console.warn("[Redis] Connection error:", err.message);
    });

    redis.on("close", () => {
      isConnected = false;
    });

    redis.on("reconnecting", () => {
      console.info("[Redis] Reconnecting...");
    });

    redis.connect().catch((err: Error) => {
      console.warn("[Redis] Initial connection failed:", err.message);
    });
  }

  return redis;
}

export function isRedisAvailable(): boolean {
  return isConnected;
}

let cacheHits = 0;
let cacheMisses = 0;

interface TypedCacheStats {
  search: { hits: number; misses: number };
  metadata: { hits: number; misses: number };
  filter: { hits: number; misses: number };
  recommendations: { hits: number; misses: number };
}

const typedStats: TypedCacheStats = {
  search: { hits: 0, misses: 0 },
  metadata: { hits: 0, misses: 0 },
  filter: { hits: 0, misses: 0 },
  recommendations: { hits: 0, misses: 0 },
};

export function recordCacheHit(type: keyof TypedCacheStats): void {
  typedStats[type].hits++;
}

export function recordCacheMiss(type: keyof TypedCacheStats): void {
  typedStats[type].misses++;
}

export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  const searchTotal = typedStats.search.hits + typedStats.search.misses;
  const allTypedHits = Object.values(typedStats).reduce((a, b) => a + b.hits, 0);
  const allTypedMisses = Object.values(typedStats).reduce((a, b) => a + b.misses, 0);

  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
    typed: typedStats,
    searchHitRate: searchTotal > 0 ? typedStats.search.hits / searchTotal : 0,
    overallTypedHitRate:
      allTypedHits + allTypedMisses > 0
        ? allTypedHits / (allTypedHits + allTypedMisses)
        : 0,
  };
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected || !redis) {
    cacheMisses++;
    return null;
  }
  const keyPrefix = key.split(":")[0];
  return Sentry.startSpan(
    { name: `redis.get.${keyPrefix}`, op: "db.redis" },
    async () => {
      try {
        const value = await redis!.get(normalizeKey(key));
        if (value) {
          cacheHits++;
          return JSON.parse(value) as T;
        }
        cacheMisses++;
        return null;
      } catch (err) {
        cacheMisses++;
        console.warn("[Redis] GET error:", (err as Error).message);
        return null;
      }
    }
  );
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!isConnected || !redis) return;
  try {
    await redis.setex(normalizeKey(key), ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.warn("[Redis] SET error:", (err as Error).message);
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!isConnected || !redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.warn("[Redis] DEL pattern error:", (err as Error).message);
  }
}

export const TTL = {
  SEARCH: 1800,
  TRACK: 86400,
  SCORE: 604800,
  HOMEPAGE_TRENDING: 3600,
  HOMEPAGE_CATEGORIES: 21600,
  HOMEPAGE_RECENT: 1800,
} as const;

const inFlight = new Map<string, Promise<unknown>>();

export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const normalizedKey = normalizeKey(key);
  const existing = inFlight.get(normalizedKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const fetchPromise = (async () => {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
    const result = await fetcher();
    await cacheSet(key, result, ttlSeconds);
    return result;
  })().finally(() => {
    inFlight.delete(normalizedKey);
  });

  inFlight.set(normalizedKey, fetchPromise);
  return fetchPromise;
}

export interface SWRResult<T> {
  data: T;
  fromCache: boolean;
  ttlRemaining?: number;
}

/**
 * Stale-while-revalidate: returns cached data immediately and triggers
 * a background refresh when TTL is below 20% remaining.
 */
export async function getOrFetchSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<SWRResult<T>> {
  const nk = normalizeKey(key);

  if (isConnected && redis) {
    try {
      const [value, ttlRemaining] = await Promise.all([
        redis.get(nk),
        redis.ttl(nk),
      ]);

      if (value && ttlRemaining > 0) {
        cacheHits++;
        const data = JSON.parse(value) as T;
        const threshold = ttlSeconds * 0.2;

        if (ttlRemaining < threshold && !inFlight.has(nk)) {
          const refreshPromise = fetcher()
            .then((fresh) => cacheSet(key, fresh, ttlSeconds))
            .catch((err) =>
              console.warn("[Cache SWR] Background refresh failed:", (err as Error).message)
            )
            .finally(() => {
              inFlight.delete(nk);
            });
          inFlight.set(nk, refreshPromise as Promise<unknown>);
        }

        return { data, fromCache: true, ttlRemaining };
      }
    } catch (err) {
      console.warn("[Redis] SWR GET error:", (err as Error).message);
    }
  }

  cacheMisses++;

  const existing = inFlight.get(nk);
  if (existing) {
    const data = (await existing) as T;
    return { data, fromCache: false };
  }

  const fetchPromise = fetcher()
    .then(async (result) => {
      await cacheSet(key, result, ttlSeconds);
      return result;
    })
    .finally(() => {
      inFlight.delete(nk);
    });

  inFlight.set(nk, fetchPromise);
  const data = await fetchPromise;
  return { data, fromCache: false };
}

export async function getTTL(key: string): Promise<number> {
  if (!isConnected || !redis) return -2;
  try {
    return await redis.ttl(normalizeKey(key));
  } catch {
    return -2;
  }
}

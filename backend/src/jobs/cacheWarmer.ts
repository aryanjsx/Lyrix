import cron from "node-cron";
import { cacheGet, cacheSet, TTL } from "../services/cacheService";
import {
  fetchTrending,
  fetchCategories,
  fetchRecent,
  CACHE_KEYS,
  buildCacheKey,
} from "../routes/homepage";

async function warmKey<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  label: string
): Promise<void> {
  const existing = await cacheGet<T>(key);
  if (existing !== null) {
    console.info(`[CacheWarmer] ${label}: already warm, skipping`);
    return;
  }

  const data = await fetcher();
  await cacheSet(key, data, ttl);
  console.info(`[CacheWarmer] ${label}: warmed successfully`);
}

const POPULAR_LANG_COMBOS: string[][] = [
  ["hindi"],
  ["hindi", "punjabi"],
  ["hindi", "english"],
  ["english"],
  ["punjabi"],
  ["tamil"],
  ["telugu"],
];

async function warmAll(): Promise<void> {
  console.info("[CacheWarmer] Warming cold homepage keys...");

  const globalLangs: string[] = [];
  const jobs = [
    warmKey(
      buildCacheKey(CACHE_KEYS.trending, globalLangs),
      () => fetchTrending(globalLangs),
      TTL.HOMEPAGE_TRENDING,
      "Trending (global)"
    ),
    warmKey(
      buildCacheKey(CACHE_KEYS.categories, globalLangs),
      () => fetchCategories(globalLangs),
      TTL.HOMEPAGE_CATEGORIES,
      "Categories (global)"
    ),
    warmKey(
      buildCacheKey(CACHE_KEYS.recent, globalLangs),
      () => fetchRecent(globalLangs),
      TTL.HOMEPAGE_RECENT,
      "Recent (global)"
    ),
  ];

  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("[CacheWarmer] Warm job failed:", r.reason);
    }
  }

  console.info("[CacheWarmer] Initial warm complete, warming popular language combos...");

  for (const langs of POPULAR_LANG_COMBOS) {
    const langJobs = [
      warmKey(
        buildCacheKey(CACHE_KEYS.trending, langs),
        () => fetchTrending(langs),
        TTL.HOMEPAGE_TRENDING,
        `Trending (${langs.join(",")})`
      ),
      warmKey(
        buildCacheKey(CACHE_KEYS.recent, langs),
        () => fetchRecent(langs),
        TTL.HOMEPAGE_RECENT,
        `Recent (${langs.join(",")})`
      ),
    ];
    await Promise.allSettled(langJobs);
  }

  console.info("[CacheWarmer] Language-specific warm complete");
}

async function refreshKey<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  label: string
): Promise<void> {
  try {
    const data = await fetcher();
    await cacheSet(key, data, ttl);
    console.info(`[CacheWarmer] ${label}: refreshed`);
  } catch (err) {
    console.warn(`[CacheWarmer] ${label} refresh failed:`, (err as Error).message);
  }
}

export function startCacheWarmer(): void {
  warmAll().catch((err) =>
    console.warn("[CacheWarmer] Initial warm failed:", (err as Error).message)
  );

  const globalLangs: string[] = [];

  // Trending: every 45 minutes (before 1hr TTL expires)
  cron.schedule("*/45 * * * *", () => {
    refreshKey(
      buildCacheKey(CACHE_KEYS.trending, globalLangs),
      () => fetchTrending(globalLangs),
      TTL.HOMEPAGE_TRENDING,
      "Trending (global)"
    ).catch(() => {});

    for (const langs of POPULAR_LANG_COMBOS) {
      refreshKey(
        buildCacheKey(CACHE_KEYS.trending, langs),
        () => fetchTrending(langs),
        TTL.HOMEPAGE_TRENDING,
        `Trending (${langs.join(",")})`
      ).catch(() => {});
    }
  });

  // Recent: every 20 minutes (before 30min TTL expires)
  cron.schedule("*/20 * * * *", () => {
    refreshKey(
      buildCacheKey(CACHE_KEYS.recent, globalLangs),
      () => fetchRecent(globalLangs),
      TTL.HOMEPAGE_RECENT,
      "Recent (global)"
    ).catch(() => {});

    for (const langs of POPULAR_LANG_COMBOS) {
      refreshKey(
        buildCacheKey(CACHE_KEYS.recent, langs),
        () => fetchRecent(langs),
        TTL.HOMEPAGE_RECENT,
        `Recent (${langs.join(",")})`
      ).catch(() => {});
    }
  });

  // Categories: every 5 hours (before 6hr TTL expires)
  cron.schedule("0 */5 * * *", () => {
    refreshKey(
      buildCacheKey(CACHE_KEYS.categories, globalLangs),
      () => fetchCategories(globalLangs),
      TTL.HOMEPAGE_CATEGORIES,
      "Categories (global)"
    ).catch(() => {});
  });

  console.info("[CacheWarmer] Scheduled: trending@45min, recent@20min, categories@5hr (+ popular langs)");
}

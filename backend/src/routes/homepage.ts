import { Router, Request, Response } from "express";
import { getOrFetchSWR, cacheGet, TTL } from "../services/cacheService";
import { searchInnertube } from "../services/innertubeService";
import { getTodayQuota, recordCall } from "../services/quotaService";
import { config } from "../config";
import type { FilteredTrack } from "../services/filterService";

const router = Router();

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\s*[-|·:]\s*.*/g, "")
    .replace(/\b(official|video|audio|lyrics|lyric|hd|full|song|ft\.?|feat\.?|by)\b.*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

function dedupTracks(tracks: FilteredTrack[], max: number): FilteredTrack[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: FilteredTrack[] = [];
  for (const t of tracks) {
    if (seenIds.has(t.videoId)) continue;
    const norm = normalizeTitle(t.title);
    if (seenTitles.has(norm)) continue;
    seenIds.add(t.videoId);
    seenTitles.add(norm);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

const CACHE_KEYS = {
  trending: "homepage:trending",
  categories: "homepage:categories",
  recent: "homepage:recent",
} as const;

const QUOTA_GATE = 9000;

interface HomepageCategory {
  id: string;
  title: string;
  query: string;
  representativeTrack: FilteredTrack | null;
}

const LANG_QUERIES: Record<string, { trending: string; recent: string }> = {
  hindi: { trending: "latest hindi bollywood official songs 2026", recent: "new hindi songs released today official" },
  punjabi: { trending: "latest punjabi official songs 2026", recent: "new punjabi songs released today official" },
  english: { trending: "top english pop official songs 2026", recent: "new english pop songs released today official" },
  tamil: { trending: "latest tamil official songs 2026", recent: "new tamil songs released today official" },
  telugu: { trending: "latest telugu official songs 2026", recent: "new telugu songs released today official" },
  bengali: { trending: "latest bengali official songs 2026", recent: "new bengali songs released today official" },
  marathi: { trending: "latest marathi official songs 2026", recent: "new marathi songs released today official" },
  kannada: { trending: "latest kannada official songs 2026", recent: "new kannada songs released today official" },
  malayalam: { trending: "latest malayalam official songs 2026", recent: "new malayalam songs released today official" },
  gujarati: { trending: "latest gujarati official songs 2026", recent: "new gujarati songs released today official" },
  korean: { trending: "latest kpop official songs 2026", recent: "new kpop songs released today official" },
  spanish: { trending: "latest latin reggaeton official songs 2026", recent: "new latin reggaeton songs released today" },
  arabic: { trending: "latest arabic official songs 2026", recent: "new arabic songs released today official" },
  japanese: { trending: "latest japanese j-pop official songs 2026", recent: "new japanese songs released today official" },
  urdu: { trending: "latest urdu official songs 2026", recent: "new urdu songs released today official" },
  bhojpuri: { trending: "latest bhojpuri official songs 2026", recent: "new bhojpuri songs released today official" },
  haryanvi: { trending: "latest haryanvi official songs 2026", recent: "new haryanvi songs released today official" },
  rajasthani: { trending: "latest rajasthani official songs 2026", recent: "new rajasthani songs released today official" },
};

const LANG_CATEGORIES: Record<string, Array<{ id: string; title: string; query: string }>> = {
  hindi: [
    { id: "bollywood-hits", title: "Bollywood Hits", query: "bollywood latest official hit songs 2026" },
    { id: "hindi-romantic", title: "Hindi Romantic", query: "hindi romantic official love songs new" },
    { id: "hindi-chill", title: "Hindi Chill", query: "hindi chill acoustic unplugged official songs" },
    { id: "hindi-workout", title: "Hindi Workout", query: "hindi high energy official motivational songs" },
    { id: "hindi-retro", title: "Bollywood Retro", query: "bollywood retro classic official songs" },
    { id: "hindi-hip-hop", title: "Desi Hip Hop", query: "desi hip hop rap official hindi songs 2026" },
  ],
  punjabi: [
    { id: "punjabi-hits", title: "Punjabi Hits", query: "latest punjabi official songs 2026" },
    { id: "punjabi-romantic", title: "Punjabi Romantic", query: "punjabi romantic official love songs new" },
    { id: "punjabi-party", title: "Punjabi Party", query: "punjabi party official dance songs 2026" },
    { id: "punjabi-hip-hop", title: "Punjabi Hip Hop", query: "punjabi hip hop rap official songs 2026" },
    { id: "punjabi-chill", title: "Punjabi Chill", query: "punjabi chill acoustic official songs" },
  ],
  english: [
    { id: "top-pop", title: "Top Pop", query: "top pop official music hits 2026" },
    { id: "hip-hop", title: "Hip-Hop & Rap", query: "hip hop rap official music hits 2026" },
    { id: "rock", title: "Rock", query: "rock music official hits songs" },
    { id: "chill-vibes", title: "Chill Vibes", query: "chill lofi beats relaxing official music" },
    { id: "rnb", title: "R&B", query: "rnb official music hits songs 2026" },
  ],
  tamil: [
    { id: "tamil-hits", title: "Tamil Hits", query: "latest tamil official songs hits 2026" },
    { id: "tamil-romantic", title: "Tamil Romantic", query: "tamil romantic official love songs new" },
    { id: "tamil-party", title: "Tamil Kuthu", query: "tamil kuthu official dance songs 2026" },
  ],
  telugu: [
    { id: "telugu-hits", title: "Telugu Hits", query: "latest telugu official songs tollywood 2026" },
    { id: "telugu-romantic", title: "Telugu Romantic", query: "telugu romantic official love songs new" },
    { id: "telugu-party", title: "Telugu Mass", query: "telugu official dance mass songs 2026" },
  ],
  korean: [
    { id: "kpop-trending", title: "K-Pop Trending", query: "latest kpop official songs trending 2026" },
    { id: "kpop-chill", title: "K-Pop Chill", query: "korean chill official rnb ballad songs" },
  ],
};

const DEFAULT_CATEGORIES = [
  { id: "bollywood-hits", title: "Bollywood Hits", query: "bollywood latest official hit songs 2026" },
  { id: "top-pop", title: "Top Pop", query: "top pop official music hits 2026" },
  { id: "chill-vibes", title: "Chill Vibes", query: "chill lofi beats relaxing official music" },
  { id: "hip-hop", title: "Hip Hop & Rap", query: "hip hop rap official music hits 2026" },
  { id: "rock", title: "Rock", query: "rock music official hits songs" },
  { id: "podcasts", title: "Podcasts", query: "popular podcast episodes 2026" },
];

function parseLangs(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && /^[a-z]+$/.test(s))
    .slice(0, 5);
}

function buildCacheKey(base: string, languages: string[]): string {
  if (languages.length === 0) return base;
  return `${base}:${[...languages].sort().join(",")}`;
}

async function isQuotaSafe(): Promise<boolean> {
  try {
    const quota = await getTodayQuota();
    return quota.units < QUOTA_GATE;
  } catch {
    return false;
  }
}

async function fetchTrending(languages: string[]): Promise<FilteredTrack[]> {
  if (!(await isQuotaSafe())) {
    const key = buildCacheKey(CACHE_KEYS.trending, languages);
    const stale = await cacheGet<FilteredTrack[]>(key);
    return stale ?? [];
  }

  if (languages.length > 0) {
    const perLangLimit = Math.max(8, Math.ceil(20 / languages.length));

    const langResults = await Promise.all(
      languages.slice(0, 4).map(async (lang) => {
        const query = LANG_QUERIES[lang]?.trending ?? `latest ${lang} official music 2026`;
        try {
          return await searchInnertube(query);
        } catch {
          return [];
        }
      })
    );

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const allTracks: FilteredTrack[] = [];
    for (const results of langResults) {
      let count = 0;
      for (const t of results) {
        if (seenIds.has(t.videoId)) continue;
        const norm = normalizeTitle(t.title);
        if (seenTitles.has(norm)) continue;
        if (count < perLangLimit) {
          seenIds.add(t.videoId);
          seenTitles.add(norm);
          allTracks.push(t);
          count++;
        }
      }
    }

    return allTracks.slice(0, 20);
  }

  try {
    if (config.youtubeApiKey) {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("key", config.youtubeApiKey);
      url.searchParams.set("chart", "mostPopular");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("maxResults", "20");
      url.searchParams.set("part", "snippet,contentDetails,statistics");
      url.searchParams.set("regionCode", "IN");

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as { items?: Array<Record<string, any>> };
        if (data.items && data.items.length > 0) {
          void recordCall(1).catch(() => {});
          const tracks: FilteredTrack[] = data.items.map((item: Record<string, any>) => ({
            videoId: item.id,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            duration: parseDuration(item.contentDetails?.duration ?? "PT0S"),
            thumbnail:
              item.snippet.thumbnails?.high?.url ??
              item.snippet.thumbnails?.medium?.url ??
              item.snippet.thumbnails?.default?.url ??
              "",
            category: "music" as const,
            filterScore: 80,
          }));
          return tracks;
        }
      }
    }
  } catch (err) {
    console.warn("[Homepage] YouTube API trending failed, falling back to InnerTube:", (err as Error).message);
  }

  const results = await searchInnertube("trending official music songs 2026");
  return results.slice(0, 20);
}

async function fetchCategories(languages: string[]): Promise<HomepageCategory[]> {
  if (!(await isQuotaSafe())) {
    const key = buildCacheKey(CACHE_KEYS.categories, languages);
    const stale = await cacheGet<HomepageCategory[]>(key);
    if (stale) return stale;
  }

  let categoryDefs: Array<{ id: string; title: string; query: string }> = [];

  if (languages.length > 0) {
    const seen = new Set<string>();
    for (const lang of languages) {
      const langCats = LANG_CATEGORIES[lang];
      if (langCats) {
        for (const cat of langCats) {
          if (!seen.has(cat.id)) {
            seen.add(cat.id);
            categoryDefs.push(cat);
          }
        }
      }
    }
    if (categoryDefs.length === 0) {
      categoryDefs = languages.map((lang) => ({
        id: `${lang}-hits`,
        title: `${lang.charAt(0).toUpperCase() + lang.slice(1)} Hits`,
        query: LANG_QUERIES[lang]?.trending ?? `latest ${lang} official music 2026`,
      }));
    }
  } else {
    categoryDefs = DEFAULT_CATEGORIES;
  }

  const categories = await Promise.all(
    categoryDefs.map(async (cat) => {
      try {
        const results = await searchInnertube(cat.query);
        return {
          id: cat.id,
          title: cat.title,
          query: cat.query,
          representativeTrack: results[0] ?? null,
        };
      } catch {
        return {
          id: cat.id,
          title: cat.title,
          query: cat.query,
          representativeTrack: null,
        };
      }
    })
  );

  return categories;
}

async function fetchRecent(languages: string[]): Promise<FilteredTrack[]> {
  if (!(await isQuotaSafe())) {
    const key = buildCacheKey(CACHE_KEYS.recent, languages);
    const stale = await cacheGet<FilteredTrack[]>(key);
    return stale ?? [];
  }

  if (languages.length > 0) {
    const perLangLimit = Math.max(8, Math.ceil(20 / languages.length));

    const langResults = await Promise.all(
      languages.slice(0, 4).map(async (lang) => {
        const query = LANG_QUERIES[lang]?.recent ?? `new ${lang} songs released today official`;
        try {
          return await searchInnertube(query);
        } catch {
          return [];
        }
      })
    );

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const allTracks: FilteredTrack[] = [];
    for (const results of langResults) {
      let count = 0;
      for (const t of results) {
        if (seenIds.has(t.videoId)) continue;
        const norm = normalizeTitle(t.title);
        if (seenTitles.has(norm)) continue;
        if (count < perLangLimit) {
          seenIds.add(t.videoId);
          seenTitles.add(norm);
          allTracks.push(t);
          count++;
        }
      }
    }

    return allTracks.slice(0, 20);
  }

  try {
    if (config.youtubeApiKey) {
      const publishedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("key", config.youtubeApiKey);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10");
      url.searchParams.set("order", "date");
      url.searchParams.set("maxResults", "20");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("publishedAfter", publishedAfter);
      url.searchParams.set("regionCode", "IN");

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as { items?: Array<Record<string, any>> };
        if (data.items && data.items.length > 0) {
          void recordCall(100).catch(() => {});
          const tracks: FilteredTrack[] = data.items.map((item: Record<string, any>) => ({
            videoId: typeof item.id === "string" ? item.id : item.id?.videoId ?? "",
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            duration: 0,
            thumbnail:
              item.snippet.thumbnails?.high?.url ??
              item.snippet.thumbnails?.medium?.url ??
              item.snippet.thumbnails?.default?.url ??
              "",
            category: "music" as const,
            filterScore: 70,
          }));
          return tracks.filter((t: FilteredTrack) => t.videoId);
        }
      }
    }
  } catch (err) {
    console.warn("[Homepage] YouTube API recent failed, falling back to InnerTube:", (err as Error).message);
  }

  const results = await searchInnertube("new music releases official today 2026");
  return results.slice(0, 20);
}

function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] ?? "0", 10) * 3600 +
    parseInt(match[2] ?? "0", 10) * 60 +
    parseInt(match[3] ?? "0", 10)
  );
}

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const languages = parseLangs(req.query.languages);
    const errors: string[] = [];
    let allFromCache = true;

    const trendingKey = buildCacheKey(CACHE_KEYS.trending, languages);
    const categoriesKey = buildCacheKey(CACHE_KEYS.categories, languages);
    const recentKey = buildCacheKey(CACHE_KEYS.recent, languages);

    const [trendingResult, categoriesResult, recentResult] = await Promise.all([
      getOrFetchSWR<FilteredTrack[]>(
        trendingKey,
        () => fetchTrending(languages),
        TTL.HOMEPAGE_TRENDING
      ).catch((err) => {
        console.warn("[Homepage] trending fetch failed:", (err as Error).message);
        errors.push("trending_unavailable");
        return null;
      }),
      getOrFetchSWR<HomepageCategory[]>(
        categoriesKey,
        () => fetchCategories(languages),
        TTL.HOMEPAGE_CATEGORIES
      ).catch((err) => {
        console.warn("[Homepage] categories fetch failed:", (err as Error).message);
        errors.push("categories_unavailable");
        return null;
      }),
      getOrFetchSWR<FilteredTrack[]>(
        recentKey,
        () => fetchRecent(languages),
        TTL.HOMEPAGE_RECENT
      ).catch((err) => {
        console.warn("[Homepage] recent fetch failed:", (err as Error).message);
        errors.push("recent_unavailable");
        return null;
      }),
    ]);

    if (trendingResult && !trendingResult.fromCache) allFromCache = false;
    if (categoriesResult && !categoriesResult.fromCache) allFromCache = false;
    if (recentResult && !recentResult.fromCache) allFromCache = false;

    const trending = dedupTracks(trendingResult?.data ?? [], 20);
    const categories = categoriesResult?.data ?? [];
    const recentRaw = dedupTracks(recentResult?.data ?? [], 20);

    const usedIds = new Set<string>();
    const usedTitles = new Set<string>();
    for (const t of trending) {
      usedIds.add(t.videoId);
      usedTitles.add(normalizeTitle(t.title));
    }
    for (const cat of categories) {
      if (cat.representativeTrack) usedIds.add(cat.representativeTrack.videoId);
    }
    const recent = recentRaw.filter((t) =>
      !usedIds.has(t.videoId) && !usedTitles.has(normalizeTitle(t.title))
    );

    res.setHeader(
      "Cache-Control",
      allFromCache
        ? "public, s-maxage=300, stale-while-revalidate=3600"
        : "public, s-maxage=60, stale-while-revalidate=600"
    );
    res.setHeader("X-Cache", allFromCache ? "HIT" : "MISS");

    res.json({
      trending,
      categories,
      recent,
      meta: {
        servedFromCache: allFromCache,
        generatedAt: new Date().toISOString(),
        languages,
        ...(errors.length > 0 && { errors }),
      },
    });
  } catch (err) {
    console.error("[Homepage] Unexpected error:", (err as Error).message);
    res.status(500).json({
      trending: [],
      categories: [],
      recent: [],
      meta: {
        servedFromCache: false,
        generatedAt: new Date().toISOString(),
        languages: [],
        errors: ["internal_server_error"],
      },
    });
  }
});

export default router;

export { fetchTrending, fetchCategories, fetchRecent, CACHE_KEYS, buildCacheKey };

import { Request, Response } from "express";
import { normalizeKey } from "../utils/normalizeKey";
import { cacheGet, cacheSet, TTL, recordCacheHit, recordCacheMiss } from "../services/cacheService";
import { FilteredTrack } from "../services/filterService";
import { searchInnertube } from "../services/innertubeService";
import { searchPiped } from "../services/pipedService";
import { searchInvidious } from "../services/invidiousService";
import { searchLocalTracks } from "../services/localSearchService";

type SearchSource = "cache" | "innertube" | "invidious" | "piped" | "library";

const REMIX_PATTERN = /remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/i;

function filterRemixes(tracks: FilteredTrack[]): FilteredTrack[] {
  return tracks.filter((t) => !REMIX_PATTERN.test(t.title));
}

export async function handleSearch(
  req: Request,
  res: Response
): Promise<void> {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const searchType = typeof req.query.type === "string" ? req.query.type : "music";

  if (!query || query.length < 2) {
    res.status(400).json({ error: "Search query must be at least 2 characters" });
    return;
  }

  if (query.length > 200) {
    res.status(400).json({ error: "Search query is too long" });
    return;
  }

  try {
    const webOnly = searchType === "podcast";
    const cacheKey = `search:${normalizeKey(query)}:${searchType}`;
    const cached = await cacheGet<FilteredTrack[]>(cacheKey);

    if (cached && cached.length > 0) {
      recordCacheHit("search");
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
      res.setHeader("X-Cache", "HIT");
      res.json({ results: cached, source: "cache", cacheHit: true });
      return;
    }

    recordCacheMiss("search");
    res.setHeader("X-Cache", "MISS");

    let results: FilteredTrack[] | null = null;
    let source: SearchSource = "innertube";

    // Tier 1: YouTube Innertube API (same as youtube.com uses, no key/quota needed)
    try {
      const innertubeResults = await searchInnertube(query, { webOnly });
      if (innertubeResults.length > 0) results = innertubeResults;
    } catch (err) {
      console.warn("[Search] Innertube failed:", (err as Error).message);
    }

    // Tier 2: Invidious (free YouTube proxy)
    if (!results || results.length === 0) {
      source = "invidious";
      try {
        const invResults = await searchInvidious(query);
        if (invResults.length > 0) results = invResults;
      } catch (err) {
        console.warn("[Search] Invidious failed:", (err as Error).message);
      }
    }

    // Tier 3: Piped (another free YouTube proxy)
    if (!results || results.length === 0) {
      source = "piped";
      try {
        const pipedResults = await searchPiped(query);
        if (pipedResults.length > 0) results = pipedResults;
      } catch (err) {
        console.warn("[Search] Piped failed:", (err as Error).message);
      }
    }

    // Tier 4: Local database (previously cached tracks)
    if (!results || results.length === 0) {
      source = "library";
      try {
        const localResults = await searchLocalTracks(query);
        if (localResults.length > 0) results = localResults;
      } catch (err) {
        console.warn("[Search] Local search failed:", (err as Error).message);
      }
    }

    const finalResults = filterRemixes(results ?? []);

    if (finalResults.length > 0) {
      await cacheSet(cacheKey, finalResults, TTL.SEARCH);
    }

    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    res.json({ results: finalResults, source, cacheHit: false });
  } catch (err) {
    console.error("[Search] Error:", err);
    res.status(500).json({ error: "Search failed. Please try again." });
  }
}

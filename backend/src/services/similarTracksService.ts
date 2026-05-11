import { cacheGet, cacheSet } from "./cacheService";
import { searchInnertube } from "./innertubeService";
import { tagTrack } from "./genreService";
import { getGenreSearchTerm } from "../utils/genreMap";
import { getLanguageCode, getLanguageSearchTerm } from "../utils/languageMap";
import type { FilteredTrack } from "./filterService";

const SIMILAR_CACHE_TTL = 7200; // 2 hours
const MAX_CACHE_SIZE = 40;

interface FetchOptions {
  genre?: string;
  language?: string;
  count?: number;
  excludeIds?: string[];
}

function buildCacheKey(seedVideoId: string, language: string): string {
  const lang = language.toLowerCase().trim() || "default";
  return `similar:${seedVideoId}:${lang}`;
}

export async function fetchSimilarTracks(
  seedVideoId: string,
  options: FetchOptions = {}
): Promise<FilteredTrack[]> {
  const { genre = "", language = "", count = 20, excludeIds = [] } = options;
  const cacheKey = buildCacheKey(seedVideoId, language);
  const excludeSet = new Set(excludeIds);
  excludeSet.add(seedVideoId);

  const cached = await cacheGet<FilteredTrack[]>(cacheKey);
  if (cached && cached.length > 0) {
    const available = cached.filter((t) => !excludeSet.has(t.videoId));
    if (available.length >= count) {
      return available.slice(0, count);
    }
    if (available.length > 0 && available.length < count) {
      const fresh = await fetchFreshSimilarTracks(seedVideoId, { genre, language, existingIds: new Set(cached.map((t) => t.videoId)) });
      if (fresh.length > 0) {
        const merged = [...cached, ...fresh].slice(0, MAX_CACHE_SIZE);
        await cacheSet(cacheKey, merged, SIMILAR_CACHE_TTL);
        const allAvailable = merged.filter((t) => !excludeSet.has(t.videoId));
        return allAvailable.slice(0, count);
      }
      return available.slice(0, count);
    }
  }

  const tracks = await fetchFreshSimilarTracks(seedVideoId, { genre, language, existingIds: new Set() });
  if (tracks.length > 0) {
    await cacheSet(cacheKey, tracks.slice(0, MAX_CACHE_SIZE), SIMILAR_CACHE_TTL);
  }
  const available = tracks.filter((t) => !excludeSet.has(t.videoId));
  return available.slice(0, count);
}

export async function fetchOneNewSimilarTrack(
  seedVideoId: string,
  options: { excludeIds: string[]; genre?: string; language?: string }
): Promise<FilteredTrack | null> {
  const { excludeIds, genre = "", language = "" } = options;
  const cacheKey = buildCacheKey(seedVideoId, language);
  const excludeSet = new Set(excludeIds);
  excludeSet.add(seedVideoId);

  const cached = await cacheGet<FilteredTrack[]>(cacheKey);
  if (cached && cached.length > 0) {
    const available = cached.filter((t) => !excludeSet.has(t.videoId));
    if (available.length > 0) {
      if (available.length < 5) {
        setImmediate(() => {
          refreshCacheInBackground(seedVideoId, { genre, language, existingIds: new Set(cached.map((t) => t.videoId)) })
            .catch(() => {});
        });
      }
      return available[0];
    }
  }

  const fresh = await fetchFreshSimilarTracks(seedVideoId, { genre, language, existingIds: cached ? new Set(cached.map((t) => t.videoId)) : new Set() });
  if (fresh.length > 0) {
    const merged = cached ? [...cached, ...fresh].slice(0, MAX_CACHE_SIZE) : fresh.slice(0, MAX_CACHE_SIZE);
    await cacheSet(cacheKey, merged, SIMILAR_CACHE_TTL);
    const available = fresh.filter((t) => !excludeSet.has(t.videoId));
    return available[0] ?? null;
  }

  return null;
}

interface FreshFetchOptions {
  genre: string;
  language: string;
  existingIds: Set<string>;
}

async function fetchFreshSimilarTracks(
  seedVideoId: string,
  options: FreshFetchOptions
): Promise<FilteredTrack[]> {
  const { genre, language, existingIds } = options;
  const queries = buildSearchQueries(seedVideoId, genre, language);
  const allTracks: FilteredTrack[] = [];
  const seenIds = new Set<string>([seedVideoId, ...existingIds]);

  for (const query of queries) {
    if (allTracks.length >= MAX_CACHE_SIZE) break;
    try {
      const results = await searchInnertube(query);
      for (const track of results) {
        if (seenIds.has(track.videoId)) continue;
        if (track.filterScore < 60) continue;
        seenIds.add(track.videoId);
        allTracks.push(track);
        void tagTrack(track.videoId, track.title, track.channel).catch(() => {});
        if (allTracks.length >= MAX_CACHE_SIZE) break;
      }
    } catch {
      continue;
    }
  }

  return allTracks;
}

function buildSearchQueries(seedVideoId: string, genre: string, language: string): string[] {
  const queries: string[] = [];
  const langTerm = language ? getLanguageSearchTerm(language) : "";
  const genreTerm = genre ? getGenreSearchTerm(genre) : "";

  if (langTerm && genreTerm) {
    queries.push(`${langTerm} ${genreTerm} songs 2026`);
    queries.push(`${langTerm} ${genreTerm} official songs playlist`);
    queries.push(`best ${langTerm} ${genreTerm} songs`);
  } else if (langTerm) {
    queries.push(`${langTerm} songs latest 2026`);
    queries.push(`${langTerm} official songs playlist hits`);
    queries.push(`best ${langTerm} songs 2026`);
  } else if (genreTerm) {
    queries.push(`${genreTerm} official songs 2026`);
    queries.push(`${genreTerm} songs playlist`);
    queries.push(`best ${genreTerm} songs`);
  } else {
    queries.push("trending music songs 2026");
    queries.push("new official songs playlist");
  }

  return queries;
}

async function refreshCacheInBackground(
  seedVideoId: string,
  options: FreshFetchOptions
): Promise<void> {
  const { genre, language, existingIds } = options;
  const cacheKey = buildCacheKey(seedVideoId, language);
  const fresh = await fetchFreshSimilarTracks(seedVideoId, { genre, language, existingIds });
  if (fresh.length > 0) {
    const cached = await cacheGet<FilteredTrack[]>(cacheKey);
    const merged = cached ? [...cached, ...fresh] : fresh;
    const deduped: FilteredTrack[] = [];
    const seen = new Set<string>();
    for (const t of merged) {
      if (!seen.has(t.videoId)) {
        seen.add(t.videoId);
        deduped.push(t);
      }
    }
    await cacheSet(cacheKey, deduped.slice(0, MAX_CACHE_SIZE), SIMILAR_CACHE_TTL);
  }
}

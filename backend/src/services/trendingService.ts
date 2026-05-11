import { cacheGet, cacheSet } from "./cacheService";
import { searchInnertube } from "./innertubeService";
import { FilteredTrack } from "./filterService";

const TRENDING_TTL = 3600;

const REMIX_PATTERN = /remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/i;

function filterRemixes(tracks: FilteredTrack[]): FilteredTrack[] {
  return tracks.filter((t) => !REMIX_PATTERN.test(t.title));
}

const LANG_TRENDING: Record<string, string> = {
  hindi: "latest hindi bollywood official songs 2026",
  english: "top english pop official songs 2026",
  punjabi: "latest punjabi official songs 2026",
  tamil: "latest tamil official songs 2026",
  telugu: "latest telugu official songs 2026",
  bengali: "latest bengali official songs 2026",
  marathi: "latest marathi official songs 2026",
  kannada: "latest kannada official songs 2026",
  malayalam: "latest malayalam official songs 2026",
  gujarati: "latest gujarati official songs 2026",
  odia: "latest odia oriya official songs 2026",
  assamese: "latest assamese official songs 2026",
  urdu: "latest urdu official songs 2026",
  bhojpuri: "latest bhojpuri official songs 2026",
  haryanvi: "latest haryanvi official songs 2026",
  rajasthani: "latest rajasthani official songs 2026",
  maithili: "latest maithili official songs 2026",
  konkani: "latest konkani official songs 2026",
  dogri: "latest dogri official songs 2026",
  sindhi: "latest sindhi official songs 2026",
  kashmiri: "latest kashmiri official songs 2026",
  chhattisgarhi: "latest chhattisgarhi official songs 2026",
  korean: "latest kpop official songs 2026",
  spanish: "latest latin reggaeton official songs 2026",
  french: "latest french official songs 2026",
  german: "latest german official songs 2026",
  portuguese: "latest brazilian portuguese official songs 2026",
  italian: "latest italian official songs 2026",
  arabic: "latest arabic official songs 2026",
  japanese: "latest japanese j-pop official songs 2026",
  chinese: "latest chinese mandarin c-pop official songs 2026",
  turkish: "latest turkish official songs 2026",
  russian: "latest russian official songs 2026",
  thai: "latest thai official songs 2026",
  indonesian: "latest indonesian malay official songs 2026",
  vietnamese: "latest vietnamese official songs 2026",
  filipino: "latest filipino opm official songs 2026",
  swahili: "latest afrobeat swahili official songs 2026",
};

export async function getTrending(languages?: string[]): Promise<FilteredTrack[]> {
  const langs = languages && languages.length > 0 ? languages : [];
  const cacheKey = langs.length > 0
    ? `trending:${[...langs].sort().join(",")}`
    : "trending:global";

  const cached = await cacheGet<FilteredTrack[]>(cacheKey);
  if (cached) return cached;

  const seen = new Set<string>();

  if (langs.length > 0) {
    const queries = langs.slice(0, 4).map((l) => LANG_TRENDING[l] ?? `latest ${l} official music 2026`);
    const perLangLimit = Math.max(8, Math.ceil(20 / queries.length));
    const buckets: FilteredTrack[][] = [];

    for (const q of queries) {
      try {
        const results = await searchInnertube(q);
        const langTracks: FilteredTrack[] = [];
        for (const t of filterRemixes(results)) {
          if (!seen.has(t.videoId)) {
            seen.add(t.videoId);
            langTracks.push(t);
          }
        }
        buckets.push(langTracks.slice(0, perLangLimit));
      } catch {
        buckets.push([]);
      }
    }

    const allTracks: FilteredTrack[] = [];
    let idx = 0;
    let added = true;
    while (added && allTracks.length < 20) {
      added = false;
      for (const bucket of buckets) {
        if (idx < bucket.length && allTracks.length < 20) {
          allTracks.push(bucket[idx]);
          added = true;
        }
      }
      idx++;
    }

    if (allTracks.length > 0) {
      await cacheSet(cacheKey, allTracks, TRENDING_TTL);
    }
    return allTracks;
  }

  const allTracks: FilteredTrack[] = [];
  try {
    const results = await searchInnertube("latest official music songs 2026");
    allTracks.push(...filterRemixes(results));
  } catch { /* skip */ }

  const filtered = allTracks.slice(0, 20);
  if (filtered.length > 0) {
    await cacheSet(cacheKey, filtered, TRENDING_TTL);
  }

  return filtered;
}

export interface DiscoverCategory {
  id: string;
  title: string;
  tracks: FilteredTrack[];
}

const DISCOVER_CACHE_KEY = "discover:global";
const DISCOVER_TTL = 21600; // 6 hours

const DISCOVER_CATEGORIES = [
  { id: "bollywood-hits", title: "Bollywood Hits", query: "bollywood latest official hit songs 2026" },
  { id: "top-pop", title: "Top Pop", query: "top pop official music hits 2026" },
  { id: "chill-vibes", title: "Chill Vibes", query: "chill lofi beats relaxing official music" },
  { id: "hip-hop", title: "Hip Hop & Rap", query: "hip hop rap official music hits 2026" },
  { id: "rock-classics", title: "Rock Classics", query: "classic rock greatest official hits songs" },
];

export async function getDiscover(): Promise<DiscoverCategory[]> {
  const cached = await cacheGet<DiscoverCategory[]>(DISCOVER_CACHE_KEY);
  if (cached) return cached;

  const categories: DiscoverCategory[] = [];

  for (const cat of DISCOVER_CATEGORIES) {
    try {
      const results = await searchInnertube(cat.query);
      const cleaned = filterRemixes(results).slice(0, 8);
      if (cleaned.length > 0) {
        categories.push({ id: cat.id, title: cat.title, tracks: cleaned });
      }
    } catch {
      // skip failed categories
    }
  }

  if (categories.length > 0) {
    await cacheSet(DISCOVER_CACHE_KEY, categories, DISCOVER_TTL);
  }

  return categories;
}

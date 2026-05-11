import { prisma } from "./quotaService";

const LRCLIB_BASE = "https://lrclib.net/api";
const LRCLIB_USER_AGENT = "Lyrix/1.0 (https://github.com/Lyrix)";
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NOT_FOUND_CACHE_MS = 24 * 60 * 60 * 1000; // 1 day for "not found"

export interface LyricsResult {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: string;
  hasSync: boolean;
}

/**
 * Clean YouTube video titles to extract a usable track name for LRCLIB search.
 * Strips common suffixes like "(Official Video)", "| Lyrics", "HD", etc.
 */
function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[\(\[][^)\]]*(?:official|video|audio|lyric|hd|hq|4k|mv|visuali)[^)\]]*[\)\]]/gi, "")
    .replace(/\s*\|.*$/i, "")
    .replace(/\s*[-–—]\s*(?:official|lyric|audio|music)\s*(?:video|audio)?$/i, "")
    .replace(/\s*\bft\.?\s*/gi, " feat. ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Try to split "Artist - Title" patterns common in YouTube titles.
 */
function splitArtistTitle(title: string, channel: string): { trackName: string; artistName: string } {
  const separators = [" - ", " – ", " — ", " ~ "];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx > 0 && idx < title.length - sep.length) {
      return {
        artistName: title.slice(0, idx).trim(),
        trackName: title.slice(idx + sep.length).trim(),
      };
    }
  }
  return { trackName: title, artistName: channel };
}

async function queryLrcLib(
  trackName: string,
  artistName: string,
  durationSec?: number
): Promise<LyricsResult | null> {
  const params = new URLSearchParams();
  params.set("track_name", trackName);
  params.set("artist_name", artistName);

  const url = `${LRCLIB_BASE}/search?${params.toString()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": LRCLIB_USER_AGENT },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;

  const results = (await res.json()) as Array<{
    id: number;
    trackName: string;
    artistName: string;
    duration: number;
    syncedLyrics: string | null;
    plainLyrics: string | null;
    instrumental: boolean;
  }>;

  if (!results || results.length === 0) return null;

  // Prefer results with synced lyrics and closest duration match
  const scored = results
    .filter((r) => !r.instrumental)
    .map((r) => {
      let score = 0;
      if (r.syncedLyrics) score += 100;
      if (r.plainLyrics) score += 10;
      if (durationSec && r.duration > 0) {
        const diff = Math.abs(r.duration - durationSec);
        if (diff <= 2) score += 50;
        else if (diff <= 5) score += 30;
        else if (diff <= 15) score += 10;
        else score -= diff;
      }
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || (!best.syncedLyrics && !best.plainLyrics)) return null;

  return {
    syncedLyrics: best.syncedLyrics,
    plainLyrics: best.plainLyrics,
    source: "lrclib",
    hasSync: !!best.syncedLyrics,
  };
}

async function queryLrcLibFallback(
  trackName: string,
  artistName: string,
  durationSec?: number
): Promise<LyricsResult | null> {
  const fallbackParams = new URLSearchParams({ q: `${trackName} ${artistName}` });
  const fallbackUrl = `${LRCLIB_BASE}/search?${fallbackParams.toString()}`;

  const res = await fetch(fallbackUrl, {
    headers: { "User-Agent": LRCLIB_USER_AGENT },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;

  const results = (await res.json()) as Array<{
    id: number;
    trackName: string;
    artistName: string;
    duration: number;
    syncedLyrics: string | null;
    plainLyrics: string | null;
    instrumental: boolean;
  }>;

  const best = results
    ?.filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
    .sort((a, b) => {
      const aSync = a.syncedLyrics ? 100 : 0;
      const bSync = b.syncedLyrics ? 100 : 0;
      const aDur = durationSec ? Math.abs(a.duration - durationSec) : 0;
      const bDur = durationSec ? Math.abs(b.duration - durationSec) : 0;
      return (bSync - aSync) || (aDur - bDur);
    })[0];

  if (!best || (!best.syncedLyrics && !best.plainLyrics)) return null;

  return {
    syncedLyrics: best.syncedLyrics,
    plainLyrics: best.plainLyrics,
    source: "lrclib",
    hasSync: !!best.syncedLyrics,
  };
}

function cacheResult(
  videoId: string,
  title: string,
  channel: string,
  durationSec: number,
  result: LyricsResult | null
): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (result ? CACHE_DURATION_MS : NOT_FOUND_CACHE_MS));

  prisma.track
    .upsert({
      where: { id: videoId },
      create: {
        id: videoId,
        title,
        channel,
        duration: durationSec,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        category: "music",
        filterScore: 0,
      },
      update: {},
    })
    .then(() =>
      prisma.trackLyrics.upsert({
        where: { trackId: videoId },
        create: {
          trackId: videoId,
          source: result?.source ?? "none",
          hasSync: result?.hasSync ?? false,
          rawLyrics: result?.plainLyrics ?? null,
          lrcContent: result?.syncedLyrics ?? null,
          snippet: result?.plainLyrics?.slice(0, 200) ?? null,
          expiresAt,
        },
        update: {
          source: result?.source ?? "none",
          hasSync: result?.hasSync ?? false,
          rawLyrics: result?.plainLyrics ?? null,
          lrcContent: result?.syncedLyrics ?? null,
          snippet: result?.plainLyrics?.slice(0, 200) ?? null,
          fetchedAt: now,
          expiresAt,
        },
      })
    )
    .catch(() => {});
}

export async function getLyricsForTrack(
  videoId: string,
  title: string,
  channel: string,
  durationSec: number
): Promise<LyricsResult | null> {
  // Check database cache first
  const cached = await prisma.trackLyrics
    .findUnique({ where: { trackId: videoId } })
    .catch(() => null);

  if (cached && cached.expiresAt > new Date()) {
    if (cached.source === "none") return null;
    return {
      syncedLyrics: cached.lrcContent,
      plainLyrics: cached.rawLyrics,
      source: cached.source,
      hasSync: cached.hasSync,
    };
  }

  const cleaned = cleanTitle(title);
  const { trackName, artistName } = splitArtistTitle(cleaned, channel);

  // Run both LRCLIB searches concurrently
  const [exactResult, fallbackResult] = await Promise.allSettled([
    queryLrcLib(trackName, artistName, durationSec),
    queryLrcLibFallback(trackName, artistName, durationSec),
  ]);

  const exact = exactResult.status === "fulfilled" ? exactResult.value : null;
  const fallback = fallbackResult.status === "fulfilled" ? fallbackResult.value : null;

  // Prefer exact match (has duration-aware scoring), then fallback
  const result = exact ?? fallback;

  // Cache in background — don't block the response
  cacheResult(videoId, title, channel, durationSec, result);

  return result;
}

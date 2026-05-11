import { Router, Request, Response } from "express";
import { optionalAuth } from "../middleware/requireAuth";
import { cacheGet, cacheSet } from "../services/cacheService";
import { searchInnertube } from "../services/innertubeService";
import { FilteredTrack } from "../services/filterService";
import {
  getUserGenreProfile,
  getUserArtistProfile,
} from "../services/analysisService";
import { prisma } from "../services/quotaService";

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

function dedup(tracks: FilteredTrack[], max: number): FilteredTrack[] {
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

type TimeSlot =
  | "early_morning"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "late_night";

const TIME_MOOD: Record<TimeSlot, string[]> = {
  early_morning: ["acoustic", "soft", "peaceful"],
  morning: ["upbeat", "feel good", "energetic"],
  afternoon: ["chill", "lo-fi", "focus"],
  evening: ["chill", "relaxing", "unwind"],
  night: ["night drive", "deep", "moody"],
  late_night: ["ambient", "midnight", "slow"],
};

const VALID_SLOTS = new Set<string>(Object.keys(TIME_MOOD));

function getMinutesUntilNextSlot(): number {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const boundaries = [5, 8, 12, 17, 21, 24];
  const next = boundaries.find((b) => b > h) ?? 24;
  return (next - h) * 60 - m;
}

function buildPersonalizedQueries(
  topArtists: string[],
  topGenres: string[],
  languages: string[],
  moods: string[]
): string[] {
  const queries: string[] = [];
  const mood = moods[0] ?? "chill";

  if (topArtists.length > 0) {
    queries.push(`${topArtists[0]} ${mood} songs`);
    if (topArtists[1]) {
      queries.push(`${topArtists[1]} best songs`);
    }
  }

  if (topGenres.length > 0 && languages.length > 0) {
    queries.push(`${languages[0]} ${topGenres[0]} ${mood} songs`);
  } else if (topGenres.length > 0) {
    queries.push(`${topGenres[0]} ${mood} songs playlist`);
  } else if (languages.length > 0) {
    queries.push(`${languages[0]} ${mood} songs`);
  }

  if (topArtists.length > 2) {
    queries.push(`songs like ${topArtists[2]}`);
  }

  if (queries.length === 0) {
    queries.push(`${mood} music playlist`);
    queries.push(`popular ${mood} songs`);
  }

  return queries.slice(0, 4);
}

router.get("/", optionalAuth, async (req: Request, res: Response) => {
  const rawSlot = (req.query.slot as string) ?? "afternoon";
  const slot: TimeSlot = VALID_SLOTS.has(rawSlot)
    ? (rawSlot as TimeSlot)
    : "afternoon";
  const limit = Math.min(Number(req.query.limit) || 12, 20);

  // Parse languages from query string (sent by frontend based on user prefs)
  const queryLangs = typeof req.query.languages === "string" && req.query.languages
    ? req.query.languages.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0 && /^[a-z]+$/.test(s)).slice(0, 5)
    : [];

  let topArtists: string[] = [];
  let topGenres: string[] = [];
  let languages: string[] = queryLangs;

  if (req.userId) {
    try {
      const [artistProfile, genreProfile, user] = await Promise.all([
        getUserArtistProfile(req.userId),
        getUserGenreProfile(req.userId),
        prisma.user.findUnique({
          where: { id: req.userId },
          select: { preferredLanguages: true },
        }),
      ]);

      topArtists = artistProfile
        .slice(0, 5)
        .map((a) => a.channelName)
        .filter((n) => n !== "Unknown" && n.length > 0);

      topGenres = genreProfile.slice(0, 3).map((g) => g.genre);

      if (languages.length === 0 && Array.isArray(user?.preferredLanguages)) {
        languages = (user.preferredLanguages as string[]).slice(0, 2);
      }
    } catch {
      // proceed with empty profile
    }
  }

  // Also check prefs from UserPreferences table for seed artists
  if (req.userId && topArtists.length === 0) {
    try {
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId: req.userId },
      });
      if (prefs?.seedArtists) {
        const seeds = JSON.parse(prefs.seedArtists) as string[];
        topArtists = seeds.slice(0, 3);
      }
      if (prefs?.genres && topGenres.length === 0) {
        const g = JSON.parse(prefs.genres) as string[];
        topGenres = g.slice(0, 2);
      }
    } catch {
      // proceed
    }
  }

  const artistKey = topArtists.slice(0, 2).sort().join("_") || "none";
  const genreKey = topGenres.slice(0, 2).sort().join("_") || "none";
  const langKey = languages.length > 0 ? [...languages].sort().join("_") : "any";
  const cacheKey = `rec:time:${slot}:${artistKey}:${genreKey}:${langKey}`;
  const broadCacheKey = `rec:time:${slot}:${langKey}`;
  const ttlSeconds = Math.max(getMinutesUntilNextSlot() * 60, 300);

  res.setHeader(
    "Cache-Control",
    `private, s-maxage=${Math.min(ttlSeconds, 1800)}, stale-while-revalidate=3600`
  );

  // Tier 1: Check personalized cache
  try {
    const cached = await cacheGet<FilteredTrack[]>(cacheKey);
    if (cached && cached.length > 0) {
      res.json(dedup(cached, limit));
      return;
    }
  } catch {
    // proceed
  }

  // Tier 2: Check broad (slot+language only) cache as fast fallback
  if (cacheKey !== broadCacheKey) {
    try {
      const broadCached = await cacheGet<FilteredTrack[]>(broadCacheKey);
      if (broadCached && broadCached.length > 0) {
        res.json(dedup(broadCached, limit));
        return;
      }
    } catch {
      // proceed
    }
  }

  // Tier 3: Fetch fresh from InnerTube with a hard 4s overall timeout
  const moods = TIME_MOOD[slot];
  const queries = buildPersonalizedQueries(
    topArtists,
    topGenres,
    languages,
    moods
  );

  const fetchPromise = Promise.allSettled(
    queries.map((q) => searchInnertube(q))
  );

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 4000)
  );

  const results = await Promise.race([fetchPromise, timeoutPromise]);

  const allTracks: FilteredTrack[] = [];
  if (results && Array.isArray(results)) {
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const t of r.value) allTracks.push(t);
    }
  }

  const tracks = dedup(allTracks, limit);

  if (tracks.length > 0) {
    await Promise.all([
      cacheSet(cacheKey, tracks, ttlSeconds),
      cacheSet(broadCacheKey, tracks, ttlSeconds),
    ]).catch(() => {});
  }

  res.json(tracks);
});

export default router;

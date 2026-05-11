import { prisma } from "./quotaService";
import { cacheGet, cacheSet } from "./cacheService";
import { getUserArtistProfile, getUserGenreProfile } from "./analysisService";
import { searchInnertube } from "./innertubeService";
import { FilteredTrack } from "./filterService";
import { tagTrack } from "./genreService";

const MIX_TTL = 14400;
const MIX_CACHE_PREFIX = "mix";
const MIN_TRACKS_PER_MIX = 20;

export interface SmartMixData {
  id: string;
  title: string;
  description: string;
  mixType: string;
  tracks: FilteredTrack[];
  generatedAt: string;
}

interface CachedMixes {
  mixes: SmartMixData[];
  cachedAt: number;
}

const LANG_QUERY_MAP: Record<string, string> = {
  hindi: "hindi",
  punjabi: "punjabi",
  tamil: "tamil",
  telugu: "telugu",
  bengali: "bengali",
  marathi: "marathi",
  kannada: "kannada",
  malayalam: "malayalam",
  gujarati: "gujarati",
  odia: "odia",
  assamese: "assamese",
  urdu: "urdu",
  bhojpuri: "bhojpuri",
  haryanvi: "haryanvi",
  rajasthani: "rajasthani",
  maithili: "maithili",
  konkani: "konkani",
  dogri: "dogri",
  sindhi: "sindhi",
  kashmiri: "kashmiri",
  chhattisgarhi: "chhattisgarhi",
  english: "english",
  korean: "korean kpop",
  spanish: "spanish latin",
  french: "french",
  german: "german",
  portuguese: "portuguese brazilian",
  italian: "italian",
  arabic: "arabic",
  japanese: "japanese",
  chinese: "chinese mandarin",
  turkish: "turkish",
  russian: "russian",
  thai: "thai",
  indonesian: "indonesian",
  vietnamese: "vietnamese",
  filipino: "filipino",
  swahili: "swahili afrobeat",
};

async function getUserLanguages(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguages: true },
    });
    if (Array.isArray(user?.preferredLanguages)) {
      return user.preferredLanguages as string[];
    }
  } catch { /* ignore */ }
  return [];
}

async function searchMultipleQueries(
  queries: string[],
  minTracks: number,
  seenIds?: Set<string>
): Promise<FilteredTrack[]> {
  const seen = seenIds ?? new Set<string>();
  const allTracks: FilteredTrack[] = [];

  for (const q of queries) {
    if (allTracks.length >= minTracks) break;
    try {
      const results = await searchInnertube(q);
      for (const t of results) {
        if (!seen.has(t.videoId)) {
          seen.add(t.videoId);
          allTracks.push(t);
          void tagTrack(t.videoId, t.title, t.channel).catch(() => {});
        }
      }
    } catch {
      // skip failed queries
    }
  }

  return allTracks.slice(0, Math.max(minTracks, allTracks.length));
}

export async function getUserMixes(userId: string): Promise<SmartMixData[]> {
  const cacheKey = `${MIX_CACHE_PREFIX}:user:${userId}`;
  const cached = await cacheGet<CachedMixes>(cacheKey);

  if (cached) {
    const ageSeconds = (Date.now() - cached.cachedAt) / 1000;
    if (ageSeconds > MIX_TTL * 0.75) {
      void regenerateMixes(userId).catch(() => {});
    }
    return cached.mixes;
  }

  return regenerateMixes(userId);
}

async function regenerateMixes(userId: string): Promise<SmartMixData[]> {
  const [artists, genres, userLangs] = await Promise.all([
    getUserArtistProfile(userId),
    getUserGenreProfile(userId),
    getUserLanguages(userId),
  ]);

  const langPrefix = userLangs.length > 0
    ? LANG_QUERY_MAP[userLangs[0]] ?? userLangs[0]
    : "";

  const mixes: SmartMixData[] = [];

  if (artists.length > 0) {
    const topArtist = artists[0];
    const mix = await generateArtistMix(userId, topArtist.channelName, langPrefix);
    if (mix) mixes.push(mix);
  }

  const hourMix = await generateTimeOfDayMix(userId, genres, langPrefix);
  if (hourMix) mixes.push(hourMix);

  const discoveryMix = await generateDiscoveryMix(userId, genres, langPrefix, userLangs);
  if (discoveryMix) mixes.push(discoveryMix);

  if (mixes.length > 0) {
    const cacheKey = `${MIX_CACHE_PREFIX}:user:${userId}`;
    const payload: CachedMixes = { mixes, cachedAt: Date.now() };
    await cacheSet(cacheKey, payload, MIX_TTL);

    const expiresAt = new Date(Date.now() + MIX_TTL * 1000);
    for (const mix of mixes) {
      try {
        await prisma.smartMix.upsert({
          where: { id: mix.id },
          create: {
            id: mix.id,
            userId,
            title: mix.title,
            description: mix.description,
            mixType: mix.mixType,
            trackIds: mix.tracks.map((t) => t.videoId),
            generatedAt: new Date(mix.generatedAt),
            expiresAt,
          },
          update: {
            title: mix.title,
            description: mix.description,
            trackIds: mix.tracks.map((t) => t.videoId),
            generatedAt: new Date(mix.generatedAt),
            expiresAt,
          },
        });
      } catch {
        // ignore persistence errors — cache is primary
      }
    }
  }

  return mixes;
}

async function generateArtistMix(
  userId: string,
  artistName: string,
  langPrefix: string
): Promise<SmartMixData | null> {
  try {
    const queries = [
      `${artistName} official songs`,
      `${artistName} best songs playlist`,
      `${artistName} latest songs 2026`,
    ];

    if (langPrefix) {
      queries.push(`${langPrefix} ${artistName} songs`);
    }

    const tracks = await searchMultipleQueries(queries, MIN_TRACKS_PER_MIX);
    if (tracks.length === 0) return null;

    return {
      id: `mix_artist_${userId}_${Date.now()}`,
      title: `${artistName} Mix`,
      description: `Based on your love for ${artistName}`,
      mixType: "top_artists",
      tracks,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function generateTimeOfDayMix(
  userId: string,
  genres: Array<{ genre: string; playCount: number }>,
  langPrefix: string
): Promise<SmartMixData | null> {
  const hour = new Date().getHours();
  let mood: string;
  let moodLabel: string;

  if (hour >= 5 && hour < 12) {
    mood = "upbeat morning";
    moodLabel = "Morning";
  } else if (hour >= 12 && hour < 17) {
    mood = "afternoon chill";
    moodLabel = "Afternoon";
  } else if (hour >= 17 && hour < 21) {
    mood = "evening vibes";
    moodLabel = "Evening";
  } else {
    mood = "late night relaxing";
    moodLabel = "Late Night";
  }

  const topGenre = genres[0]?.genre ?? "pop";

  const queries = [
    `${langPrefix} ${topGenre} ${mood} songs`.trim(),
    `${langPrefix} ${topGenre} ${moodLabel.toLowerCase()} playlist`.trim(),
    `${topGenre} ${mood} official songs 2026`,
  ];

  try {
    const tracks = await searchMultipleQueries(queries, MIN_TRACKS_PER_MIX);
    if (tracks.length === 0) return null;

    const cap = topGenre.charAt(0).toUpperCase() + topGenre.slice(1);

    return {
      id: `mix_tod_${userId}_${Date.now()}`,
      title: `${moodLabel} ${cap}`,
      description: `${moodLabel} vibes for your ${topGenre} mood`,
      mixType: "time_of_day",
      tracks,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function generateDiscoveryMix(
  userId: string,
  userGenres: Array<{ genre: string; playCount: number }>,
  langPrefix: string,
  userLangs: string[] = []
): Promise<SmartMixData | null> {
  const LANGUAGE_NEUTRAL_GENRES = [
    "pop",
    "rock",
    "hip-hop",
    "r&b",
    "electronic",
    "jazz",
    "classical",
    "country",
    "indie",
    "metal",
    "folk",
    "blues",
    "reggae",
    "punk",
    "soul",
    "lo-fi",
    "ambient",
  ];

  const GENRE_LANG_REQUIREMENTS: Record<string, string[]> = {
    "latin": ["spanish", "portuguese"],
    "k-pop": ["korean"],
  };

  const langSet = new Set(userLangs.map((l) => l.toLowerCase()));
  const eligible = [
    ...LANGUAGE_NEUTRAL_GENRES,
    ...Object.entries(GENRE_LANG_REQUIREMENTS)
      .filter(([, langs]) => langs.some((l) => langSet.has(l)))
      .map(([genre]) => genre),
  ];

  const genrePlayMap = new Map(userGenres.map((g) => [g.genre, g.playCount]));
  const lowExposure = eligible.filter((g) => (genrePlayMap.get(g) ?? 0) < 5);

  if (lowExposure.length === 0) return null;

  const genre = lowExposure[Math.floor(Math.random() * lowExposure.length)];

  const queries = [
    `${langPrefix} best ${genre} songs 2026`.trim(),
    `${genre} music playlist official`,
    `${langPrefix} ${genre} top songs`.trim(),
    `new ${genre} songs official 2026`,
  ];

  try {
    const tracks = await searchMultipleQueries(queries, MIN_TRACKS_PER_MIX);
    if (tracks.length === 0) return null;

    const cap = genre.charAt(0).toUpperCase() + genre.slice(1);

    return {
      id: `mix_discovery_${userId}_${Date.now()}`,
      title: `Discover ${cap}`,
      description: `Explore ${genre} — a genre you're just starting to explore`,
      mixType: "discovery",
      tracks,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

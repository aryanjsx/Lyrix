import { prisma } from "./quotaService";
import { cacheGet, cacheSet } from "./cacheService";
import { searchInnertube } from "./innertubeService";
import { FilteredTrack } from "./filterService";
import { getUserGenreProfile, getUserArtistProfile } from "./analysisService";
import { tagTrack } from "./genreService";
import { captureError } from "./telemetry";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "";
const AI_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT_MS ?? "800", 10);
const AI_ENABLED = process.env.AI_SERVICE_ENABLED === "true";
const SHADOW_MODE = process.env.SHADOW_MODE === "true";

function weightedShuffle(tracks: FilteredTrack[]): FilteredTrack[] {
  const result: FilteredTrack[] = [];
  const pool = [...tracks];
  while (pool.length > 0 && result.length < 20) {
    const weights = pool.map((t) => Math.max(t.filterScore, 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        idx = i;
        break;
      }
    }
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

const FOR_YOU_TTL = 7200;
const MORE_LIKE_THIS_TTL = 3600;

const LANG_QUERY_MAP: Record<string, string> = {
  hindi: "hindi bollywood songs",
  english: "english pop songs",
  punjabi: "punjabi songs hits",
  tamil: "tamil songs hits",
  telugu: "telugu songs hits",
  bengali: "bengali songs hits",
  marathi: "marathi songs hits",
  kannada: "kannada songs hits",
  malayalam: "malayalam songs hits",
  gujarati: "gujarati songs hits",
  odia: "odia oriya songs hits",
  assamese: "assamese songs hits",
  urdu: "urdu ghazal songs",
  bhojpuri: "bhojpuri songs hits",
  haryanvi: "haryanvi songs hits",
  rajasthani: "rajasthani folk songs",
  maithili: "maithili songs hits",
  konkani: "konkani songs hits",
  dogri: "dogri songs hits",
  sindhi: "sindhi songs hits",
  kashmiri: "kashmiri songs hits",
  chhattisgarhi: "chhattisgarhi songs hits",
  korean: "kpop songs hits",
  spanish: "latin reggaeton songs",
  french: "french songs hits",
  german: "german songs hits",
  portuguese: "brazilian portuguese songs hits",
  italian: "italian songs hits",
  arabic: "arabic songs hits",
  japanese: "japanese j-pop songs",
  chinese: "chinese mandarin c-pop songs",
  turkish: "turkish songs hits",
  russian: "russian songs hits",
  thai: "thai songs hits",
  indonesian: "indonesian malay songs hits",
  vietnamese: "vietnamese songs hits",
  filipino: "filipino opm songs hits",
  swahili: "afrobeat swahili songs hits",
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

async function generateForYouRuleBased(userId: string): Promise<FilteredTrack[]> {
  const recentHistory = await prisma.playHistory.findMany({
    where: { userId },
    orderBy: { playedAt: "desc" },
    take: 50,
    select: { trackId: true },
    distinct: ["trackId"],
  });
  const seenIds = new Set<string>(recentHistory.map((h) => h.trackId));

  const [genres, artists, userLangs] = await Promise.all([
    getUserGenreProfile(userId),
    getUserArtistProfile(userId),
    getUserLanguages(userId),
  ]);

  const queries: string[] = [];

  const topGenres = genres.slice(0, 2);
  for (const g of topGenres) {
    queries.push(`${g.genre} music 2026`);
  }

  const topArtist = artists[0];
  if (topArtist) {
    queries.push(`${topArtist.channelName} new music`);
  }

  for (const lang of userLangs.slice(0, 2)) {
    const langQuery = LANG_QUERY_MAP[lang];
    if (langQuery && !queries.some((q) => q.includes(lang))) {
      queries.push(`${langQuery} latest 2026`);
    }
  }

  let searchQueries = queries.slice(0, 5);
  if (searchQueries.length === 0) {
    if (userLangs.length > 0) {
      searchQueries = userLangs
        .slice(0, 2)
        .map((l) => LANG_QUERY_MAP[l] ?? `${l} music`)
        .map((q) => `${q} latest 2026`);
    } else {
      searchQueries = ["new music 2026"];
    }
  }

  const allTracks: FilteredTrack[] = [];

  for (const q of searchQueries) {
    try {
      const results = await searchInnertube(q);
      for (const track of results) {
        if (!seenIds.has(track.videoId)) {
          seenIds.add(track.videoId);
          allTracks.push(track);
          void tagTrack(track.videoId, track.title, track.channel).catch(() => {});
        }
      }
    } catch {
      // skip failed queries
    }
  }

  return weightedShuffle(allTracks);
}

async function getInteractionCount(userId: string): Promise<number> {
  return prisma.playHistory.count({
    where: { userId, secondsPlayed: { gte: 30 } },
  });
}

async function getRecentlyPlayedIds(userId: string, limit: number): Promise<string[]> {
  const rows = await prisma.playHistory.findMany({
    where: { userId },
    orderBy: { playedAt: "desc" },
    take: limit,
    select: { trackId: true },
    distinct: ["trackId"],
  });
  return rows.map((r) => r.trackId);
}

async function getTopTrackIds(userId: string, limit: number): Promise<string[]> {
  const rows = await prisma.playHistory.groupBy({
    by: ["trackId"],
    where: { userId, secondsPlayed: { gte: 30 } },
    _count: { trackId: true },
    orderBy: { _count: { trackId: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.trackId);
}

interface AIRecommendation {
  videoId: string;
  score: number;
  model: string;
}

async function tryAIRecommendations(userId: string): Promise<FilteredTrack[] | null> {
  if (!AI_SERVICE_URL) return null;

  try {
    const [interactionCount, recentIds, topTrackIds] = await Promise.all([
      getInteractionCount(userId),
      getRecentlyPlayedIds(userId, 50),
      getTopTrackIds(userId, 20),
    ]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

    const response = await fetch(`${AI_SERVICE_URL}/recommend/for-you`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        interactionCount,
        recentlyPlayedIds: recentIds,
        topTrackIds,
        n: 30,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn(`[AI Service] HTTP ${response.status} — falling back to rule-based`);
      return null;
    }

    const data = (await response.json()) as {
      recommendations: AIRecommendation[];
      model: string;
    };
    const videoIds: string[] = data.recommendations.map((r) => r.videoId);

    if (videoIds.length === 0) return null;

    const tracks = await prisma.track.findMany({
      where: { id: { in: videoIds } },
    });

    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const ordered: FilteredTrack[] = [];
    for (const vid of videoIds) {
      const t = trackMap.get(vid);
      if (t) {
        ordered.push({
          videoId: t.id,
          title: t.title,
          channel: t.channel,
          channelId: t.channelId ?? undefined,
          duration: t.duration,
          thumbnail: t.thumbnail,
          category: t.category as "music" | "podcast",
          filterScore: t.filterScore,
        });
      }
    }

    return ordered.length > 0 ? ordered : null;
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === "AbortError") {
      console.warn("[AI Service] Timeout — falling back to rule-based");
    } else {
      console.warn("[AI Service] Error — falling back to rule-based:", error.message);
    }
    return null;
  }
}

async function getOrAssignABGroup(userId: string): Promise<"ai" | "rule_based"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { abTestGroup: true },
  });

  if (user?.abTestGroup === "ai" || user?.abTestGroup === "rule_based") {
    return user.abTestGroup;
  }

  const pct = parseInt(process.env.AB_TEST_PERCENTAGE ?? "0", 10);
  const group: "ai" | "rule_based" = Math.random() * 100 < pct ? "ai" : "rule_based";

  await prisma.user.update({
    where: { id: userId },
    data: { abTestGroup: group },
  }).catch(() => {});

  return group;
}

export async function logRecommendationFeedback(
  userId: string,
  videoId: string,
  source: string,
  action: string,
  positionShown: number,
  playedSeconds: number = 0
): Promise<void> {
  try {
    await prisma.recommendationFeedback.create({
      data: {
        userId,
        videoId,
        source,
        action,
        positionShown,
        playedSeconds,
      },
    });
  } catch (err) {
    captureError(err as Error);
  }
}

export async function getForYou(userId: string): Promise<FilteredTrack[]> {
  const cacheKey = `reco:foryou:${userId}`;
  const cached = await cacheGet<FilteredTrack[]>(cacheKey);
  if (cached) return cached;

  if (SHADOW_MODE && AI_SERVICE_URL) {
    const ruleBasedPromise = generateForYouRuleBased(userId);
    const aiPromise = tryAIRecommendations(userId);

    const [ruleResult, aiResult] = await Promise.allSettled([ruleBasedPromise, aiPromise]);

    if (aiResult.status === "fulfilled" && aiResult.value) {
      for (let i = 0; i < aiResult.value.length; i++) {
        void logRecommendationFeedback(
          userId,
          aiResult.value[i].videoId,
          "ai_shadow",
          "shown",
          i
        );
      }
    }

    const finalResults =
      ruleResult.status === "fulfilled" ? ruleResult.value : [];
    if (finalResults.length > 0) {
      await cacheSet(cacheKey, finalResults, FOR_YOU_TTL);
    }
    return finalResults;
  }

  const userGroup = await getOrAssignABGroup(userId);

  let recommendations: FilteredTrack[] | null = null;

  if (AI_ENABLED && userGroup === "ai") {
    recommendations = await tryAIRecommendations(userId);
  }

  if (!recommendations || recommendations.length === 0) {
    recommendations = await generateForYouRuleBased(userId);
  }

  if (recommendations.length > 0) {
    await cacheSet(cacheKey, recommendations, FOR_YOU_TTL);
  }

  return recommendations;
}

export async function getMoreLikeThis(
  videoId: string,
  userId?: string
): Promise<FilteredTrack[]> {
  const cacheKey = `reco:morelike:${videoId}`;
  const cached = await cacheGet<FilteredTrack[]>(cacheKey);
  if (cached) return cached;

  if (AI_ENABLED && AI_SERVICE_URL) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

      const response = await fetch(`${AI_SERVICE_URL}/recommend/more-like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          userId: userId ?? null,
          excludeIds: [],
          n: 20,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (response.ok) {
        const data = (await response.json()) as {
          recommendations: AIRecommendation[];
        };
        const vids = data.recommendations.map((r) => r.videoId);

        if (vids.length > 0) {
          const tracks = await prisma.track.findMany({
            where: { id: { in: vids } },
          });
          const trackMap = new Map(tracks.map((t) => [t.id, t]));
          const ordered: FilteredTrack[] = [];
          for (const vid of vids) {
            const t = trackMap.get(vid);
            if (t) {
              ordered.push({
                videoId: t.id,
                title: t.title,
                channel: t.channel,
                channelId: t.channelId ?? undefined,
                duration: t.duration,
                thumbnail: t.thumbnail,
                category: t.category as "music" | "podcast",
                filterScore: t.filterScore,
              });
            }
          }
          if (ordered.length > 0) {
            await cacheSet(cacheKey, ordered, MORE_LIKE_THIS_TTL);
            return ordered;
          }
        }
      }
    } catch {
      // fall through to rule-based
    }
  }

  const track = await prisma.track.findUnique({
    where: { id: videoId },
    include: { genres: true },
  });

  let trackTitle = "";
  let trackChannel = "";
  let genre = "";

  if (track) {
    trackTitle = track.title;
    trackChannel = track.channel;
    genre = track.genres.length > 0 ? track.genres[0].genre : "";
  } else {
    try {
      const searchResults = await searchInnertube(videoId);
      const match = searchResults.find((r) => r.videoId === videoId);
      if (match) {
        trackTitle = match.title;
        trackChannel = match.channel;
      } else if (searchResults.length > 0) {
        trackTitle = searchResults[0].title;
        trackChannel = searchResults[0].channel;
      }
    } catch { /* fallback below */ }

    if (!trackTitle) return [];
  }

  const titleWords = trackTitle.split(" ").slice(0, 4).join(" ");

  let lang = "";
  if (userId) {
    const userLangs = await getUserLanguages(userId);
    if (userLangs.length > 0) lang = userLangs[0];
  }

  if (!lang) {
    const titleLower = trackTitle.toLowerCase();
    const LANG_HINTS: Record<string, string[]> = {
      hindi: ["hindi", "bollywood", "from \""],
      punjabi: ["punjabi"],
      tamil: ["tamil", "kollywood"],
      telugu: ["telugu", "tollywood"],
      bengali: ["bengali", "bangla"],
      marathi: ["marathi"],
      kannada: ["kannada"],
      malayalam: ["malayalam"],
      gujarati: ["gujarati"],
      odia: ["odia", "oriya"],
      bhojpuri: ["bhojpuri"],
      haryanvi: ["haryanvi"],
      korean: ["korean", "kpop", "k-pop"],
      japanese: ["japanese", "anime", "j-pop"],
      spanish: ["spanish", "latino", "reggaeton"],
      french: ["french", "francais"],
      arabic: ["arabic"],
      chinese: ["chinese", "mandarin"],
      turkish: ["turkish"],
    };
    for (const [language, hints] of Object.entries(LANG_HINTS)) {
      if (hints.some((h) => titleLower.includes(h))) {
        lang = language;
        break;
      }
    }
  }

  const queries: string[] = [];

  if (lang) {
    queries.push(`${lang} songs like ${titleWords}`);
    queries.push(`${trackChannel} ${lang} official songs`);
    if (genre) {
      queries.push(`${lang} ${genre} official songs 2026`);
    }
    queries.push(`latest ${lang} official songs 2026`);
  } else {
    queries.push(`${trackChannel} official songs`);
    if (genre) {
      queries.push(`${genre} songs like ${titleWords}`);
      queries.push(`${genre} official songs playlist 2026`);
    }
    queries.push(`songs similar to ${titleWords}`);
  }

  queries.push(`${trackChannel} best songs playlist`);

  const baseTitle = trackTitle.split("(")[0].trim().toLowerCase();
  const allTracks: FilteredTrack[] = [];
  const seenIds = new Set<string>([videoId]);

  for (const q of queries) {
    if (allTracks.length >= 20) break;
    try {
      const results = await searchInnertube(q);
      for (const t of results) {
        if (seenIds.has(t.videoId)) continue;
        const tBase = t.title.split("(")[0].trim().toLowerCase();
        if (baseTitle.length >= 3 && tBase === baseTitle) continue;
        seenIds.add(t.videoId);
        allTracks.push(t);
        void tagTrack(t.videoId, t.title, t.channel).catch(() => {});
      }
    } catch {
      // skip failed queries
    }
  }

  const result = allTracks.slice(0, 20);

  if (result.length > 0) {
    await cacheSet(cacheKey, result, MORE_LIKE_THIS_TTL);
  }

  return result;
}

export async function getRecentlyPlayed(
  userId: string,
  limit = 20
): Promise<
  Array<{
    videoId: string;
    title: string;
    channel: string;
    channelId: string | null;
    duration: number;
    thumbnail: string;
    category: string;
    filterScore: number;
    playedAt: Date;
    secondsPlayed: number;
  }>
> {
  const history = await prisma.playHistory.findMany({
    where: { userId, secondsPlayed: { gte: 30 } },
    orderBy: { playedAt: "desc" },
    take: limit,
    include: { track: true },
    distinct: ["trackId"],
  });

  return history.map((h) => ({
    videoId: h.trackId,
    title: h.track.title,
    channel: h.track.channel,
    channelId: h.track.channelId,
    duration: h.track.duration,
    thumbnail: h.track.thumbnail,
    category: h.track.category,
    filterScore: h.track.filterScore,
    playedAt: h.playedAt,
    secondsPlayed: h.secondsPlayed,
  }));
}

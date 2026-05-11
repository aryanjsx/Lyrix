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

interface MixSeed {
  id: string;
  label: string;
  description: string;
  color: string;
  searchQuery: string;
}

interface DailyMix extends MixSeed {
  tracks: FilteredTrack[];
  generatedAt: string;
}

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function getTimeSlot(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return "early_morning";
  if (h >= 8 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  if (h >= 21) return "night";
  return "late_night";
}

const TIME_SLOT_LABELS: Record<string, string> = {
  early_morning: "Early Morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
  late_night: "Late Night",
};

const TIME_SLOT_TERMS: Record<string, string> = {
  early_morning: "morning acoustic music",
  morning: "upbeat morning songs",
  afternoon: "lo-fi hip hop focus",
  evening: "chill evening music",
  night: "night drive music playlist",
  late_night: "late night ambient music",
};

function buildMixSeeds(
  topGenres: string[],
  topArtists: string[],
  timeSlot: string
): MixSeed[] {
  const seeds: MixSeed[] = [];

  if (topGenres[0]) {
    seeds.push({
      id: "top_mix",
      label: "Your Top Mix",
      description: `Your favourite ${topGenres[0]} tracks`,
      color: "#7F77DD",
      searchQuery: topArtists[0]
        ? `${topArtists[0]} ${topGenres[0]} songs`
        : `best ${topGenres[0]} songs`,
    });
  }

  seeds.push({
    id: "discovery_mix",
    label: "Discovery Mix",
    description: "Artists you might not know yet",
    color: "#1D9E75",
    searchQuery: topGenres[0]
      ? `new ${topGenres[0]} artists songs 2026`
      : "new popular songs 2026",
  });

  seeds.push({
    id: "chill_mix",
    label: "Chill Mix",
    description: "Easy listening for any time",
    color: "#378ADD",
    searchQuery: "lo-fi hip hop chill beats",
  });

  if (topArtists[0]) {
    seeds.push({
      id: "throwback_mix",
      label: "Throwback Mix",
      description: "Old favourites, back again",
      color: "#BA7517",
      searchQuery: `${topArtists[0]} old songs classics`,
    });
  }

  const slotLabel =
    TIME_SLOT_LABELS[timeSlot] ?? TIME_SLOT_LABELS.afternoon;
  seeds.push({
    id: `${timeSlot}_mix`,
    label: `${slotLabel} Mix`,
    description: `Perfect for ${slotLabel.toLowerCase()}`,
    color: "#D4537E",
    searchQuery: TIME_SLOT_TERMS[timeSlot] ?? TIME_SLOT_TERMS.afternoon,
  });

  if (topGenres[1]) {
    seeds.push({
      id: "genre2_mix",
      label: `${topGenres[1].charAt(0).toUpperCase()}${topGenres[1].slice(1)} Mix`,
      description: `More ${topGenres[1]} you'll love`,
      color: "#534AB7",
      searchQuery: `best ${topGenres[1]} songs playlist`,
    });
  }

  return seeds;
}

async function generateMix(seed: MixSeed): Promise<DailyMix> {
  const raw = await searchInnertube(seed.searchQuery);
  const tracks = raw.slice(0, 15);
  return { ...seed, tracks, generatedAt: new Date().toISOString() };
}

router.get("/", optionalAuth, async (req: Request, res: Response) => {
  const userId = req.userId ?? null;
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = userId
    ? `mixes:daily:${userId}:${today}`
    : `mixes:daily:guest:${today}`;
  const ttl = getSecondsUntilMidnight();

  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${Math.min(ttl, 3600)}, stale-while-revalidate=7200`
  );

  try {
    const cached = await cacheGet<DailyMix[]>(cacheKey);
    if (cached && cached.length > 0) {
      res.json(cached);
      return;
    }
  } catch {
    // proceed
  }

  let topGenres: string[] = ["pop", "hindi"];
  let topArtists: string[] = [];

  if (userId) {
    try {
      const [genreProfile, artistProfile] = await Promise.all([
        getUserGenreProfile(userId),
        getUserArtistProfile(userId),
      ]);
      if (genreProfile.length > 0) {
        topGenres = genreProfile.slice(0, 3).map((g) => g.genre);
      }
      if (artistProfile.length > 0) {
        topArtists = artistProfile
          .slice(0, 3)
          .map((a) => a.channelName)
          .filter((n) => n !== "Unknown" && n.length > 0);
      }
    } catch {
      // use defaults
    }

    if (topArtists.length === 0) {
      try {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId },
        });
        if (prefs?.seedArtists) {
          const seeds = JSON.parse(prefs.seedArtists) as string[];
          topArtists = seeds.slice(0, 3);
        }
        if (topGenres.length <= 1 && prefs?.genres) {
          const g = JSON.parse(prefs.genres) as string[];
          if (g.length > 0) topGenres = g.slice(0, 3);
        }
      } catch {
        // proceed
      }
    }
  }

  const timeSlot = getTimeSlot();
  const seeds = buildMixSeeds(topGenres, topArtists, timeSlot);

  const results = await Promise.allSettled(
    seeds.map((seed) => generateMix(seed))
  );

  const mixes = results
    .filter(
      (r) =>
        r.status === "fulfilled" &&
        (r as PromiseFulfilledResult<DailyMix>).value.tracks.length >= 4
    )
    .map((r) => (r as PromiseFulfilledResult<DailyMix>).value)
    .slice(0, 6);

  await cacheSet(cacheKey, mixes, Math.max(ttl, 300)).catch(() => {});
  res.json(mixes);
});

export default router;

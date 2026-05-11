import { Router, Request, Response } from "express";
import { searchArtistThumbnail, searchInnertube } from "../services/innertubeService";
import { cacheGet, cacheSet } from "../services/cacheService";
import { slugify, deslugify } from "../utils/slugify";

const router = Router();

const ARTIST_THUMB_TTL = 86400 * 7; // 7 days
const ARTIST_DETAIL_TTL = 3600; // 1 hour

interface ArtistTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

interface SimilarArtistEntry {
  name: string;
  slug: string;
  thumbnail: string | null;
}

async function getSimilarArtists(artistName: string): Promise<SimilarArtistEntry[]> {
  const results = await searchInnertube(`artists like ${artistName} similar music`);
  const seen = new Set<string>();
  return results
    .filter((r) => {
      const name = r.channel?.trim();
      if (!name || name.toLowerCase() === artistName.toLowerCase()) return false;
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map((r) => ({
      name: r.channel,
      slug: slugify(r.channel),
      thumbnail: r.thumbnail,
    }));
}

router.get("/page/:slug", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;

  if (!slug || slug.length < 2) {
    res.status(400).json({ error: "Artist slug is required" });
    return;
  }

  if (slug.length > 120) {
    res.status(400).json({ error: "Artist slug is too long" });
    return;
  }

  const artistName = deslugify(slug);

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");

  try {
    const cacheKey = `artist:page:${slug}`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const [popularSongs, albums, appearsOn, similarArtists, thumbnail] =
      await Promise.allSettled([
        searchInnertube(`${artistName} songs`),
        searchInnertube(`${artistName} album official playlist`),
        searchInnertube(`${artistName} feat featuring`),
        getSimilarArtists(artistName),
        searchArtistThumbnail(artistName),
      ]);

    const filterTracks = (
      result: PromiseSettledResult<ArtistTrack[]>
    ): ArtistTrack[] => {
      if (result.status !== "fulfilled") return [];
      return result.value.filter((t) => t.filterScore >= 60);
    };

    const popularFiltered = filterTracks(popularSongs);
    const appearsOnFiltered = filterTracks(appearsOn);

    const firstTrack = popularFiltered[0] ?? null;

    const artistData = {
      slug,
      name: artistName,
      avatar: thumbnail.status === "fulfilled" ? thumbnail.value : null,
      bannerImage: firstTrack?.thumbnail ?? null,
      popularSongs: popularFiltered.slice(0, 20),
      albums:
        albums.status === "fulfilled"
          ? albums.value.slice(0, 8).map((a) => ({
              id: a.videoId,
              title: a.title,
              thumbnail: a.thumbnail,
            }))
          : [],
      appearsOn: appearsOnFiltered.slice(0, 10),
      similarArtists:
        similarArtists.status === "fulfilled" ? similarArtists.value : [],
      fetchedAt: new Date().toISOString(),
    };

    res.setHeader("X-Cache", "MISS");
    await cacheSet(cacheKey, artistData, ARTIST_DETAIL_TTL);
    res.json(artistData);
  } catch {
    res.status(500).json({ error: "Failed to fetch artist page data" });
  }
});

router.get("/detail", async (req: Request, res: Response): Promise<void> => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";

  if (!name || name.length < 2) {
    res.status(400).json({ error: "Artist name is required" });
    return;
  }

  if (name.length > 100) {
    res.status(400).json({ error: "Artist name is too long" });
    return;
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");

  try {
    const cacheKey = `artist:detail:${name.toLowerCase()}`;
    const cached = await cacheGet<{
      artistName: string;
      tracks: unknown[];
      thumbnail: string | null;
    }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const [songs, thumbnail] = await Promise.allSettled([
      searchInnertube(`${name} songs`),
      searchArtistThumbnail(name),
    ]);

    const filteredSongs =
      songs.status === "fulfilled"
        ? songs.value.filter((t) => t.filterScore >= 60)
        : [];

    const result = {
      artistName: name,
      tracks: filteredSongs,
      thumbnail: thumbnail.status === "fulfilled" ? thumbnail.value : null,
    };

    await cacheSet(cacheKey, result, ARTIST_DETAIL_TTL);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch artist details" });
  }
});

router.get("/thumbnail", async (req: Request, res: Response): Promise<void> => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";

  if (!name || name.length < 2) {
    res.status(400).json({ error: "Artist name is required" });
    return;
  }

  if (name.length > 100) {
    res.status(400).json({ error: "Artist name is too long" });
    return;
  }

  try {
    const cacheKey = `artist:thumb:${name.toLowerCase()}`;
    const cached = await cacheGet<string>(cacheKey);

    if (cached) {
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.json({ name, thumbnail: cached });
      return;
    }

    const thumbnailUrl = await searchArtistThumbnail(name);

    if (thumbnailUrl) {
      await cacheSet(cacheKey, thumbnailUrl, ARTIST_THUMB_TTL);
      res.json({ name, thumbnail: thumbnailUrl });
    } else {
      res.json({ name, thumbnail: null });
    }
  } catch {
    res.status(500).json({ error: "Failed to fetch artist thumbnail" });
  }
});

router.get("/thumbnails", async (req: Request, res: Response): Promise<void> => {
  const raw = typeof req.query.names === "string" ? req.query.names.trim() : "";

  if (!raw) {
    res.status(400).json({ error: "names query param is required" });
    return;
  }

  const names = raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && n.length <= 100)
    .slice(0, 20);

  if (names.length === 0) {
    res.status(400).json({ error: "No valid artist names provided" });
    return;
  }

  try {
    const results: Record<string, string | null> = {};

    const lookups = names.map(async (name) => {
      const cacheKey = `artist:thumb:${name.toLowerCase()}`;
      const cached = await cacheGet<string>(cacheKey);
      if (cached) {
        results[name] = cached;
        return;
      }
      const thumbnailUrl = await searchArtistThumbnail(name);
      if (thumbnailUrl) {
        await cacheSet(cacheKey, thumbnailUrl, ARTIST_THUMB_TTL);
      }
      results[name] = thumbnailUrl;
    });

    await Promise.allSettled(lookups);

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.json({ thumbnails: results });
  } catch {
    res.status(500).json({ error: "Failed to fetch artist thumbnails" });
  }
});

export default router;

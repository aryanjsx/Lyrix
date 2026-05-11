import { Router, Request, Response } from "express";
import { searchArtistThumbnail, searchInnertube } from "../services/innertubeService";
import { cacheGet, cacheSet } from "../services/cacheService";

const router = Router();

const ARTIST_THUMB_TTL = 86400 * 7; // 7 days
const ARTIST_DETAIL_TTL = 3600; // 1 hour

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

    const thumbnail = await searchArtistThumbnail(name);

    if (thumbnail) {
      await cacheSet(cacheKey, thumbnail, ARTIST_THUMB_TTL);
      res.json({ name, thumbnail });
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
      const thumbnail = await searchArtistThumbnail(name);
      if (thumbnail) {
        await cacheSet(cacheKey, thumbnail, ARTIST_THUMB_TTL);
      }
      results[name] = thumbnail;
    });

    await Promise.allSettled(lookups);

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.json({ thumbnails: results });
  } catch {
    res.status(500).json({ error: "Failed to fetch artist thumbnails" });
  }
});

export default router;

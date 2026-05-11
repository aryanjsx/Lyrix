import { Router, Request, Response } from "express";
import { searchInnertube } from "../services/innertubeService";
import { cacheGet, cacheSet } from "../services/cacheService";

const router = Router();

const COLLECTION_TTL = 3600 * 6; // 6 hours

router.get("/:playlistId", async (req: Request, res: Response): Promise<void> => {
  const { playlistId } = req.params;

  if (!playlistId || playlistId.length < 2 || playlistId.length > 100) {
    res.status(400).json({ error: "Invalid playlist ID" });
    return;
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");

  try {
    const cacheKey = `collection:${playlistId}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const tracks = await searchInnertube(`youtube playlist ${playlistId}`);

    const filteredTracks = tracks.filter((t) => t.filterScore >= 60);

    const result = {
      id: playlistId,
      title: `Playlist ${playlistId}`,
      description: "",
      thumbnail: filteredTracks[0]?.thumbnail ?? null,
      channelTitle: "",
      trackCount: filteredTracks.length,
      tracks: filteredTracks,
    };

    if (filteredTracks.length > 0) {
      await cacheSet(cacheKey, result, COLLECTION_TTL);
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to load collection" });
  }
});

export default router;

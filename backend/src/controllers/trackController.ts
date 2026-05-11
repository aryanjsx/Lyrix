import { Request, Response } from "express";
import { cacheGet, cacheSet, TTL } from "../services/cacheService";
import { getVideoMetadataById, VideoMetadata } from "../services/innertubeService";

type CachedTrack = VideoMetadata;

export async function handleGetTrack(
  req: Request,
  res: Response
): Promise<void> {
  const videoId = req.params.videoId as string | undefined;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  try {
    const cacheKey = `track:${videoId}`;
    const cached = await cacheGet<CachedTrack>(cacheKey);

    if (cached) {
      res.json({ track: cached, source: "cache" });
      return;
    }

    const meta = await getVideoMetadataById(videoId);
    if (!meta) {
      res.status(404).json({ error: "Track not found" });
      return;
    }

    await cacheSet(cacheKey, meta, TTL.TRACK);

    res.json({ track: meta, source: "api" });
  } catch (err) {
    console.error("[Track] Error:", err);
    res.status(500).json({ error: "Failed to fetch track details" });
  }
}

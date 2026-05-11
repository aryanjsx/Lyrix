import { Request, Response } from "express";
import { getLyricsForTrack } from "../services/lyricsService";

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export async function handleGetLyrics(
  req: Request,
  res: Response
): Promise<void> {
  const videoId = req.params.videoId as string | undefined;

  if (!videoId || !VIDEO_ID_RE.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
  const channel = typeof req.query.channel === "string" ? req.query.channel.trim() : "";
  const durationRaw = typeof req.query.duration === "string" ? parseInt(req.query.duration, 10) : 0;
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 0;

  if (!title) {
    res.status(400).json({ error: "title query parameter is required" });
    return;
  }

  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
    const result = await Promise.race([
      getLyricsForTrack(videoId, title, channel, duration),
      timeout,
    ]);

    if (!result) {
      res.json({
        videoId,
        syncedLyrics: null,
        plainLyrics: null,
        hasSync: false,
        source: null,
      });
      return;
    }

    res.json({
      videoId,
      syncedLyrics: result.syncedLyrics,
      plainLyrics: result.plainLyrics,
      hasSync: result.hasSync,
      source: result.source,
    });
  } catch (err) {
    console.error("[Lyrics] Error:", err);
    res.status(500).json({ error: "Failed to fetch lyrics" });
  }
}

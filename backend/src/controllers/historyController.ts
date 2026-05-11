import { Request, Response } from "express";
import { logPlay, updateSecondsPlayed, getRecentPlays } from "../services/historyService";
import { trackEvent, captureError } from "../services/telemetry";

export async function handleLogPlay(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { videoId, title, channel, duration, thumbnail, category } = req.body as {
    videoId?: string;
    title?: string;
    channel?: string;
    duration?: number;
    thumbnail?: string;
    category?: string;
  };

  if (!videoId || typeof videoId !== "string") {
    res.status(400).json({ error: "videoId is required" });
    return;
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  const meta = {
    title: typeof title === "string" ? title.slice(0, 500) : undefined,
    channel: typeof channel === "string" ? channel.slice(0, 500) : undefined,
    duration: typeof duration === "number" && duration >= 0 ? duration : undefined,
    thumbnail: typeof thumbnail === "string" ? thumbnail.slice(0, 1000) : undefined,
    category: category === "music" || category === "podcast" ? category : undefined,
  };

  try {
    await logPlay(req.userId, videoId, meta);
    trackEvent("playback_started", { videoId }, req.userId);
    res.json({ success: true });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to log play" });
  }
}

export async function handleUpdateSeconds(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { videoId, seconds } = req.body as {
    videoId?: string;
    seconds?: number;
  };

  if (!videoId || typeof videoId !== "string") {
    res.status(400).json({ error: "videoId is required" });
    return;
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  const MAX_SECONDS = 86_400;
  if (typeof seconds !== "number" || seconds < 0 || seconds > MAX_SECONDS) {
    res.status(400).json({ error: "seconds must be between 0 and 86400" });
    return;
  }

  try {
    await updateSecondsPlayed(req.userId, videoId, Math.floor(seconds));
    res.json({ success: true });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to update play duration" });
  }
}

export async function handleGetRecentPlays(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1),
    500
  );

  try {
    const plays = await getRecentPlays(req.userId, limit);
    res.json({ plays });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

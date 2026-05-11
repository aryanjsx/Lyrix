import { Request, Response } from "express";
import {
  getSavedTracks,
  saveTrack,
  unsaveTrack,
  isTrackSaved,
} from "../services/savedTrackService";
import { captureError } from "../services/telemetry";
import { VIDEO_ID_REGEX, paramStr } from "../utils/validators";

function parseTrackPayload(body: Record<string, unknown>): {
  videoId: string;
  meta: {
    title: string;
    channel: string;
    duration: number;
    thumbnail: string;
    category: string;
    filterScore: number;
  };
} | null {
  const videoId = body.videoId;
  if (typeof videoId !== "string" || !VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }

  const title = body.title;
  const channel = body.channel;
  const duration = body.duration;
  const thumbnail = body.thumbnail;
  const category = body.category;
  const filterScore = body.filterScore;

  if (typeof title !== "string" || typeof channel !== "string") return null;
  if (typeof thumbnail !== "string" || typeof category !== "string") return null;
  if (typeof duration !== "number" || typeof filterScore !== "number") return null;

  return {
    videoId,
    meta: {
      title,
      channel,
      duration,
      thumbnail,
      category,
      filterScore,
    },
  };
}

export async function handleListSaved(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 50;

  try {
    const { tracks: rows, nextCursor } = await getSavedTracks(req.userId, cursor, limit);
    res.json({
      tracks: rows.map((s) => ({
        videoId: s.trackId,
        savedAt: s.savedAt,
        title: s.track.title,
        channel: s.track.channel,
        duration: s.track.duration,
        thumbnail: s.track.thumbnail,
        category: s.track.category,
        filterScore: s.track.filterScore,
      })),
      nextCursor,
    });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to list saved tracks" });
  }
}

export async function handleSaveTrack(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = parseTrackPayload(req.body as Record<string, unknown>);
  if (!parsed) {
    res.status(400).json({ error: "Invalid track payload" });
    return;
  }

  try {
    await saveTrack(req.userId, parsed.videoId, parsed.meta);
    res.status(201).json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_VIDEO_ID") {
      res.status(400).json({ error: "Invalid video ID" });
      return;
    }
    captureError(err as Error);
    res.status(500).json({ error: "Failed to save track" });
  }
}

export async function handleUnsaveTrack(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const videoId = paramStr(req.params.videoId);
  if (!VIDEO_ID_REGEX.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  try {
    await unsaveTrack(req.userId, videoId);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_VIDEO_ID") {
      res.status(400).json({ error: "Invalid video ID" });
      return;
    }
    captureError(err as Error);
    res.status(500).json({ error: "Failed to remove saved track" });
  }
}

export async function handleGetSaveStatus(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const videoId = paramStr(req.params.videoId);
  if (!VIDEO_ID_REGEX.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  try {
    const saved = await isTrackSaved(req.userId, videoId);
    res.json({ saved });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_VIDEO_ID") {
      res.status(400).json({ error: "Invalid video ID" });
      return;
    }
    captureError(err as Error);
    res.status(500).json({ error: "Failed to check save status" });
  }
}

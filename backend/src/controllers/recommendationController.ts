import { Request, Response } from "express";
import { getForYou, getMoreLikeThis, getRecentlyPlayed, logRecommendationFeedback } from "../services/recommendationService";
import { getTrending, getDiscover } from "../services/trendingService";
import { getUserMixes } from "../services/mixService";
import { captureError } from "../services/telemetry";
import { VIDEO_ID_REGEX } from "../utils/validators";

export async function handleGetForYou(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const tracks = await getForYou(req.userId);
    res.json({ tracks });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
}

function parseLangs(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
}

export async function handleGetTrending(req: Request, res: Response): Promise<void> {
  try {
    const languages = parseLangs(req.query.languages);
    const tracks = await getTrending(languages.length > 0 ? languages : undefined);
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    res.json({ tracks });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch trending" });
  }
}

export async function handleGetMoreLikeThis(req: Request, res: Response): Promise<void> {
  const { videoId } = req.params;
  if (!videoId || typeof videoId !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Valid videoId is required" });
    return;
  }
  try {
    const tracks = await getMoreLikeThis(videoId, req.userId);
    res.json({ tracks });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch similar tracks" });
  }
}

export async function handleGetMixes(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const mixes = await getUserMixes(req.userId);
    res.json({ mixes });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch mixes" });
  }
}

export async function handleGetDiscover(_req: Request, res: Response): Promise<void> {
  try {
    const categories = await getDiscover();
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.json({ categories });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch discover content" });
  }
}

export async function handleLogRecommendationFeedback(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { videoId, source, action, positionShown, playedSeconds } = req.body;

  if (!videoId || typeof videoId !== "string" || !VIDEO_ID_REGEX.test(videoId)) {
    res.status(400).json({ error: "Valid videoId required" });
    return;
  }

  const validSources = ["ai", "rule_based", "search", "ai_shadow"];
  const validActions = ["played", "skipped", "saved", "ignored", "shown"];

  if (!validSources.includes(source)) {
    res.status(400).json({ error: "Invalid source" });
    return;
  }
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  void logRecommendationFeedback(
    req.userId,
    videoId,
    source,
    action,
    typeof positionShown === "number" ? positionShown : -1,
    typeof playedSeconds === "number" ? playedSeconds : 0
  );

  res.json({ success: true });
}

export async function handleGetRecentlyPlayed(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 20;
    const tracks = await getRecentlyPlayed(req.userId, limit);
    res.json({ tracks });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch recently played" });
  }
}

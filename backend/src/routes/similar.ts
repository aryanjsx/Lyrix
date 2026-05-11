import { Router, Request, Response } from "express";
import { optionalAuth } from "../middleware/requireAuth";
import { generalLimiter } from "../middleware/rateLimiter";
import { fetchSimilarTracks, fetchOneNewSimilarTrack } from "../services/similarTracksService";
import { getTodayQuota } from "../services/quotaService";
import { VIDEO_ID_REGEX } from "../utils/validators";

const router = Router();

const QUOTA_LIMIT = 9000;

async function isQuotaSafe(): Promise<boolean> {
  try {
    const quota = await getTodayQuota();
    return quota.units < QUOTA_LIMIT;
  } catch {
    return false;
  }
}

router.get("/seed", optionalAuth, generalLimiter, async (req: Request, res: Response): Promise<void> => {
  const videoId = String(req.query.videoId ?? "").trim();
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    res.status(400).json({ error: "Invalid or missing videoId" });
    return;
  }

  const genre = String(req.query.genre ?? "").trim();
  const language = String(req.query.language ?? "").trim();
  const count = Math.min(Math.max(parseInt(String(req.query.count ?? "20"), 10) || 20, 1), 30);

  try {
    const quotaSafe = await isQuotaSafe();
    const tracks = await fetchSimilarTracks(videoId, {
      genre: quotaSafe ? genre : "",
      language,
      count,
      excludeIds: [],
    });

    res.json({
      tracks,
      seedVideoId: videoId,
      genre: genre || "default",
      language: language || "default",
      cacheHit: tracks.length > 0,
      meta: {
        totalInCache: tracks.length,
        returned: tracks.length,
        quotaSafe,
      },
    });
  } catch (err) {
    console.error("[Similar/seed] Error:", (err as Error).message);
    res.json({
      tracks: [],
      seedVideoId: videoId,
      genre: genre || "default",
      language: language || "default",
      cacheHit: false,
      meta: { totalInCache: 0, returned: 0, error: "fetch_failed" },
    });
  }
});

router.get("/next", optionalAuth, generalLimiter, async (req: Request, res: Response): Promise<void> => {
  const seedVideoId = String(req.query.seedVideoId ?? "").trim();
  if (!seedVideoId || !VIDEO_ID_REGEX.test(seedVideoId)) {
    res.status(400).json({ error: "Invalid or missing seedVideoId" });
    return;
  }

  const excludeIdsRaw = String(req.query.excludeIds ?? "");
  const excludeIds = excludeIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && VIDEO_ID_REGEX.test(s));

  const genre = String(req.query.genre ?? "").trim();
  const language = String(req.query.language ?? "").trim();

  try {
    const track = await fetchOneNewSimilarTrack(seedVideoId, {
      excludeIds,
      genre,
      language,
    });

    if (track) {
      res.json({ track, fromCache: true });
    } else {
      res.json({ track: null, reason: "exhausted" });
    }
  } catch (err) {
    console.error("[Similar/next] Error:", (err as Error).message);
    res.json({ track: null, reason: "error" });
  }
});

export default router;

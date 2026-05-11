import { Router, Request, Response } from "express";
import {
  handleLogPlay,
  handleUpdateSeconds,
  handleGetRecentPlays,
} from "../controllers/historyController";
import { requireAuth, optionalAuth } from "../middleware/requireAuth";
import { calculateStreak, getWeeklyRecap } from "../services/streakService";
import { prisma } from "../lib/prisma";
import { paramStr } from "../utils/validators";

const router = Router();

router.get("/tracks", requireAuth, handleGetRecentPlays);
router.post("/log", requireAuth, handleLogPlay);
router.patch("/update", requireAuth, handleUpdateSeconds);

router.get("/recent", optionalAuth, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "private, max-age=60");

  if (!req.userId) {
    res.json([]);
    return;
  }

  const limit = Math.min(Number(req.query.limit ?? 12), 24);

  try {
    const history = await prisma.playHistory.findMany({
      where: { userId: req.userId },
      include: { track: true },
      orderBy: { playedAt: "desc" },
      take: limit * 3,
    });

    const seen = new Set<string>();
    const deduped = history
      .filter((h) => {
        if (!h.track || seen.has(h.trackId)) return false;
        seen.add(h.trackId);
        return true;
      })
      .slice(0, limit)
      .map((h) => ({
        videoId: h.track.id,
        title: h.track.title,
        channel: h.track.channel,
        duration: h.track.duration,
        thumbnail: h.track.thumbnail,
        playedAt: h.playedAt.toISOString(),
      }));

    res.json(deduped);
  } catch {
    res.status(500).json({ error: "Failed to fetch recent plays" });
  }
});

router.get("/streak", requireAuth, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "private, max-age=120");

  try {
    const streak = await calculateStreak(req.userId!);
    res.json(streak);
  } catch {
    res.status(500).json({ error: "Failed to calculate streak" });
  }
});

router.get("/weekly-recap", requireAuth, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "private, max-age=300");

  try {
    const recap = await getWeeklyRecap(req.userId!);
    res.json(recap);
  } catch {
    res.status(500).json({ error: "Failed to fetch weekly recap" });
  }
});

router.delete("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.playHistory.deleteMany({
      where: { userId: req.userId! },
    });
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.playHistory.deleteMany({
      where: {
        id: paramStr(req.params.id),
        userId: req.userId!,
      },
    });
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: "Failed to delete history entry" });
  }
});

export default router;

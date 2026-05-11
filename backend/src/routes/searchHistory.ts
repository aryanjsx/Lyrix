import { Router, Request, Response } from "express";
import { prisma } from "../services/quotaService";
import { cacheGet, cacheSet } from "../services/cacheService";
import { requireAuth, optionalAuth } from "../middleware/requireAuth";

const router = Router();

const CURATED_TRENDING = [
  "Arijit Singh",
  "AP Dhillon",
  "Lo-fi study beats",
  "Bollywood hits 2026",
  "Sidhu Moose Wala",
  "Indie music",
  "Punjabi songs",
  "Tamil hits",
];

router.get("/trending", optionalAuth, async (_req: Request, res: Response) => {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );

  try {
    const cached = await cacheGet<string[]>("trending_searches");
    if (cached && cached.length > 0) {
      res.json(cached);
      return;
    }
  } catch {
    // proceed without cache
  }

  try {
    const topQueries = await prisma.searchHistory.groupBy({
      by: ["query"],
      _count: { query: true },
      where: {
        searchedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { _count: { query: "desc" } },
      take: 8,
    });

    const trending =
      topQueries.length >= 4
        ? topQueries.map((q) => q.query)
        : CURATED_TRENDING;

    await cacheSet("trending_searches", trending, 3600).catch(() => {});
    res.json(trending);
  } catch {
    res.json(CURATED_TRENDING);
  }
});

router.post("/history", requireAuth, async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    res.sendStatus(204);
    return;
  }

  const trimmed = query.trim().slice(0, 200);

  try {
    await prisma.searchHistory.upsert({
      where: {
        userId_query: { userId: req.userId!, query: trimmed },
      },
      update: { searchedAt: new Date() },
      create: {
        userId: req.userId!,
        query: trimmed,
        searchedAt: new Date(),
      },
    });
  } catch {
    // non-critical — fail silently
  }

  res.sendStatus(204);
});

router.get("/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const history = await prisma.searchHistory.findMany({
      where: { userId: req.userId! },
      orderBy: { searchedAt: "desc" },
      take: 20,
      select: { query: true, searchedAt: true },
    });

    res.json(history);
  } catch {
    res.json([]);
  }
});

router.delete("/history", requireAuth, async (req: Request, res: Response) => {
  const { query } = req.body;

  try {
    if (query && typeof query === "string") {
      await prisma.searchHistory.deleteMany({
        where: { userId: req.userId!, query: query.trim() },
      });
    } else {
      await prisma.searchHistory.deleteMany({
        where: { userId: req.userId! },
      });
    }
  } catch {
    // fail silently
  }

  res.sendStatus(204);
});

export default router;

import { Router, Request, Response } from "express";
import { searchInnertube } from "../services/innertubeService";
import { cacheGet, cacheSet } from "../services/cacheService";

const router = Router();

const SUGGEST_TTL = 300; // 5 min

router.get("/suggestions", async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  if (q.length > 200) {
    res.status(400).json({ error: "Query too long" });
    return;
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const cacheKey = `suggest:${q.toLowerCase()}`;
    const cached = await cacheGet<string[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const results = await searchInnertube(q);

    const suggestions = [
      ...new Set(
        results
          .filter((r) => r.filterScore >= 60)
          .flatMap((r) => [r.title.slice(0, 40), r.channel])
          .filter((s) => s.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 6)
      ),
    ];

    await cacheSet(cacheKey, suggestions, SUGGEST_TTL);
    res.json(suggestions);
  } catch {
    res.json([]);
  }
});

export default router;

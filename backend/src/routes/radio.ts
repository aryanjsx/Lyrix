import { Router, Request, Response } from "express";
import { optionalAuth } from "../middleware/requireAuth";
import { cacheGet, cacheSet } from "../services/cacheService";
import { searchInnertube } from "../services/innertubeService";
import { FilteredTrack } from "../services/filterService";

const router = Router();

const PAGE_VARIANTS = [
  "",
  "popular songs",
  "best songs playlist",
  "top hits",
  "similar artists songs",
];

function buildRadioQueries(
  seedType: string,
  seedId: string,
  seedLabel: string,
  page: number
): string[] {
  const variant =
    PAGE_VARIANTS[Math.min(page - 1, PAGE_VARIANTS.length - 1)];

  if (seedType === "artist") {
    return [
      `${seedId} ${variant}`.trim(),
      `songs like ${seedId}`,
      `artists similar to ${seedId} songs`,
    ];
  }

  return [
    `${seedLabel} ${variant}`.trim(),
    `songs similar to ${seedLabel}`,
    `music like ${seedLabel} playlist`,
  ];
}

router.post("/tracks", optionalAuth, async (req: Request, res: Response) => {
  const { seedType, seedId, seedLabel, page = 1, excludeIds = [] } = req.body;

  if (!seedType || !seedId) {
    res.status(400).json({ error: "seedType and seedId are required" });
    return;
  }

  const safeLabel =
    typeof seedLabel === "string" ? seedLabel.slice(0, 200) : seedId;
  const safePage = Math.max(1, Math.min(Number(page) || 1, 20));
  const safeExcludeIds = Array.isArray(excludeIds)
    ? excludeIds.filter(
        (id: unknown) => typeof id === "string" && id.length <= 20
      )
    : [];

  const excludeSet = new Set(safeExcludeIds);

  const cacheKey = `radio:${seedType}:${seedId}:p${safePage}`;
  let tracks: FilteredTrack[] = [];

  try {
    const cached = await cacheGet<FilteredTrack[]>(cacheKey);
    if (cached && cached.length > 0) {
      tracks = cached;
    }
  } catch {
    // proceed without cache
  }

  if (tracks.length === 0) {
    const queries = buildRadioQueries(
      seedType,
      seedId,
      safeLabel,
      safePage
    );

    const results = await Promise.allSettled(
      queries.map((q) => searchInnertube(q))
    );

    const allRaw = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r as PromiseFulfilledResult<FilteredTrack[]>).value);

    const seen = new Set<string>();
    tracks = [];
    for (const t of allRaw) {
      if (!seen.has(t.videoId)) {
        seen.add(t.videoId);
        tracks.push(t);
      }
      if (tracks.length >= 20) break;
    }
    await cacheSet(cacheKey, tracks, 1800).catch(() => {});
  }

  const filtered = tracks
    .filter((t) => !excludeSet.has(t.videoId))
    .filter(
      (t, i, arr) => arr.findIndex((x) => x.videoId === t.videoId) === i
    )
    .slice(0, 15);

  res.setHeader("Cache-Control", "private, no-cache");
  res.json(filtered);
});

export default router;

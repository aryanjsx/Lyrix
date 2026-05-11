import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../services/quotaService";

const router = Router();

router.post(
  "/complete",
  requireAuth,
  async (req: Request, res: Response) => {
    const { languages, genres, artists } = req.body;

    if (!Array.isArray(languages) || !Array.isArray(genres)) {
      res.status(400).json({ error: "languages and genres are required" });
      return;
    }

    const safeLanguages = languages
      .filter((l: unknown) => typeof l === "string")
      .slice(0, 20);
    const safeGenres = genres
      .filter((g: unknown) => typeof g === "string")
      .slice(0, 20);
    const safeArtists = (Array.isArray(artists) ? artists : [])
      .filter((a: unknown) => typeof a === "string")
      .slice(0, 30);

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: req.userId! },
          data: {
            hasCompletedOnboarding: true,
            preferredLanguages: safeLanguages,
          },
        }),
        prisma.userPreferences.upsert({
          where: { userId: req.userId! },
          create: {
            userId: req.userId!,
            languages: JSON.stringify(safeLanguages),
            genres: JSON.stringify(safeGenres),
            seedArtists: JSON.stringify(safeArtists),
          },
          update: {
            languages: JSON.stringify(safeLanguages),
            genres: JSON.stringify(safeGenres),
            seedArtists: JSON.stringify(safeArtists),
          },
        }),
      ]);
    } catch (err) {
      console.error("[Onboarding] Save failed:", err);
      res.status(500).json({ error: "Failed to save preferences" });
      return;
    }

    res.sendStatus(204);
  }
);

router.get(
  "/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { hasCompletedOnboarding: true },
      });
      res.json({
        hasCompletedOnboarding: user?.hasCompletedOnboarding ?? false,
      });
    } catch {
      res.json({ hasCompletedOnboarding: false });
    }
  }
);

export default router;

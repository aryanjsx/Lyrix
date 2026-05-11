import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  handleListPlaylists,
  handleCreatePlaylist,
  handleGetPlaylist,
  handleUpdatePlaylist,
  handleDeletePlaylist,
  handleAddTrack,
  handleRemoveTrack,
  handleReorderTracks,
  handleEnableSync,
  handleExportToYouTube,
  handlePullSync,
  handleListYouTubePlaylists,
  handleImportYouTubePlaylist,
} from "../controllers/playlistController";
import { requireAuth } from "../middleware/requireAuth";
import { generalLimiter, syncLimiter } from "../middleware/rateLimiter";
import { prisma } from "../lib/prisma";
import { paramStr } from "../utils/validators";

const router = Router();

router.use(generalLimiter);

router.get("/", requireAuth, handleListPlaylists);
router.post("/", requireAuth, handleCreatePlaylist);

router.get("/import/youtube", requireAuth, syncLimiter, handleListYouTubePlaylists);
router.post("/import/youtube/:ytId", requireAuth, syncLimiter, handleImportYouTubePlaylist);

router.get("/shared/:token", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

  const token = paramStr(req.params.token);
  if (!token) {
    res.sendStatus(400);
    return;
  }

  try {
    const playlist = await prisma.playlist.findFirst({
      where: { shareToken: token, isPublic: true },
    });

    if (!playlist) {
      res.sendStatus(404);
      return;
    }

    const playlistTracks = await prisma.playlistTrack.findMany({
      where: { playlistId: playlist.id },
      include: { track: true },
      orderBy: { position: "asc" },
    });

    res.json({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      coverImage: playlist.coverImage,
      trackCount: playlistTracks.length,
      tracks: playlistTracks.map((pt) => ({
        videoId: pt.track.id,
        title: pt.track.title,
        channel: pt.track.channel,
        duration: pt.track.duration,
        thumbnail: pt.track.thumbnail,
        category: pt.track.category,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load shared playlist" });
  }
});

router.get("/:id", requireAuth, handleGetPlaylist);
router.patch("/:id", requireAuth, handleUpdatePlaylist);
router.delete("/:id", requireAuth, handleDeletePlaylist);

router.post("/:id/share", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const playlistId = paramStr(req.params.id);

  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: req.userId! },
    });

    if (!playlist) {
      res.sendStatus(404);
      return;
    }

    const token = playlist.shareToken ?? crypto.randomBytes(8).toString("hex");
    await prisma.playlist.update({
      where: { id: playlistId },
      data: { shareToken: token, isPublic: true },
    });

    const appUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? "http://localhost:3000";
    const shareUrl = `${appUrl}/playlist/shared/${token}`;
    res.json({ shareUrl, token });
  } catch {
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

router.patch("/:id/cover", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const playlistId = paramStr(req.params.id);

  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: req.userId! },
    });

    if (!playlist) {
      res.sendStatus(404);
      return;
    }

    const coverImage = typeof req.body.coverImage === "string" ? req.body.coverImage : null;

    if (coverImage && coverImage.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: "Image must be under 2MB" });
      return;
    }

    await prisma.playlist.update({
      where: { id: playlistId },
      data: { coverImage },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update cover" });
  }
});

router.post("/:id/tracks", requireAuth, handleAddTrack);
router.patch("/:id/tracks/reorder", requireAuth, handleReorderTracks);
router.delete("/:id/tracks/:trackId", requireAuth, handleRemoveTrack);

router.post("/:id/sync/enable", requireAuth, syncLimiter, handleEnableSync);
router.post("/:id/sync/export", requireAuth, syncLimiter, handleExportToYouTube);
router.post("/:id/sync/pull", requireAuth, syncLimiter, handlePullSync);

export default router;

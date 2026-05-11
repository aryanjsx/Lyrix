import { Request, Response } from "express";
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistWithTracks,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderTracks,
  type TrackMetadata,
} from "../services/playlistService";
import {
  getUserYouTubePlaylists,
  importYouTubePlaylist,
  exportToYouTube,
  pullSync,
} from "../services/youtubeSyncService";
import { captureError } from "../services/telemetry";
import { VIDEO_ID_REGEX, paramStr } from "../utils/validators";

const PLAYLIST_CUID_REGEX = /^c[a-z0-9]{24}$/;
const YT_PLAYLIST_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

type PlaylistWithTracks = Awaited<ReturnType<typeof getPlaylistWithTracks>>;

function formatPlaylist(playlist: PlaylistWithTracks) {
  return {
    id: playlist.id,
    maxTracks: 500,
    name: playlist.name,
    description: playlist.description,
    coverThumbnail: playlist.coverThumbnail,
    syncEnabled: playlist.syncEnabled,
    youtubePlaylistId: playlist.youtubePlaylistId,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    tracks: playlist.tracks.map((pt) => ({
      id: pt.id,
      videoId: pt.trackId,
      position: pt.position,
      addedAt: pt.addedAt,
      title: pt.track.title,
      channel: pt.track.channel,
      duration: pt.track.duration,
      thumbnail: pt.track.thumbnail,
      category: pt.track.category,
      filterScore: pt.track.filterScore,
    })),
  };
}

function mapPlaylistServiceError(err: unknown, res: Response): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (msg === "NOT_FOUND") {
    res.status(404).json({ error: "Playlist not found" });
    return true;
  }
  if (msg === "INVALID_PLAYLIST_NAME") {
    res.status(400).json({ error: "name must be 1-100 characters" });
    return true;
  }
  if (msg === "INVALID_DESCRIPTION") {
    res.status(400).json({ error: "description must be at most 500 characters" });
    return true;
  }
  if (msg === "INVALID_VIDEO_ID") {
    res.status(400).json({ error: "Invalid video ID" });
    return true;
  }
  if (msg === "INVALID_ORDER") {
    res.status(400).json({
      error: "orderedTrackIds must list each track in the playlist exactly once",
    });
    return true;
  }
  if (msg === "PLAYLIST_TRACK_LIMIT") {
    res.status(400).json({ error: "Playlist limit reached. Maximum 500 tracks per playlist." });
    return true;
  }
  return false;
}

function mapYouTubeSyncError(err: unknown, res: Response): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (msg === "YOUTUBE_AUTH_REQUIRED") {
    res.status(401).json({
      error: "YouTube authorization required. Re-authenticate with YouTube access.",
    });
    return true;
  }
  if (msg === "NOT_FOUND") {
    res.status(404).json({ error: "Playlist not found" });
    return true;
  }
  if (msg === "SYNC_NOT_LINKED") {
    res
      .status(400)
      .json({ error: "Playlist is not linked to a YouTube playlist" });
    return true;
  }
  if (msg === "YOUTUBE_PLAYLIST_NOT_FOUND") {
    res.status(404).json({ error: "YouTube playlist not found" });
    return true;
  }
  if (msg === "EXPORT_DAILY_LIMIT") {
    res.status(429).json({ error: "Daily YouTube export limit reached" });
    return true;
  }
  if (msg === "EXPORT_TRACK_LIMIT") {
    res.status(400).json({ error: "Playlist has too many tracks to export" });
    return true;
  }
  if (msg === "QUOTA_BLOCKED" || msg === "EXPORT_QUOTA_BLOCKED") {
    res.status(503).json({ error: "API quota exceeded. Try again later." });
    return true;
  }
  if (msg === "VIDEO_DETAILS_UNAVAILABLE") {
    res.status(502).json({ error: "Could not load video details from YouTube" });
    return true;
  }
  return false;
}

function parseTrackMetadata(body: Record<string, unknown>): TrackMetadata | null {
  const {
    title,
    channel,
    duration,
    thumbnail,
    category,
    filterScore,
  } = body;

  if (typeof title !== "string" || typeof channel !== "string") return null;
  if (typeof thumbnail !== "string" || typeof category !== "string") return null;
  if (typeof duration !== "number" || typeof filterScore !== "number")
    return null;

  return {
    title,
    channel,
    duration,
    thumbnail,
    category,
    filterScore,
  };
}

export async function handleListPlaylists(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const playlists = await getUserPlaylists(req.userId);
    res.json({ playlists });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to list playlists" });
  }
}

export async function handleCreatePlaylist(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { name, description } = req.body as {
    name?: unknown;
    description?: unknown;
  };

  if (typeof name !== "string") {
    res.status(400).json({ error: "name must be 1-100 characters" });
    return;
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    res.status(400).json({ error: "name must be 1-100 characters" });
    return;
  }

  if (description != null) {
    if (typeof description !== "string" || description.length > 500) {
      res.status(400).json({ error: "description must be at most 500 characters" });
      return;
    }
  }

  try {
    const playlist = await createPlaylist(
      req.userId,
      trimmedName,
      typeof description === "string" ? description : undefined
    );
    res.status(201).json(playlist);
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to create playlist" });
  }
}

export async function handleGetPlaylist(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const playlistId = paramStr(req.params.id);

  try {
    const playlist = await getPlaylistWithTracks(playlistId, req.userId);
    res.json(formatPlaylist(playlist));
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to load playlist" });
  }
}

export async function handleUpdatePlaylist(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const playlistId = paramStr(req.params.id);
  const body = req.body as { name?: unknown; description?: unknown };
  const data: { name?: string; description?: string | null } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      res.status(400).json({ error: "name must be 1-100 characters" });
      return;
    }
    const trimmedName = body.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      res.status(400).json({ error: "name must be 1-100 characters" });
      return;
    }
    data.name = trimmedName;
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      data.description = null;
    } else if (
      typeof body.description === "string" &&
      body.description.length <= 500
    ) {
      data.description = body.description;
    } else {
      res.status(400).json({ error: "description must be at most 500 characters" });
      return;
    }
  }

  if (data.name === undefined && data.description === undefined) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const updated = await updatePlaylist(playlistId, req.userId, data);
    res.json(updated);
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to update playlist" });
  }
}

export async function handleDeletePlaylist(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const playlistId = paramStr(req.params.id);

  try {
    await deletePlaylist(playlistId, req.userId);
    res.json({ success: true });
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
}

export async function handleAddTrack(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const playlistId = paramStr(req.params.id);
  const { videoId } = req.body as { videoId?: unknown };

  if (typeof videoId !== "string" || !VIDEO_ID_REGEX.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" });
    return;
  }

  const meta = parseTrackMetadata(req.body as Record<string, unknown>);
  if (!meta) {
    res.status(400).json({ error: "Invalid track metadata" });
    return;
  }

  try {
    await addTrackToPlaylist(playlistId, req.userId, videoId, meta);
    const playlist = await getPlaylistWithTracks(playlistId, req.userId);
    const row = playlist.tracks.find((t) => t.trackId === videoId);
    res.status(201).json({
      track: row
        ? {
            id: row.id,
            videoId: row.trackId,
            position: row.position,
            addedAt: row.addedAt,
            title: row.track.title,
            channel: row.track.channel,
            duration: row.track.duration,
            thumbnail: row.track.thumbnail,
            category: row.track.category,
            filterScore: row.track.filterScore,
          }
        : null,
    });
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to add track" });
  }
}

export async function handleRemoveTrack(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const playlistId = paramStr(req.params.id);
  const trackIdParam = paramStr(req.params.trackId);

  if (!VIDEO_ID_REGEX.test(trackIdParam)) {
    res.status(400).json({ error: "Invalid track id" });
    return;
  }

  try {
    await removeTrackFromPlaylist(playlistId, req.userId, trackIdParam);
    res.json({ success: true });
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to remove track" });
  }
}

export async function handleReorderTracks(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const playlistId = paramStr(req.params.id);
  const { orderedTrackIds } = req.body as { orderedTrackIds?: unknown };

  if (
    !Array.isArray(orderedTrackIds) ||
    !orderedTrackIds.every((x) => typeof x === "string")
  ) {
    res.status(400).json({ error: "orderedTrackIds must be an array of strings" });
    return;
  }

  try {
    await reorderTracks(playlistId, req.userId, orderedTrackIds as string[]);
    const playlist = await getPlaylistWithTracks(playlistId, req.userId);
    res.json(formatPlaylist(playlist));
  } catch (err) {
    if (mapPlaylistServiceError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to reorder tracks" });
  }
}

export async function handleEnableSync(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const id = paramStr(req.params.id);
  if (!PLAYLIST_CUID_REGEX.test(id)) {
    res.status(400).json({ error: "Invalid playlist id" });
    return;
  }

  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  const proto = (req.get("x-forwarded-proto") ?? req.protocol) || "http";
  const base = `${proto}://${host}`;

  res.redirect(
    302,
    `${base}/api/auth/youtube-sync?returnPlaylistId=${encodeURIComponent(id)}`
  );
}

export async function handleExportToYouTube(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const result = await exportToYouTube(req.userId, paramStr(req.params.id));
    res.json(result);
  } catch (err) {
    if (mapYouTubeSyncError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to export playlist to YouTube" });
  }
}

export async function handlePullSync(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const result = await pullSync(req.userId, paramStr(req.params.id));
    res.json({
      addedCount: result.addedCount,
      removedFromYouTube: result.removedFromYouTube.map((t) => ({
        videoId: t.id,
        title: t.title,
        channel: t.channel,
        duration: t.duration,
        thumbnail: t.thumbnail,
        category: t.category,
        filterScore: t.filterScore,
      })),
    });
  } catch (err) {
    if (mapYouTubeSyncError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to pull YouTube playlist" });
  }
}

export async function handleListYouTubePlaylists(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const playlists = await getUserYouTubePlaylists(req.userId);
    res.json({ playlists });
  } catch (err) {
    if (mapYouTubeSyncError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to list YouTube playlists" });
  }
}

export async function handleImportYouTubePlaylist(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const ytId = paramStr(req.params.ytId);
  if (!ytId || !YT_PLAYLIST_ID_REGEX.test(ytId)) {
    res.status(400).json({ error: "Invalid YouTube playlist id" });
    return;
  }

  try {
    const result = await importYouTubePlaylist(req.userId, ytId);
    res.status(201).json(result);
  } catch (err) {
    if (mapYouTubeSyncError(err, res)) return;
    captureError(err as Error);
    res.status(500).json({ error: "Failed to import YouTube playlist" });
  }
}

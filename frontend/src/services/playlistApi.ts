import type { Track, PlaylistSummary } from "@/store";
import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PlaylistTrackApi {
  id: string;
  videoId: string;
  position: number;
  addedAt: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

export interface PlaylistDetailApi {
  id: string;
  name: string;
  description: string | null;
  coverThumbnail: string | null;
  syncEnabled: boolean;
  youtubePlaylistId: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: PlaylistTrackApi[];
}

export interface SavedTrackApiRow {
  videoId: string;
  savedAt: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as unknown as { error?: string };
      if (typeof body?.error === "string") msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function trackMeta(track: Track, filterScore = 0) {
  return {
    title: track.title,
    channel: track.channel,
    duration: track.duration,
    thumbnail: track.thumbnail,
    category: track.category,
    filterScore,
  };
}

export async function listPlaylists(): Promise<PlaylistSummary[]> {
  const res = await fetchWithAuth(`${API_URL}/api/playlists`);
  const data = await handleJson<{
    playlists: Array<{
      id: string;
      name: string;
      trackCount: number;
      coverThumbnail: string | null;
      syncEnabled: boolean;
      createdAt: string;
    }>;
  }>(res);
  return data.playlists;
}

export async function createPlaylist(body: {
  name: string;
  description?: string;
}): Promise<PlaylistSummary> {
  const res = await fetchWithAuth(`${API_URL}/api/playlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const created = await handleJson<{
    id: string;
    name: string;
    description: string | null;
    coverThumbnail: string | null;
    syncEnabled: boolean;
    createdAt: string;
  }>(res);
  return {
    id: created.id,
    name: created.name,
    trackCount: 0,
    coverThumbnail: created.coverThumbnail,
    syncEnabled: created.syncEnabled,
    createdAt: created.createdAt,
  };
}

export async function renamePlaylist(
  id: string,
  name: string
): Promise<PlaylistDetailApi> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
  return handleJson<PlaylistDetailApi>(res);
}

export async function getPlaylist(id: string): Promise<PlaylistDetailApi> {
  const res = await fetchWithAuth(`${API_URL}/api/playlists/${encodeURIComponent(id)}`);
  return handleJson<PlaylistDetailApi>(res);
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: Track,
  filterScore = 0
): Promise<{ track: PlaylistTrackApi | null }> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(playlistId)}/tracks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: track.videoId,
        ...trackMeta(track, filterScore),
      }),
    }
  );
  return handleJson<{ track: PlaylistTrackApi | null }>(res);
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  videoId: string
): Promise<void> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(videoId)}`,
    { method: "DELETE" }
  );
  await handleJson<{ success: boolean }>(res);
}

export async function reorderPlaylistTracks(
  playlistId: string,
  orderedVideoIds: string[]
): Promise<PlaylistDetailApi> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(playlistId)}/tracks/reorder`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedTrackIds: orderedVideoIds }),
    }
  );
  return handleJson<PlaylistDetailApi>(res);
}

export async function listSavedTracks(
  cursor?: string,
  limit?: number
): Promise<{ tracks: SavedTrackApiRow[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();
  const res = await fetchWithAuth(`${API_URL}/api/saved${qs ? `?${qs}` : ""}`);
  return handleJson<{ tracks: SavedTrackApiRow[]; nextCursor: string | null }>(res);
}

export async function saveTrackToLibrary(track: Track, filterScore = 0): Promise<void> {
  const res = await fetchWithAuth(`${API_URL}/api/saved`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId: track.videoId,
      ...trackMeta(track, filterScore),
    }),
  });
  await handleJson<{ success: boolean }>(res);
}

export async function unsaveTrackFromLibrary(videoId: string): Promise<void> {
  const res = await fetchWithAuth(
    `${API_URL}/api/saved/${encodeURIComponent(videoId)}`,
    { method: "DELETE" }
  );
  await handleJson<{ success: boolean }>(res);
}

export async function enableSync(
  playlistId: string
): Promise<{ youtubePlaylistId: string }> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(playlistId)}/sync/enable`,
    { method: "POST" }
  );
  return handleJson<{ youtubePlaylistId: string }>(res);
}

export async function exportToYouTube(
  playlistId: string
): Promise<{ exportedCount: number }> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(playlistId)}/sync/export`,
    { method: "POST" }
  );
  return handleJson<{ exportedCount: number }>(res);
}

export async function pullFromYouTube(
  playlistId: string
): Promise<{ addedCount: number; removedCount: number }> {
  const res = await fetchWithAuth(
    `${API_URL}/api/playlists/${encodeURIComponent(playlistId)}/sync/pull`,
    { method: "POST" }
  );
  return handleJson<{ addedCount: number; removedCount: number }>(res);
}

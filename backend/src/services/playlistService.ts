import { prisma } from "./quotaService";
import { VIDEO_ID_REGEX } from "../utils/validators";
const MAX_PLAYLIST_TRACKS = 500;

export interface TrackMetadata {
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

function validatePlaylistName(name: string): void {
  if (typeof name !== "string" || name.length < 1 || name.length > 100) {
    throw new Error("INVALID_PLAYLIST_NAME");
  }
}

function validateDescription(description: string | undefined | null): void {
  if (description === undefined || description === null) return;
  if (typeof description !== "string" || description.length > 500) {
    throw new Error("INVALID_DESCRIPTION");
  }
}

function validateVideoId(videoId: string): void {
  if (!VIDEO_ID_REGEX.test(videoId)) {
    throw new Error("INVALID_VIDEO_ID");
  }
}

async function upsertTrack(videoId: string, meta: TrackMetadata): Promise<void> {
  await prisma.track.upsert({
    where: { id: videoId },
    create: {
      id: videoId,
      title: meta.title,
      channel: meta.channel,
      duration: meta.duration,
      thumbnail: meta.thumbnail,
      category: meta.category,
      filterScore: meta.filterScore,
    },
    update: {
      title: meta.title,
      channel: meta.channel,
      duration: meta.duration,
      thumbnail: meta.thumbnail,
      category: meta.category,
      filterScore: meta.filterScore,
    },
  });
}

async function updateCoverThumbnail(playlistId: string): Promise<void> {
  const first = await prisma.playlistTrack.findFirst({
    where: { playlistId },
    orderBy: { position: "asc" },
    include: { track: true },
  });
  await prisma.playlist.update({
    where: { id: playlistId },
    data: { coverThumbnail: first?.track.thumbnail ?? null },
  });
}

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string
) {
  validatePlaylistName(name);
  validateDescription(description);
  return prisma.playlist.create({
    data: {
      userId,
      name,
      description: description ?? null,
    },
  });
}

export async function getUserPlaylists(userId: string) {
  const playlists = await prisma.playlist.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { tracks: true } } },
  });

  return playlists.map((p) => ({
    id: p.id,
    name: p.name,
    trackCount: p._count.tracks,
    coverThumbnail: p.coverThumbnail,
    syncEnabled: p.syncEnabled,
    createdAt: p.createdAt,
  }));
}

export async function getPlaylistWithTracks(playlistId: string, userId: string) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
    include: {
      tracks: {
        orderBy: { position: "asc" },
        include: { track: true },
      },
    },
  });
  if (!playlist) throw new Error("NOT_FOUND");
  return playlist;
}

export async function updatePlaylist(
  playlistId: string,
  userId: string,
  data: { name?: string; description?: string | null }
) {
  if (data.name !== undefined) validatePlaylistName(data.name);
  if (data.description !== undefined) validateDescription(data.description);
  const existing = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
  });
  if (!existing) throw new Error("NOT_FOUND");
  return prisma.playlist.update({
    where: { id: playlistId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
    },
  });
}

export async function deletePlaylist(playlistId: string, userId: string) {
  const existing = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
  });
  if (!existing) throw new Error("NOT_FOUND");
  await prisma.playlist.delete({ where: { id: playlistId } });
}

export async function addTrackToPlaylist(
  playlistId: string,
  userId: string,
  videoId: string,
  trackMetadata: TrackMetadata
) {
  validateVideoId(videoId);
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
  });
  if (!playlist) throw new Error("NOT_FOUND");

  await upsertTrack(videoId, trackMetadata);

  const trackCount = await prisma.playlistTrack.count({ where: { playlistId } });
  if (trackCount >= MAX_PLAYLIST_TRACKS) {
    throw new Error("PLAYLIST_TRACK_LIMIT");
  }

  const agg = await prisma.playlistTrack.aggregate({
    where: { playlistId },
    _max: { position: true },
  });
  const nextPos = (agg._max.position ?? -1) + 1;

  try {
    await prisma.playlistTrack.create({
      data: { playlistId, trackId: videoId, position: nextPos },
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      await updateCoverThumbnail(playlistId);
      return;
    }
    throw err;
  }

  await updateCoverThumbnail(playlistId);
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  userId: string,
  trackId: string
) {
  validateVideoId(trackId);
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
  });
  if (!playlist) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.playlistTrack.deleteMany({
      where: { playlistId, trackId },
    });
    const remaining = await tx.playlistTrack.findMany({
      where: { playlistId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (remaining.length > 0) {
      await Promise.all(
        remaining.map((item, i) =>
          tx.playlistTrack.update({
            where: { id: item.id },
            data: { position: i },
          })
        )
      );
    }
  });

  await updateCoverThumbnail(playlistId);
}

export async function reorderTracks(
  playlistId: string,
  userId: string,
  orderedTrackIds: string[]
) {
  for (const id of orderedTrackIds) {
    validateVideoId(id);
  }

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId },
    include: { tracks: true },
  });
  if (!playlist) throw new Error("NOT_FOUND");

  const existingIds = new Set(playlist.tracks.map((t) => t.trackId));
  if (orderedTrackIds.length !== existingIds.size) {
    throw new Error("INVALID_ORDER");
  }
  for (const id of orderedTrackIds) {
    if (!existingIds.has(id)) throw new Error("INVALID_ORDER");
  }

  await prisma.$transaction(
    orderedTrackIds.map((trackId, index) =>
      prisma.playlistTrack.updateMany({
        where: { playlistId, trackId },
        data: { position: index },
      })
    )
  );

  await updateCoverThumbnail(playlistId);
}

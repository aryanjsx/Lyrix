import { prisma } from "./quotaService";
import type { TrackMetadata } from "./playlistService";
import { VIDEO_ID_REGEX } from "../utils/validators";

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

export async function saveTrack(
  userId: string,
  videoId: string,
  trackMetadata: TrackMetadata
) {
  validateVideoId(videoId);
  await upsertTrack(videoId, trackMetadata);
  await prisma.savedTrack.upsert({
    where: {
      userId_trackId: { userId, trackId: videoId },
    },
    create: { userId, trackId: videoId },
    update: {},
  });
}

export async function unsaveTrack(userId: string, videoId: string) {
  validateVideoId(videoId);
  await prisma.savedTrack.deleteMany({
    where: { userId, trackId: videoId },
  });
}

export async function getSavedTracks(
  userId: string,
  cursor?: string,
  limit = 50
) {
  const tracks = await prisma.savedTrack.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { track: true },
  });

  const hasMore = tracks.length > limit;
  const items = hasMore ? tracks.slice(0, limit) : tracks;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { tracks: items, nextCursor };
}

export async function isTrackSaved(
  userId: string,
  videoId: string
): Promise<boolean> {
  validateVideoId(videoId);
  const row = await prisma.savedTrack.findUnique({
    where: {
      userId_trackId: { userId, trackId: videoId },
    },
  });
  return !!row;
}

import { prisma } from "./quotaService";
import { cacheGet, cacheSet, TTL } from "./cacheService";
import { getVideoMetadataById, VideoMetadata } from "./innertubeService";

type CachedTrack = VideoMetadata;

async function resolveTrackMetadata(trackId: string): Promise<CachedTrack | null> {
  const cached = await cacheGet<CachedTrack>(`track:${trackId}`);
  if (cached && cached.title !== "Unknown") return cached;

  const existing = await prisma.track.findUnique({ where: { id: trackId } });
  if (existing && existing.title !== "Unknown") {
    return {
      videoId: existing.id,
      title: existing.title,
      channel: existing.channel,
      channelId: existing.channelId ?? undefined,
      duration: existing.duration,
      thumbnail: existing.thumbnail,
      category: existing.category as "music" | "podcast",
      filterScore: existing.filterScore,
    };
  }

  try {
    const meta = await getVideoMetadataById(trackId);
    if (meta) {
      await cacheSet(`track:${trackId}`, meta, TTL.TRACK);
      return meta;
    }
  } catch {
    // metadata fetch failed, proceed with whatever we have
  }

  return cached ?? null;
}

interface ClientMeta {
  title?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  category?: string;
}

export async function logPlay(
  userId: string,
  trackId: string,
  clientMeta?: ClientMeta
): Promise<void> {
  const clientTitle = clientMeta?.title?.trim();
  const hasGoodClientTitle = !!clientTitle && clientTitle !== "Unknown";

  const meta = hasGoodClientTitle ? null : await resolveTrackMetadata(trackId);

  const title = hasGoodClientTitle ? clientTitle : (meta?.title || clientTitle || "");
  const channel = clientMeta?.channel?.trim() || meta?.channel || "";
  const duration = clientMeta?.duration ?? meta?.duration ?? 0;
  const thumbnail = clientMeta?.thumbnail || meta?.thumbnail || "";
  const category = clientMeta?.category || meta?.category || "music";

  try {
    await prisma.$transaction([
      prisma.track.upsert({
        where: { id: trackId },
        create: {
          id: trackId,
          title: title || "Unknown",
          channel: channel || "Unknown",
          channelId: meta?.channelId,
          duration,
          thumbnail,
          category,
          filterScore: meta?.filterScore ?? 0,
        },
        update: {
          ...(title ? { title } : {}),
          ...(channel ? { channel } : {}),
          ...(meta?.channelId ? { channelId: meta.channelId } : {}),
          ...(thumbnail ? { thumbnail } : {}),
        },
      }),
      prisma.playHistory.create({
        data: {
          userId,
          trackId,
          secondsPlayed: 0,
          playedAt: new Date(),
        },
      }),
    ]);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      await prisma.track.update({
        where: { id: trackId },
        data: {
          ...(title ? { title } : {}),
          ...(channel ? { channel } : {}),
          ...(meta?.channelId ? { channelId: meta.channelId } : {}),
          ...(thumbnail ? { thumbnail } : {}),
        },
      });
      await prisma.playHistory.create({
        data: {
          userId,
          trackId,
          secondsPlayed: 0,
          playedAt: new Date(),
        },
      });
    } else {
      throw err;
    }
  }

  if (!title || title === "Unknown") {
    void resolveTrackMetadata(trackId).then(async (resolved) => {
      if (resolved && resolved.title && resolved.title !== "Unknown") {
        await prisma.track.update({
          where: { id: trackId },
          data: {
            title: resolved.title,
            channel: resolved.channel,
            channelId: resolved.channelId,
            duration: resolved.duration,
            thumbnail: resolved.thumbnail,
          },
        }).catch(() => {});
      }
    }).catch(() => {});
  }
}

export async function updateSecondsPlayed(
  userId: string,
  trackId: string,
  seconds: number
): Promise<void> {
  const latest = await prisma.playHistory.findFirst({
    where: { userId, trackId },
    orderBy: { playedAt: "desc" },
  });

  if (latest) {
    await prisma.playHistory.update({
      where: { id: latest.id },
      data: { secondsPlayed: seconds },
    });
  }
}

export async function getRecentPlays(
  userId: string,
  limit: number
): Promise<
  Array<{
    videoId: string;
    title: string;
    channel: string;
    duration: number;
    thumbnail: string;
    category: string;
    playedAt: string;
    secondsPlayed: number;
  }>
> {
  const rows = await prisma.playHistory.findMany({
    where: { userId },
    orderBy: { playedAt: "desc" },
    take: limit,
    include: {
      track: {
        select: {
          id: true,
          title: true,
          channel: true,
          duration: true,
          thumbnail: true,
          category: true,
        },
      },
    },
  });

  const unknownTrackIds = [
    ...new Set(
      rows.filter((r) => r.track.title === "Unknown").map((r) => r.track.id)
    ),
  ];

  const resolved = new Map<string, VideoMetadata>();
  if (unknownTrackIds.length > 0) {
    const lookups = unknownTrackIds.slice(0, 20).map(async (id) => {
      try {
        const meta = await getVideoMetadataById(id);
        if (meta && meta.title !== "Unknown") {
          resolved.set(id, meta);
          await prisma.track.update({
            where: { id },
            data: {
              title: meta.title,
              channel: meta.channel,
              channelId: meta.channelId,
              duration: meta.duration,
              thumbnail: meta.thumbnail,
              category: meta.category,
            },
          });
        }
      } catch {
        // best-effort
      }
    });
    await Promise.allSettled(lookups);
  }

  return rows.map((row) => {
    const fix = resolved.get(row.track.id);
    return {
      videoId: row.track.id,
      title: fix?.title ?? row.track.title,
      channel: fix?.channel ?? row.track.channel,
      duration: fix?.duration ?? row.track.duration,
      thumbnail: fix?.thumbnail ?? row.track.thumbnail,
      category: fix?.category ?? row.track.category,
      playedAt: row.playedAt.toISOString(),
      secondsPlayed: row.secondsPlayed,
    };
  });
}


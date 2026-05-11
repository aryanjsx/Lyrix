import { prisma } from "./quotaService";
import { getVideoMetadataById } from "./innertubeService";

const WINDOW_DAYS = 90;
const MIN_SECONDS = 30;

export async function rebuildUserProfile(userId: string): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const history = await prisma.playHistory.findMany({
    where: {
      userId,
      playedAt: { gte: since },
      secondsPlayed: { gte: MIN_SECONDS },
    },
    include: {
      track: {
        include: { genres: true },
      },
    },
    orderBy: { playedAt: "desc" },
    take: 5000,
  });

  const genreCounts = new Map<string, number>();
  for (const entry of history) {
    for (const tg of entry.track.genres) {
      genreCounts.set(tg.genre, (genreCounts.get(tg.genre) ?? 0) + 1);
    }
  }

  const artistStats = new Map<
    string,
    {
      channelName: string;
      playCount: number;
      totalSeconds: number;
      lastPlayed: Date;
    }
  >();
  for (const entry of history) {
    const chId = entry.track.channelId ?? entry.track.channel;
    const existing = artistStats.get(chId) ?? {
      channelName: entry.track.channel,
      playCount: 0,
      totalSeconds: 0,
      lastPlayed: entry.playedAt,
    };
    existing.playCount++;
    existing.totalSeconds += entry.secondsPlayed;
    if (entry.playedAt > existing.lastPlayed) {
      existing.lastPlayed = entry.playedAt;
    }
    artistStats.set(chId, existing);
  }

  await prisma.$transaction(async (tx) => {
    await tx.userGenreProfile.deleteMany({ where: { userId } });
    if (genreCounts.size > 0) {
      await tx.userGenreProfile.createMany({
        data: Array.from(genreCounts.entries()).map(([genre, playCount]) => ({
          userId,
          genre,
          playCount,
        })),
      });
    }
  });

  await prisma.$transaction(async (tx) => {
    await tx.userArtistProfile.deleteMany({ where: { userId } });
    if (artistStats.size > 0) {
      await tx.userArtistProfile.createMany({
        data: Array.from(artistStats.entries()).map(([channelId, stats]) => ({
          userId,
          channelId,
          channelName: stats.channelName,
          playCount: stats.playCount,
          totalSeconds: stats.totalSeconds,
          lastPlayed: stats.lastPlayed,
        })),
      });
    }
  });
}

export async function getUserGenreProfile(userId: string) {
  return prisma.userGenreProfile.findMany({
    where: { userId },
    orderBy: { playCount: "desc" },
    take: 100,
  });
}

export async function getUserArtistProfile(userId: string) {
  return prisma.userArtistProfile.findMany({
    where: { userId },
    orderBy: { playCount: "desc" },
    take: 100,
  });
}

export async function getUserStats(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalPlays,
    totalSeconds,
    genreProfile,
    artistProfile,
    recentPlays,
    topTracksRaw,
  ] = await Promise.all([
    prisma.playHistory.count({
      where: {
        userId,
        playedAt: { gte: since },
        secondsPlayed: { gte: MIN_SECONDS },
      },
    }),
    prisma.playHistory.aggregate({
      where: {
        userId,
        playedAt: { gte: since },
        secondsPlayed: { gte: MIN_SECONDS },
      },
      _sum: { secondsPlayed: true },
    }),
    getUserGenreProfile(userId),
    getUserArtistProfile(userId),
    prisma.playHistory.count({
      where: {
        userId,
        playedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        secondsPlayed: { gte: MIN_SECONDS },
      },
    }),
    prisma.playHistory.groupBy({
      by: ["trackId"],
      where: {
        userId,
        playedAt: { gte: monthStart },
        secondsPlayed: { gte: MIN_SECONDS },
      },
      _count: { trackId: true },
      orderBy: { _count: { trackId: "desc" } },
      take: 10,
    }),
  ]);

  const topTrackIds = topTracksRaw.map((t) => t.trackId);
  const trackMeta =
    topTrackIds.length > 0
      ? await prisma.track.findMany({
          where: { id: { in: topTrackIds } },
          select: {
            id: true,
            title: true,
            channel: true,
            thumbnail: true,
            duration: true,
          },
        })
      : [];
  const trackMetaMap = new Map(trackMeta.map((t) => [t.id, t]));

  const unknownTopIds = topTrackIds.filter((id) => {
    const m = trackMetaMap.get(id);
    return !m || m.title === "Unknown";
  });

  if (unknownTopIds.length > 0) {
    const lookups = unknownTopIds.slice(0, 10).map(async (id) => {
      try {
        const meta = await getVideoMetadataById(id);
        if (meta && meta.title !== "Unknown") {
          trackMetaMap.set(id, {
            id,
            title: meta.title,
            channel: meta.channel,
            thumbnail: meta.thumbnail,
            duration: meta.duration,
          });
          await prisma.track.update({
            where: { id },
            data: {
              title: meta.title,
              channel: meta.channel,
              channelId: meta.channelId,
              duration: meta.duration,
              thumbnail: meta.thumbnail,
            },
          }).catch(() => {});
        }
      } catch {
        // best-effort
      }
    });
    await Promise.allSettled(lookups);
  }

  const topTracksThisMonth = topTracksRaw
    .map((t) => {
      const meta = trackMetaMap.get(t.trackId);
      return {
        videoId: t.trackId,
        playCount: t._count.trackId,
        title: meta?.title ?? "",
        channel: meta?.channel ?? "",
        thumbnail: meta?.thumbnail ?? "",
        duration: meta?.duration ?? 0,
      };
    })
    .filter((t) => t.title !== "" && t.title !== "Unknown");

  const streakDays = await prisma.$queryRaw<Array<{ play_date: Date | string }>>`
    SELECT DISTINCT DATE(playedAt) as play_date
    FROM PlayHistory
    WHERE userId = ${userId} AND secondsPlayed >= ${MIN_SECONDS}
    ORDER BY play_date DESC
    LIMIT 365
  `;

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < streakDays.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    const playDate = streakDays[i].play_date;
    const actualStr =
      typeof playDate === "string"
        ? playDate.slice(0, 10)
        : new Date(playDate).toISOString().slice(0, 10);
    if (actualStr === expectedStr) {
      currentStreak++;
    } else {
      break;
    }
  }

  const cleanArtists = artistProfile.filter(
    (a) => a.channelName !== "Unknown" && a.channelName !== ""
  );

  return {
    totalPlays,
    totalSeconds: totalSeconds._sum.secondsPlayed ?? 0,
    playsLast7Days: recentPlays,
    topGenres: genreProfile.slice(0, 10),
    topArtists: cleanArtists.slice(0, 10),
    genreBreakdown: genreProfile,
    artistBreakdown: cleanArtists,
    topTracksThisMonth,
    currentStreak,
  };
}

import { prisma } from "./quotaService";

export async function calculateStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  totalDaysActive: number;
}> {
  const playDates = await prisma.$queryRaw<{ date: string }[]>`
    SELECT DATE(playedAt) as date
    FROM PlayHistory
    WHERE userId = ${userId}
    GROUP BY DATE(playedAt)
    ORDER BY date DESC
  `;

  const dates = playDates.map((d) => d.date);
  if (dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: "",
      totalDaysActive: 0,
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let currentStreak = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diff === 1) currentStreak++;
      else break;
    }
  }

  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longest, currentStreak),
    lastActiveDate: dates[0],
    totalDaysActive: dates.length,
  };
}

export async function getWeeklyRecap(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [totalPlays, topTrackGroup, totalSeconds] = await Promise.all([
    prisma.playHistory.count({
      where: { userId, playedAt: { gte: weekAgo } },
    }),
    prisma.playHistory.groupBy({
      by: ["trackId"],
      where: { userId, playedAt: { gte: weekAgo } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: "desc" } },
      take: 1,
    }),
    prisma.playHistory.aggregate({
      where: { userId, playedAt: { gte: weekAgo } },
      _sum: { secondsPlayed: true },
    }),
  ]);

  const topTrackId = topTrackGroup[0]?.trackId;
  const topTrackData = topTrackId
    ? await prisma.track.findUnique({ where: { id: topTrackId } })
    : null;

  const totalMinutes = Math.round(
    (totalSeconds._sum.secondsPlayed ?? 0) / 60
  );

  return {
    totalPlays,
    totalMinutes,
    topTrack: topTrackData
      ? {
          videoId: topTrackData.id,
          title: topTrackData.title,
          channel: topTrackData.channel,
          thumbnail: topTrackData.thumbnail,
        }
      : null,
    weekStart: weekAgo.toISOString(),
  };
}

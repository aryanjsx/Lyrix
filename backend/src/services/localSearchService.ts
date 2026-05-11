import { prisma } from "../lib/prisma";
import type { FilteredTrack } from "./filterService";

export async function searchLocalTracks(
  query: string,
  limit: number = 20
): Promise<FilteredTrack[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (words.length === 0) return [];

  const tracks = await prisma.track.findMany({
    where: {
      AND: words.map((word) => ({
        OR: [
          { title: { contains: word } },
          { channel: { contains: word } },
        ],
      })),
      category: { not: "discard" },
      title: { not: "Unknown" },
    },
    orderBy: { filterScore: "desc" },
    take: limit,
  });

  return tracks.map((t) => ({
    videoId: t.id,
    title: t.title,
    channel: t.channel,
    channelId: t.channelId ?? undefined,
    duration: t.duration,
    thumbnail: t.thumbnail,
    category: t.category as "music" | "podcast",
    filterScore: t.filterScore,
  }));
}

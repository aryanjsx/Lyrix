import type { RecommendationTrack, Track } from "@/store";

export function recommendationToTrack(r: RecommendationTrack): Track {
  return {
    videoId: r.videoId,
    title: r.title,
    channel: r.channel,
    duration: r.duration,
    thumbnail: r.thumbnail,
    category: r.category as "music" | "podcast",
    filterScore: r.filterScore,
  };
}

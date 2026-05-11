import * as Sentry from "@sentry/node";
import { YouTubeVideoItem, parseDuration } from "./youtubeService";
import { cacheGet, cacheSet, TTL } from "./cacheService";
import { isKnownMusicChannel } from "./knownMusicChannels";
import { tagTrack } from "./genreService";

interface FilterScore {
  videoId: string;
  score: number;
  category: "music" | "podcast" | "discard";
}

export interface FilteredTrack {
  videoId: string;
  title: string;
  channel: string;
  channelId?: string;
  duration: number;
  thumbnail: string;
  category: "music" | "podcast";
  filterScore: number;
}

function scoreVideo(video: YouTubeVideoItem): FilterScore {
  try {
    return scoreVideoInner(video);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: "filter_engine" },
      extra: { videoId: video.id },
    });
    return { videoId: video.id, score: 0, category: "discard" };
  }
}

function scoreVideoInner(video: YouTubeVideoItem): FilterScore {
  let score = 0;
  const title = video.snippet.title.toLowerCase();
  const duration = parseDuration(video.contentDetails.duration);
  const categoryId = video.snippet.categoryId;

  // Phase 1 signals
  if (categoryId === "10") score += 40;
  if (duration >= 120 && duration <= 480) score += 20;
  if (duration > 480 && duration <= 3600) score += 10;
  if (/official (video|audio|lyrics|music video)/.test(title)) score += 10;
  if (video.snippet.tags?.includes("auto-generated")) score += 15;

  // Phase 2 signals
  if (isKnownMusicChannel(video.snippet.channelTitle)) score += 15;
  if (/\b(feat\.?|ft\.?|prod\.?)\b/.test(title)) score += 10;
  if (/\b(20[12]\d)\b/.test(title)) score += 5;

  // Negative signals — Phase 1
  if (duration < 60) score -= 50;
  if (/vlog|react|unboxing|shorts|#shorts/.test(title)) score -= 30;

  // Negative signals — Phase 2
  if (/\b(live|concert)\b/.test(title)) score -= 5;
  if (duration > 3600) score -= 20;
  if (/\binterview\b/.test(title)) score -= 25;

  let category: "music" | "podcast" | "discard" = "discard";
  if (score >= 60) {
    category = duration > 1200 ? "podcast" : "music";
  }

  return { videoId: video.id, score, category };
}

export async function filterAndScore(
  videos: YouTubeVideoItem[],
  maxResults: number = 20
): Promise<FilteredTrack[]> {
  const results: FilteredTrack[] = [];

  for (const video of videos) {
    const cacheKey = `score:${video.id}`;
    const cached = await cacheGet<FilterScore>(cacheKey);

    let result: FilterScore;
    if (cached) {
      result = cached;
    } else {
      result = scoreVideo(video);
      await cacheSet(cacheKey, result, TTL.SCORE);
    }

    if (result.category !== "discard") {
      const thumbnail =
        video.snippet.thumbnails.high?.url ??
        video.snippet.thumbnails.medium?.url ??
        video.snippet.thumbnails.default?.url ??
        "";

      results.push({
        videoId: video.id,
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        duration: parseDuration(video.contentDetails.duration),
        thumbnail,
        category: result.category,
        filterScore: result.score,
      });

      tagTrack(video.id, video.snippet.title, video.snippet.channelTitle, result.category).catch(() => {});
    }
  }

  const sorted = results.sort((a, b) => b.filterScore - a.filterScore);
  if (maxResults <= 0 || sorted.length <= maxResults) return sorted;
  return sorted.slice(0, maxResults);
}

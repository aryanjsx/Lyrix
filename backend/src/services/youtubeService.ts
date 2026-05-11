import { config } from "../config";
import { canMakeCall, recordCall, COSTS } from "./quotaService";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeSnippet {
  title: string;
  description: string;
  channelId?: string;
  channelTitle: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
  categoryId?: string;
  tags?: string[];
}

export interface YouTubeContentDetails {
  duration: string;
}

export interface YouTubeVideoItem {
  id: string;
  snippet: YouTubeSnippet;
  contentDetails: YouTubeContentDetails;
}

interface YouTubeVideosResponse {
  items: YouTubeVideoItem[];
}

async function fetchYouTubeAPI<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", config.youtubeApiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      `[YouTube API] ${endpoint} failed: ${response.status} ${response.statusText} — ${body.slice(0, 300)}`
    );
    return null;
  }

  return (await response.json()) as T;
}

export async function getVideoDetails(
  videoIds: string[]
): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) return [];

  if (!(await canMakeCall(COSTS.videoDetails))) {
    console.warn("[YouTube API] Quota limit reached, skipping video details");
    return [];
  }

  const data = await fetchYouTubeAPI<YouTubeVideosResponse>("videos", {
    part: "snippet,contentDetails",
    id: videoIds.join(","),
  });

  if (!data) return [];

  await recordCall(COSTS.videoDetails);
  return data.items;
}

export function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

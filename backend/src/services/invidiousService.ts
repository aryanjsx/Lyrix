import type { FilteredTrack } from "./filterService";
import { INVIDIOUS_INSTANCES } from "./innertubeService";

interface InvidiousVideo {
  type: string;
  videoId: string;
  title: string;
  author: string;
  authorId: string;
  lengthSeconds: number;
  videoThumbnails: { quality: string; url: string }[];
}

function pickThumbnail(thumbs: InvidiousVideo["videoThumbnails"], videoId: string): string {
  const hq = thumbs.find((t) => t.quality === "high");
  if (hq) return hq.url;
  const med = thumbs.find((t) => t.quality === "medium");
  if (med) return med.url;
  if (thumbs.length > 0) return thumbs[0].url;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function tryInstance(
  instanceUrl: string,
  query: string,
  signal: AbortSignal
): Promise<FilteredTrack[]> {
  const url = `${instanceUrl}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as InvidiousVideo[];
  if (!Array.isArray(data) || data.length === 0) return [];

  const tracks: FilteredTrack[] = [];

  for (const item of data) {
    if (item.type !== "video") continue;
    if (!item.videoId || item.lengthSeconds < 60 || item.lengthSeconds > 14400) continue;

    const title = item.title.toLowerCase();
    if (/vlog|react|unboxing|shorts|#shorts|interview/.test(title)) continue;
    if (/remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/.test(title)) continue;

    tracks.push({
      videoId: item.videoId,
      title: item.title,
      channel: item.author,
      channelId: item.authorId || undefined,
      duration: item.lengthSeconds,
      thumbnail: pickThumbnail(item.videoThumbnails, item.videoId),
      category: item.lengthSeconds > 1200 ? "podcast" : "music",
      filterScore: 70,
    });
  }

  return tracks;
}

export async function searchInvidious(query: string): Promise<FilteredTrack[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const results = await tryInstance(instance, query, controller.signal);
        if (results.length > 0) return results.slice(0, 30);
      } catch (err) {
        if (controller.signal.aborted) break;
        console.warn(`[Invidious] ${instance} failed:`, (err as Error).message);
      }
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

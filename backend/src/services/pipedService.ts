import type { FilteredTrack } from "./filterService";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.in.projectsegfau.lt",
];

interface PipedStream {
  url: string;
  title: string;
  uploaderName: string;
  uploaderUrl: string;
  duration: number;
  thumbnail: string;
}

interface PipedSearchResponse {
  items: PipedStream[];
  nextpage?: string;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function tryInstance(
  instanceUrl: string,
  query: string,
  signal: AbortSignal
): Promise<FilteredTrack[]> {
  const url = `${instanceUrl}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as PipedSearchResponse;
  if (!data.items || data.items.length === 0) return [];

  const tracks: FilteredTrack[] = [];

  for (const item of data.items) {
    const videoId = extractVideoId(item.url);
    if (!videoId) continue;
    if (item.duration < 60 || item.duration > 14400) continue;
    const lowerTitle = item.title.toLowerCase();
    if (/remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/.test(lowerTitle)) continue;

    tracks.push({
      videoId,
      title: item.title,
      channel: item.uploaderName,
      duration: item.duration,
      thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      category: item.duration > 1200 ? "podcast" : "music",
      filterScore: 70,
    });
  }

  return tracks;
}

export async function searchPiped(query: string): Promise<FilteredTrack[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    for (const instance of PIPED_INSTANCES) {
      try {
        const results = await tryInstance(instance, query, controller.signal);
        if (results.length > 0) return results.slice(0, 30);
      } catch (err) {
        if (controller.signal.aborted) break;
        console.warn(`[Piped] ${instance} failed:`, (err as Error).message);
      }
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

import * as Sentry from "@sentry/node";
import type { FilteredTrack } from "./filterService";

const INNERTUBE_API = "https://www.youtube.com/youtubei/v1/search";
const INNERTUBE_MUSIC_API = "https://music.youtube.com/youtubei/v1/search";

const MAX_CONCURRENT = 3;
let activeRequests = 0;
const waitQueue: (() => void)[] = [];

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  }
  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
    if (waitQueue.length > 0) {
      const next = waitQueue.shift();
      next?.();
    }
  }
}

const WEB_CONTEXT = {
  client: {
    clientName: "WEB",
    clientVersion: "2.20241202.00.00",
    hl: "en",
    gl: "US",
  },
};

const YTMUSIC_CONTEXT = {
  client: {
    clientName: "WEB_REMIX",
    clientVersion: "1.20241202.01.00",
    hl: "en",
    gl: "US",
  },
};

interface InnertubeVideoRenderer {
  videoId?: string;
  title?: { runs?: { text: string }[] };
  ownerText?: { runs?: { text: string }[] };
  shortBylineText?: { runs?: { text: string }[] };
  lengthText?: { simpleText?: string };
  thumbnail?: { thumbnails?: { url: string; width: number }[] };
}

interface MusicResponsiveItem {
  flexColumns?: {
    musicResponsiveListItemFlexColumnRenderer?: {
      text?: { runs?: { text: string; navigationEndpoint?: { watchEndpoint?: { videoId: string } } }[] };
    };
  }[];
  thumbnail?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: { url: string }[] } } };
  playlistItemData?: { videoId?: string };
}

function parseDurationText(text: string): number {
  const parts = text.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function extractWebResults(data: unknown, options?: { webOnly?: boolean }): FilteredTrack[] {
  const tracks: FilteredTrack[] = [];
  const isPodcast = options?.webOnly === true;

  const videoRenderers: InnertubeVideoRenderer[] = [];
  findVideoRenderers(data, videoRenderers);

  for (const renderer of videoRenderers) {
    if (!renderer.videoId) continue;

    const title = renderer.title?.runs?.map((r) => r.text).join("") ?? "";
    const channel =
      renderer.ownerText?.runs?.map((r) => r.text).join("") ??
      renderer.shortBylineText?.runs?.map((r) => r.text).join("") ??
      "";
    const durationText = renderer.lengthText?.simpleText ?? "";
    const duration = parseDurationText(durationText);

    if (isPodcast) {
      if (duration < 120 || duration > 14400) continue;
    } else {
      if (duration < 60 || duration > 14400) continue;
    }
    if (!title || !channel) continue;

    const lowerTitle = title.toLowerCase();
    if (isPodcast) {
      if (/vlog|react|unboxing|shorts|#shorts/.test(lowerTitle)) continue;
    } else {
      if (/vlog|react|unboxing|shorts|#shorts|interview/.test(lowerTitle)) continue;
    }
    if (/remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/.test(lowerTitle)) continue;

    const thumbnail =
      renderer.thumbnail?.thumbnails?.sort((a, b) => b.width - a.width)[0]?.url ??
      `https://i.ytimg.com/vi/${renderer.videoId}/hqdefault.jpg`;

    tracks.push({
      videoId: renderer.videoId,
      title,
      channel,
      duration,
      thumbnail,
      category: duration > 1200 ? "podcast" : "music",
      filterScore: 75,
    });
  }

  return tracks;
}

function findVideoRenderers(obj: unknown, results: InnertubeVideoRenderer[]): void {
  if (results.length >= 30) return;
  if (obj === null || obj === undefined || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findVideoRenderers(item, results);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  if ("videoRenderer" in record && record.videoRenderer) {
    results.push(record.videoRenderer as InnertubeVideoRenderer);
  }
  if ("compactVideoRenderer" in record && record.compactVideoRenderer) {
    results.push(record.compactVideoRenderer as InnertubeVideoRenderer);
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      findVideoRenderers(value, results);
    }
  }
}

function extractMusicResults(data: unknown): FilteredTrack[] {
  const tracks: FilteredTrack[] = [];
  const items: MusicResponsiveItem[] = [];
  findMusicItems(data, items);

  for (const item of items) {
    const columns = item.flexColumns ?? [];
    if (columns.length < 2) continue;

    const firstCol = columns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
    const secondCol = columns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];

    let videoId: string | null = null;
    let title = "";
    for (const run of firstCol) {
      if (run.navigationEndpoint?.watchEndpoint?.videoId) {
        videoId = run.navigationEndpoint.watchEndpoint.videoId;
      }
      title += run.text;
    }

    if (!videoId && item.playlistItemData?.videoId) {
      videoId = item.playlistItemData.videoId;
    }
    if (!videoId) continue;

    const channel = secondCol.map((r) => r.text).join("");

    const thumbnails =
      item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
    const thumbnail =
      thumbnails[thumbnails.length - 1]?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    if (!title) continue;

    const lowerMusicTitle = title.toLowerCase();
    if (/remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/.test(lowerMusicTitle)) continue;

    tracks.push({
      videoId,
      title,
      channel,
      duration: 240,
      thumbnail,
      category: "music",
      filterScore: 80,
    });
  }

  return tracks;
}

function findMusicItems(obj: unknown, results: MusicResponsiveItem[]): void {
  if (results.length >= 30) return;
  if (obj === null || obj === undefined || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) findMusicItems(item, results);
    return;
  }

  const record = obj as Record<string, unknown>;
  if ("musicResponsiveListItemRenderer" in record && record.musicResponsiveListItemRenderer) {
    results.push(record.musicResponsiveListItemRenderer as MusicResponsiveItem);
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      findMusicItems(value, results);
    }
  }
}

async function searchYTMusic(query: string): Promise<FilteredTrack[]> {
  return withConcurrencyLimit(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(INNERTUBE_MUSIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Origin: "https://music.youtube.com",
          Referer: "https://music.youtube.com/",
        },
        body: JSON.stringify({
          context: YTMUSIC_CONTEXT,
          query,
          params: "EgWKAQIIAQ%3D%3D",
        }),
        signal: controller.signal,
      });

      if (!res.ok) return [];
      const data = await res.json();
      return extractMusicResults(data);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function searchYTWeb(query: string, options?: { webOnly?: boolean }): Promise<FilteredTrack[]> {
  return withConcurrencyLimit(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(INNERTUBE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          context: WEB_CONTEXT,
          query: options?.webOnly ? query : query + " song",
        }),
        signal: controller.signal,
      });

      if (!res.ok) return [];
      const data = await res.json();
      return extractWebResults(data, options);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  });
}

export async function searchInnertube(query: string, options?: { webOnly?: boolean }): Promise<FilteredTrack[]> {
  return Sentry.startSpan(
    { name: "innertube.search", op: "http.client", attributes: { query } },
    async () => {
      if (options?.webOnly) {
        const webResults = await searchYTWeb(query, options);
        return webResults.slice(0, 30);
      }

      const musicTracks = await searchYTMusic(query);
      if (musicTracks.length > 0) return musicTracks.slice(0, 30);

      const webTracks = await searchYTWeb(query, options);
      return webTracks.slice(0, 30);
    }
  );
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  channelId?: string;
  duration: number;
  thumbnail: string;
  category: "music" | "podcast";
  filterScore: number;
}

export const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://inv.tux.pizza",
  "https://invidious.protokoloni.lv",
  "https://iv.ggtyler.dev",
];

export async function searchArtistThumbnail(artistName: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(INNERTUBE_MUSIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://music.youtube.com",
        Referer: "https://music.youtube.com/",
      },
      body: JSON.stringify({
        context: YTMUSIC_CONTEXT,
        query: artistName,
        params: "EgWKAQIgAQ%3D%3D",
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const thumbnail = extractArtistThumbnail(data);
    return thumbnail;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractArtistThumbnail(data: unknown): string | null {
  const items: unknown[] = [];
  findArtistItems(data, items);

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const thumbnailRenderer = record.thumbnail as Record<string, unknown> | undefined;
    if (!thumbnailRenderer) continue;

    const musicThumbnail = thumbnailRenderer.musicThumbnailRenderer as Record<string, unknown> | undefined;
    if (!musicThumbnail) continue;

    const thumbData = musicThumbnail.thumbnail as Record<string, unknown> | undefined;
    if (!thumbData) continue;

    const thumbnails = thumbData.thumbnails as { url: string; width?: number }[] | undefined;
    if (!thumbnails || thumbnails.length === 0) continue;

    const best = thumbnails.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    if (best?.url) return best.url;
  }

  return null;
}

function findArtistItems(obj: unknown, results: unknown[]): void {
  if (results.length >= 5) return;
  if (obj === null || obj === undefined || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) findArtistItems(item, results);
    return;
  }

  const record = obj as Record<string, unknown>;
  if ("musicResponsiveListItemRenderer" in record && record.musicResponsiveListItemRenderer) {
    results.push(record.musicResponsiveListItemRenderer);
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      findArtistItems(value, results);
    }
  }
}

export async function getVideoMetadataById(videoId: string): Promise<VideoMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const url = `${instance}/api/v1/videos/${encodeURIComponent(videoId)}?fields=videoId,title,author,authorId,lengthSeconds,videoThumbnails`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) continue;

        const data = await res.json() as {
          videoId: string;
          title: string;
          author: string;
          authorId: string;
          lengthSeconds: number;
          videoThumbnails?: { quality: string; url: string }[];
        };

        if (!data.videoId || !data.title) continue;

        const thumbs = data.videoThumbnails ?? [];
        const hq = thumbs.find((t) => t.quality === "high");
        const med = thumbs.find((t) => t.quality === "medium");
        const thumbnail = hq?.url ?? med?.url ?? thumbs[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          videoId: data.videoId,
          title: data.title,
          channel: data.author,
          channelId: data.authorId || undefined,
          duration: data.lengthSeconds,
          thumbnail,
          category: data.lengthSeconds > 1200 ? "podcast" : "music",
          filterScore: 70,
        };
      } catch (err) {
        if (controller.signal.aborted) break;
        continue;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  return getVideoMetadataViaOEmbed(videoId);
}

async function getVideoMetadataViaOEmbed(videoId: string): Promise<VideoMetadata | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;

      const data = await res.json() as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };

      if (!data.title) return null;

      return {
        videoId,
        title: data.title,
        channel: data.author_name ?? "",
        duration: 0,
        thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        category: "music",
        filterScore: 60,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

export async function getVideoMetadataBatch(videoIds: string[]): Promise<VideoMetadata[]> {
  const results: VideoMetadata[] = [];
  const batchSize = 5;

  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const promises = batch.map((id) => getVideoMetadataById(id).catch(() => null));
    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

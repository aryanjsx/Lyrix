import ytdl from "@distube/ytdl-core";
import { Readable } from "stream";

export interface DownloadResult {
  stream: Readable;
  mimeType: string;
  title: string;
  artist: string;
  duration: number;
  contentLength: number;
}

async function downloadViaYtdl(
  videoId: string
): Promise<DownloadResult | null> {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  const info = await ytdl.getInfo(url);
  const audioFormats = ytdl
    .filterFormats(info.formats, "audioonly")
    .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

  if (audioFormats.length === 0) return null;

  const best = audioFormats[0];
  const stream = ytdl.downloadFromInfo(info, { format: best });

  return {
    stream,
    mimeType: best.mimeType?.split(";")[0] ?? "audio/mp4",
    title: info.videoDetails.title,
    artist: info.videoDetails.author.name,
    duration: parseInt(info.videoDetails.lengthSeconds, 10) || 0,
    contentLength: parseInt(best.contentLength ?? "0", 10) || 0,
  };
}

/* ── Invidious fallback ─────────────────────────────────────────────── */

const INVIDIOUS_INSTANCES = [
  "https://inv.thepixora.com",
  "https://invidious.f5.si",
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
];

const INVIDIOUS_LIST_URL =
  "https://api.invidious.io/instances.json?sort_by=api,health";

let cachedInstances: string[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getInvidiousInstances(): Promise<string[]> {
  if (cachedInstances && Date.now() < cacheExpiry) return cachedInstances;

  try {
    const res = await fetch(INVIDIOUS_LIST_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as [
        string,
        { api: boolean; type: string },
      ][];
      const live = data
        .filter(([, info]) => info.api === true && info.type === "https")
        .map(([u]) => u);
      if (live.length > 0) {
        const merged = [...new Set([...INVIDIOUS_INSTANCES, ...live])];
        cachedInstances = merged;
        cacheExpiry = Date.now() + CACHE_TTL;
        return merged;
      }
    }
  } catch {
    /* directory unreachable */
  }
  return INVIDIOUS_INSTANCES;
}

interface InvidiousFormat {
  type: string;
  bitrate: number;
  itag: number;
  clen: string;
  url: string;
}

interface InvidiousVideo {
  title: string;
  author: string;
  lengthSeconds: number;
  adaptiveFormats: InvidiousFormat[];
}

async function tryInvidious(
  instanceUrl: string,
  videoId: string,
  signal: AbortSignal
): Promise<DownloadResult | null> {
  const apiUrl = `${instanceUrl}/api/v1/videos/${encodeURIComponent(videoId)}?fields=title,author,lengthSeconds,adaptiveFormats&local=true`;

  const res = await fetch(apiUrl, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as InvidiousVideo;
  const audio = (data.adaptiveFormats ?? [])
    .filter((f) => f.type.startsWith("audio/") && f.url)
    .sort((a, b) => b.bitrate - a.bitrate);

  if (audio.length === 0) return null;

  const best = audio[0];
  const proxyUrl = best.url.replace(/^http:\/\//, "https://");

  const audioRes = await fetch(proxyUrl, { signal });
  if (!audioRes.ok || !audioRes.body) return null;

  return {
    stream: Readable.fromWeb(audioRes.body as import("stream/web").ReadableStream),
    mimeType: best.type.split(";")[0],
    title: data.title,
    artist: data.author,
    duration: data.lengthSeconds,
    contentLength: parseInt(best.clen, 10) || 0,
  };
}

async function downloadViaInvidious(
  videoId: string
): Promise<DownloadResult | null> {
  const instances = await getInvidiousInstances();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const BATCH = 4;
    for (let i = 0; i < instances.length; i += BATCH) {
      const batch = instances.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((inst) => tryInvidious(inst, videoId, controller.signal))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) return r.value;
      }
      if (controller.signal.aborted) break;
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ── Public API ──────────────────────────────────────────────────────── */

export async function getDownloadStream(
  videoId: string
): Promise<DownloadResult | null> {
  try {
    const result = await downloadViaYtdl(videoId);
    if (result) return result;
  } catch (err) {
    console.warn("[Download] ytdl-core failed:", (err as Error).message);
  }

  try {
    const result = await downloadViaInvidious(videoId);
    if (result) return result;
  } catch (err) {
    console.warn("[Download] Invidious fallback failed:", (err as Error).message);
  }

  return null;
}

const INVIDIOUS_INSTANCES = [
  "https://inv.thepixora.com",
  "https://invidious.f5.si",
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
];

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.syncpundit.io",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.r4fo.com",
];

const INVIDIOUS_LIST_URL =
  "https://api.invidious.io/instances.json?sort_by=api,health";

let cachedInvidiousInstances: string[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getInvidiousInstances(): Promise<string[]> {
  if (cachedInvidiousInstances && Date.now() < cacheExpiry) {
    return cachedInvidiousInstances;
  }

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
        .map(([url]) => url);

      if (live.length > 0) {
        const merged = [...new Set([...INVIDIOUS_INSTANCES, ...live])];
        cachedInvidiousInstances = merged;
        cacheExpiry = Date.now() + CACHE_TTL;
        return merged;
      }
    }
  } catch {
    // directory unreachable
  }

  return INVIDIOUS_INSTANCES;
}

interface InvidiousAdaptiveFormat {
  type: string;
  bitrate: number;
  itag: number;
  clen: string;
  url: string;
}

interface InvidiousVideoResponse {
  title: string;
  author: string;
  lengthSeconds: number;
  adaptiveFormats: InvidiousAdaptiveFormat[];
}

export interface AudioStreamResult {
  proxyUrl: string;
  mimeType: string;
  title: string;
  artist: string;
  duration: number;
  contentLength: number;
}

async function tryInvidious(
  instanceUrl: string,
  videoId: string,
  signal: AbortSignal
): Promise<AudioStreamResult | null> {
  const apiUrl = `${instanceUrl}/api/v1/videos/${encodeURIComponent(videoId)}?fields=title,author,lengthSeconds,adaptiveFormats&local=true`;

  const res = await fetch(apiUrl, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as InvidiousVideoResponse;
  const audioFormats = (data.adaptiveFormats ?? [])
    .filter((f) => f.type.startsWith("audio/"))
    .sort((a, b) => b.bitrate - a.bitrate);

  if (audioFormats.length === 0) return null;

  const best = audioFormats[0];
  if (!best.url) return null;

  const proxyUrl = best.url.replace(/^http:\/\//, "https://");

  return {
    proxyUrl,
    mimeType: best.type.split(";")[0],
    title: data.title,
    artist: data.author,
    duration: data.lengthSeconds,
    contentLength: parseInt(best.clen, 10) || 0,
  };
}

interface PipedAudioStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  bitrate: number;
  contentLength: number;
}

interface PipedStreamResponse {
  title: string;
  uploader: string;
  duration: number;
  audioStreams: PipedAudioStream[];
}

async function tryPiped(
  instanceUrl: string,
  videoId: string,
  signal: AbortSignal
): Promise<AudioStreamResult | null> {
  const apiUrl = `${instanceUrl}/streams/${encodeURIComponent(videoId)}`;

  const res = await fetch(apiUrl, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as PipedStreamResponse;
  const streams = (data.audioStreams ?? [])
    .filter((s) => s.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  if (streams.length === 0) return null;

  const best = streams[0];

  return {
    proxyUrl: best.url,
    mimeType: best.mimeType?.split(";")[0] || "audio/mp4",
    title: data.title,
    artist: data.uploader,
    duration: data.duration,
    contentLength: best.contentLength || 0,
  };
}

export async function getAudioStream(
  videoId: string,
  excludeUrls: string[] = []
): Promise<AudioStreamResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const invidiousInstances = await getInvidiousInstances();
    const BATCH = 4;

    for (let i = 0; i < invidiousInstances.length; i += BATCH) {
      const batch = invidiousInstances.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((inst) =>
          tryInvidious(inst, videoId, controller.signal)
        )
      );

      for (const r of results) {
        if (
          r.status === "fulfilled" &&
          r.value &&
          !excludeUrls.includes(r.value.proxyUrl)
        ) {
          return r.value;
        }
      }

      if (controller.signal.aborted) break;
    }

    for (let i = 0; i < PIPED_INSTANCES.length; i += BATCH) {
      const batch = PIPED_INSTANCES.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((inst) => tryPiped(inst, videoId, controller.signal))
      );

      for (const r of results) {
        if (
          r.status === "fulfilled" &&
          r.value &&
          !excludeUrls.includes(r.value.proxyUrl)
        ) {
          return r.value;
        }
      }

      if (controller.signal.aborted) break;
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

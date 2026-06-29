const HARDCODED_INSTANCES = [
  "https://inv.thepixora.com",
  "https://invidious.f5.si",
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
];

const INSTANCE_LIST_URL = "https://api.invidious.io/instances.json?sort_by=api,health";

let cachedInstances: string[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getInstances(): Promise<string[]> {
  if (cachedInstances && Date.now() < cacheExpiry) {
    return cachedInstances;
  }

  try {
    const res = await fetch(INSTANCE_LIST_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as [string, { api: boolean; type: string }][];
      const live = data
        .filter(([, info]) => info.api === true && info.type === "https")
        .map(([url]) => url);

      if (live.length > 0) {
        const merged = [...new Set([...HARDCODED_INSTANCES, ...live])];
        cachedInstances = merged;
        cacheExpiry = Date.now() + CACHE_TTL;
        return merged;
      }
    }
  } catch {
    // directory unreachable
  }

  return HARDCODED_INSTANCES;
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

async function tryInstance(
  instanceUrl: string,
  videoId: string,
  signal: AbortSignal
): Promise<AudioStreamResult | null> {
  const apiUrl = `${instanceUrl}/api/v1/videos/${encodeURIComponent(videoId)}?fields=title,author,lengthSeconds,adaptiveFormats`;

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
  const proxyUrl = `${instanceUrl}/latest_version?id=${encodeURIComponent(videoId)}&itag=${best.itag}&local=true`;

  return {
    proxyUrl,
    mimeType: best.type.split(";")[0],
    title: data.title,
    artist: data.author,
    duration: data.lengthSeconds,
    contentLength: parseInt(best.clen, 10) || 0,
  };
}

export async function getAudioStream(
  videoId: string,
  excludeInstances: string[] = []
): Promise<AudioStreamResult | null> {
  const allInstances = await getInstances();
  const instances = excludeInstances.length > 0
    ? allInstances.filter((i) => !excludeInstances.includes(i))
    : allInstances;

  if (instances.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const BATCH = 4;
    for (let i = 0; i < instances.length; i += BATCH) {
      const batch = instances.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((inst) => tryInstance(inst, videoId, controller.signal))
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

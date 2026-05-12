const INVIDIOUS_INSTANCES = [
  "https://invidious.f5.si",
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
];

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
  videoId: string
): Promise<AudioStreamResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const result = await tryInstance(instance, videoId, controller.signal);
        if (result) return result;
      } catch (err) {
        if (controller.signal.aborted) break;
        console.warn(`[Download] ${instance} failed:`, (err as Error).message);
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

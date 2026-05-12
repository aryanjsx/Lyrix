const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.in.projectsegfau.lt",
];

interface PipedAudioStream {
  url: string;
  mimeType: string;
  bitrate: number;
  codec: string;
  quality: string;
  contentLength: number;
}

interface PipedStreamResponse {
  title: string;
  uploader: string;
  audioStreams?: PipedAudioStream[];
}

export interface AudioStreamResult {
  streamUrl: string;
  mimeType: string;
  title: string;
  uploader: string;
}

async function tryPipedInstance(
  instanceUrl: string,
  videoId: string,
  signal: AbortSignal
): Promise<AudioStreamResult | null> {
  const url = `${instanceUrl}/streams/${encodeURIComponent(videoId)}`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as PipedStreamResponse;
  const audioStreams = data.audioStreams ?? [];

  if (audioStreams.length === 0) return null;

  const mp4Audio = audioStreams
    .filter((s) => s.mimeType.startsWith("audio/mp4") || s.mimeType.startsWith("audio/webm"))
    .sort((a, b) => b.bitrate - a.bitrate);

  const best = mp4Audio[0] ?? audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];
  if (!best?.url) return null;

  return {
    streamUrl: best.url,
    mimeType: best.mimeType,
    title: data.title,
    uploader: data.uploader,
  };
}

export async function getAudioStream(
  videoId: string
): Promise<AudioStreamResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    for (const instance of PIPED_INSTANCES) {
      try {
        const result = await tryPipedInstance(instance, videoId, controller.signal);
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

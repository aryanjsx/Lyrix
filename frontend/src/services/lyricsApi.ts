import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface LyricsResponse {
  videoId: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  hasSync: boolean;
  source: string | null;
}

export async function fetchLyrics(
  videoId: string,
  title: string,
  channel: string,
  duration: number
): Promise<LyricsResponse> {
  const params = new URLSearchParams({
    title,
    channel,
    duration: String(duration),
  });

  const res = await fetchWithAuth(
    `${API_URL}/api/lyrics/${encodeURIComponent(videoId)}?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Lyrics fetch failed: ${res.status}`);
  }

  return res.json() as Promise<LyricsResponse>;
}

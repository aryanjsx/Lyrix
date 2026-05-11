import type { RecommendationTrack, SmartMixData } from "@/store";
import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REMIX_PATTERN = /remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/i;

function filterOriginalTracks(tracks: RecommendationTrack[]): RecommendationTrack[] {
  return tracks.filter((t) => !REMIX_PATTERN.test(t.title));
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchForYou(): Promise<RecommendationTrack[]> {
  const res = await fetchWithAuth(`${API_URL}/api/recommendations/for-you`);
  const data = await handleJson<{ tracks: RecommendationTrack[] }>(res);
  return filterOriginalTracks(data.tracks);
}

export async function fetchTrending(languages?: string[]): Promise<RecommendationTrack[]> {
  let url = `${API_URL}/api/recommendations/trending`;
  if (languages && languages.length > 0) {
    url += `?languages=${encodeURIComponent(languages.join(","))}`;
  }
  const res = await fetchWithAuth(url);
  const data = await handleJson<{ tracks: RecommendationTrack[] }>(res);
  return filterOriginalTracks(data.tracks);
}

export async function fetchMoreLikeThis(
  videoId: string
): Promise<RecommendationTrack[]> {
  const res = await fetchWithAuth(
    `${API_URL}/api/recommendations/more-like/${encodeURIComponent(videoId)}`
  );
  const data = await handleJson<{ tracks: RecommendationTrack[] }>(res);
  return filterOriginalTracks(data.tracks);
}

export async function fetchMixes(): Promise<SmartMixData[]> {
  const res = await fetchWithAuth(`${API_URL}/api/recommendations/mixes`);
  const data = await handleJson<{ mixes: SmartMixData[] }>(res);
  return data.mixes;
}

export async function fetchRecentlyPlayed(
  limit = 20
): Promise<RecommendationTrack[]> {
  const res = await fetchWithAuth(
    `${API_URL}/api/recommendations/recently-played?limit=${limit}`
  );
  const data = await handleJson<{ tracks: RecommendationTrack[] }>(res);
  return filterOriginalTracks(data.tracks);
}

export interface UserStats {
  totalPlays: number;
  totalSeconds: number;
  playsLast7Days: number;
  topArtists: Array<{
    channelId: string;
    channelName: string;
    playCount: number;
    totalSeconds: number;
  }>;
  genreBreakdown: Array<{ genre: string; playCount: number }>;
  artistBreakdown: Array<{
    channelId: string;
    channelName: string;
    playCount: number;
    totalSeconds: number;
  }>;
  topTracksThisMonth: Array<{
    videoId: string;
    playCount: number;
    title: string;
    channel: string;
    thumbnail: string;
    duration: number;
  }>;
  currentStreak: number;
}

export async function fetchStats(): Promise<UserStats> {
  const res = await fetchWithAuth(`${API_URL}/api/stats`);
  return handleJson<UserStats>(res);
}


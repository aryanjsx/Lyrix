import type { Track } from "@/store";
import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SearchSource = "cache" | "youtube" | "innertube" | "invidious" | "piped" | "library";

interface SearchResponse {
  results: Track[];
  source: SearchSource;
}

export interface SyncOp {
  id: string;
  operation: string;
  playlistName: string;
  userEmail: string;
  trackCount: number;
  quotaUsed: number;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface TopConsumer {
  userId: string;
  totalQuotaUsed: number;
}

export interface QuotaResponse {
  date: string;
  units: number;
  status: "normal" | "warning" | "restricted" | "emergency";
  max: number;
  thresholds: {
    WARNING: number;
    RESTRICTED: number;
    EMERGENCY: number;
    MAX: number;
  };
  syncOps?: SyncOp[];
  topConsumers?: TopConsumer[];
}

export interface SearchResult {
  tracks: Track[];
  source: SearchSource;
}

export async function searchTracks(
  query: string,
  signal?: AbortSignal,
  type?: "music" | "podcast"
): Promise<SearchResult> {
  const encoded = encodeURIComponent(query.trim());
  const typeParam = type ? `&type=${type}` : "";
  const res = await fetchWithAuth(`${API_URL}/api/search?q=${encoded}${typeParam}`, {
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }

  const data: SearchResponse = await res.json();
  return { tracks: data.results, source: data.source };
}

export async function getQuota(): Promise<QuotaResponse> {
  const res = await fetch(`/api/admin/quota`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Quota fetch failed: ${res.status}`);
  }

  return res.json();
}

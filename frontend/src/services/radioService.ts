import type { Track } from "@/store";
import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface RadioSession {
  id: string;
  seedType: "artist" | "track";
  seedId: string;
  seedLabel: string;
  playedIds: Set<string>;
  fetchedPages: number;
}

let activeRadio: RadioSession | null = null;

export const radioService = {
  start(seed: {
    type: "artist" | "track";
    id: string;
    label: string;
  }): RadioSession {
    activeRadio = {
      id: crypto.randomUUID(),
      seedType: seed.type,
      seedId: seed.id,
      seedLabel: seed.label,
      playedIds: new Set(),
      fetchedPages: 0,
    };
    return activeRadio;
  },

  getActive(): RadioSession | null {
    return activeRadio;
  },

  stop(): void {
    activeRadio = null;
  },

  markPlayed(videoId: string): void {
    activeRadio?.playedIds.add(videoId);
  },

  isActive(): boolean {
    return activeRadio !== null;
  },

  async fetchNextBatch(): Promise<Track[]> {
    if (!activeRadio) return [];

    activeRadio.fetchedPages++;

    try {
      const res = await fetchWithAuth(`${API_URL}/api/radio/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedType: activeRadio.seedType,
          seedId: activeRadio.seedId,
          seedLabel: activeRadio.seedLabel,
          page: activeRadio.fetchedPages,
          excludeIds: Array.from(activeRadio.playedIds).slice(-100),
        }),
      });

      if (!res.ok) return [];
      const tracks: Track[] = await res.json();
      return tracks.filter((t) => !activeRadio!.playedIds.has(t.videoId));
    } catch {
      return [];
    }
  },
};

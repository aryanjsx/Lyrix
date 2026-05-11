import { getSessionToken } from "./authApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const STORAGE_KEY = "lyrix_search_history";
const MAX_ENTRIES = 20;
const DISPLAY_LIMIT = 8;

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
}

export const searchHistoryService = {
  getAll(): SearchHistoryEntry[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getRecent(limit = DISPLAY_LIMIT): SearchHistoryEntry[] {
    return this.getAll().slice(0, limit);
  },

  add(query: string): void {
    if (typeof window === "undefined") return;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    const existing = this.getAll();
    const deduped = existing.filter(
      (e) => e.query.toLowerCase() !== trimmed.toLowerCase()
    );

    const updated: SearchHistoryEntry[] = [
      { query: trimmed, timestamp: Date.now() },
      ...deduped,
    ].slice(0, MAX_ENTRIES);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage full or blocked
    }

    const token = getSessionToken();
    if (token) {
      fetch(`${API_URL}/api/search/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: trimmed }),
      }).catch(() => {});
    }
  },

  remove(query: string): void {
    if (typeof window === "undefined") return;
    const existing = this.getAll();
    const updated = existing.filter(
      (e) => e.query.toLowerCase() !== query.trim().toLowerCase()
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // fail silently
    }
  },

  clear(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // fail silently
    }
  },
};

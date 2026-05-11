const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const FALLBACK_SUGGESTIONS = [
  "Arijit Singh songs",
  "Lo-fi beats to study",
  "Top Bollywood 2026",
  "AP Dhillon new songs",
  "Instrumental music",
  "Punjabi hits 2026",
  "Chill evening playlist",
  "Workout motivation",
];

export function getQuerySuggestions(failedQuery: string): string[] {
  const q = failedQuery.trim();
  const suggestions: string[] = [];

  if (q.length > 3) {
    suggestions.push(`${q} songs`);
    suggestions.push(`best of ${q}`);
    suggestions.push(`${q} playlist`);
  }

  const remaining = FALLBACK_SUGGESTIONS.filter(
    (s) => !suggestions.some((ex) => ex.toLowerCase() === s.toLowerCase())
  ).slice(0, 6 - suggestions.length);

  return [...suggestions, ...remaining].slice(0, 6);
}

export async function getTrendingSearches(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/search/trending`);
    if (!res.ok) throw new Error();
    const data: string[] = await res.json();
    return data.length > 0 ? data : FALLBACK_SUGGESTIONS.slice(0, 6);
  } catch {
    return FALLBACK_SUGGESTIONS.slice(0, 6);
  }
}

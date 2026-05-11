import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function saveUserPreferences(
  languages: string[]
): Promise<void> {
  const res = await fetchWithAuth(`${API_URL}/api/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ languages }),
  });
  if (!res.ok) throw new Error("Failed to save preferences");
}

export async function fetchUserPreferences(): Promise<string[]> {
  const res = await fetchWithAuth(`${API_URL}/api/preferences`);
  if (!res.ok) return [];
  const data = (await res.json()) as { languages: string[] };
  return data.languages ?? [];
}

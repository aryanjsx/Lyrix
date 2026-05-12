import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function downloadTrack(
  videoId: string,
  title: string
): Promise<void> {
  const res = await fetchWithAuth(
    `${API_URL}/api/download/${encodeURIComponent(videoId)}`
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Download failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const safeName = title.replace(/[<>:"/\\|?*]+/g, "_").slice(0, 200);
  a.download = `${safeName}.mp3`;

  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

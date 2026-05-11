import type { UserProfile } from "@/store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_STORAGE_KEY = "lyrix_session";
const SESSION_MARKER_KEY = "lyrix_has_session";

let sessionToken: string | null = null;

export function setSessionToken(token: string): void {
  sessionToken = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(SESSION_MARKER_KEY, "1");
  } catch {
    // localStorage may be unavailable (private browsing)
  }
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function hasSessionMarker(): boolean {
  try {
    return localStorage.getItem(SESSION_MARKER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionMarker(): void {
  try {
    localStorage.setItem(SESSION_MARKER_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearSessionToken(): void {
  sessionToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    // ignore
  }
}

export function restoreSessionToken(): void {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      sessionToken = stored;
    }
  } catch {
    // localStorage may be unavailable
  }
}

export function migrateLegacyToken(): void {
  try {
    localStorage.removeItem("lyrix_auth_token");
  } catch {
    // localStorage may be unavailable (private browsing)
  }
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  try {
    const headers: HeadersInit = {};
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
    const res = await fetch(`${API_URL}/api/auth/me`, {
      credentials: "include",
      headers,
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    const headers: HeadersInit = {};
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
    await fetch(`${API_URL}/api/auth/logout`, {
      credentials: "include",
      headers,
    });
  } catch {
    // fail silently
  }
  clearSessionToken();
}

export function getGoogleLoginUrl(): string {
  return `${API_URL}/api/auth/google`;
}

function authHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (sessionToken) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${sessionToken}`;
  }
  return headers;
}

export async function logPlay(
  videoId: string,
  meta?: {
    title?: string;
    channel?: string;
    duration?: number;
    thumbnail?: string;
    category?: string;
  }
): Promise<void> {
  await fetch(`${API_URL}/api/history/log`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ videoId, ...meta }),
  });
}

export async function updateSecondsPlayed(
  videoId: string,
  seconds: number
): Promise<void> {
  await fetch(`${API_URL}/api/history/update`, {
    method: "PATCH",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ videoId, seconds }),
  });
}

export async function submitFeedback(
  videoId: string,
  feedback: "not_music" | "wrong_category" | "duplicate"
): Promise<void> {
  await fetch(`${API_URL}/api/feedback`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ videoId, feedback }),
  });
}

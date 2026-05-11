import { getSessionToken } from "./authApi";

export function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(options.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useLyrixStore, type SavedLibraryItem } from "@/store";
import {
  fetchCurrentUser,
  migrateLegacyToken,
  restoreSessionToken,
  setSessionToken,
  clearSessionToken,
  getSessionToken,
  hasSessionMarker,
  setSessionMarker,
} from "@/services/authApi";
import { listPlaylists, listSavedTracks, type SavedTrackApiRow } from "@/services/playlistApi";
import {
  fetchForYou,
  fetchMixes,
  fetchRecentlyPlayed,
} from "@/services/recommendationApi";
import { fetchUserPreferences } from "@/services/preferencesApi";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import { loadGuestPrefs, saveGuestPrefs } from "@/config/languages";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const RETURN_PATH_KEY = "lyrix_return_path";

function toSavedItem(row: SavedTrackApiRow): SavedLibraryItem {
  return {
    videoId: row.videoId,
    savedAt: row.savedAt,
    title: row.title,
    channel: row.channel,
    duration: row.duration,
    thumbnail: row.thumbnail,
    category: row.category,
    filterScore: row.filterScore,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useLyrixStore((s) => s.setUser);
  const clearUser = useLyrixStore((s) => s.clearUser);
  const router = useRouter();

  useEffect(() => {
    migrateLegacyToken();
    restoreSessionToken();

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    // Detect OAuth return before cleaning params
    const isOAuthReturn = !!token || params.get("auth") === "success";
    let returnPath: string | null = null;
    if (isOAuthReturn) {
      try {
        returnPath = sessionStorage.getItem(RETURN_PATH_KEY);
        sessionStorage.removeItem(RETURN_PATH_KEY);
      } catch { /* sessionStorage unavailable */ }
    }

    if (token) {
      setSessionToken(token);
      params.delete("token");
    }
    if (params.has("auth")) {
      params.delete("auth");
    }
    if (params.has("reason")) {
      params.delete("reason");
    }
    const clean = params.toString();
    const current = window.location.pathname + window.location.search;
    const cleanPath = window.location.pathname + (clean ? `?${clean}` : "");
    if (current !== cleanPath) {
      router.replace(cleanPath, undefined, { shallow: true });
    }

    const store = useLyrixStore.getState();
    const hasToken = !!getSessionToken();
    const hasCookieSession = hasSessionMarker();

    if (!hasToken && !isOAuthReturn && !hasCookieSession) {
      clearUser();
      return;
    }

    // --- Parallel prefetch: fire ALL authenticated requests at once ---
    // Mark library as syncing to prevent duplicate syncLibrary calls
    useLyrixStore.setState((s) => ({
      library: { ...s.library, syncInFlight: true },
    }));

    // Set loading flags so recommendation components skip their own fetches
    store.setRecoLoading("forYouLoading", true);
    store.setRecoLoading("mixesLoading", true);
    store.setRecoLoading("recentlyPlayedLoading", true);

    const authP = fetchCurrentUser();
    const playlistsP = listPlaylists().catch(() => null);
    const savedP = listSavedTracks().catch(() => null);
    const forYouP = fetchForYou().catch(() => [] as never[]);
    const mixesP = fetchMixes().catch(() => [] as never[]);
    const recentP = fetchRecentlyPlayed().catch(() => [] as never[]);
    const prefsP = fetchUserPreferences().catch(() => [] as string[]);

    authP.then((user) => {
      if (!user) {
        clearSessionToken();
        clearUser();
        useLyrixStore.setState((s) => ({
          library: { ...s.library, syncInFlight: false },
        }));
        return;
      }

      setSessionMarker();
      setUser(user);

      fetchWithAuth(`${API_URL}/api/onboarding/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && !data.hasCompletedOnboarding) {
            useLyrixStore.getState().setShowOnboarding(true);
          }
        })
        .catch(() => {});

      prefsP.then((langs) => {
        if (langs.length > 0) {
          useLyrixStore.getState().setLanguagePrefs(langs);
          saveGuestPrefs(langs);
        } else {
          const guest = loadGuestPrefs();
          if (guest.length > 0) {
            useLyrixStore.getState().setLanguagePrefs(guest);
          } else if (isOAuthReturn) {
            router.replace("/preferences?return=/");
            return;
          }
        }

        if (returnPath && returnPath !== "/" && returnPath !== window.location.pathname) {
          router.replace(returnPath);
        }
      });

      // Populate library data from parallel fetch
      Promise.all([playlistsP, savedP])
        .then(([playlists, savedResult]) => {
          if (playlists && savedResult) {
            const savedTracks = savedResult.tracks
              .map(toSavedItem)
              .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
            useLyrixStore.setState((s) => ({
              library: {
                ...s.library,
                playlists,
                savedTracks,
                savedTrackIds: new Set(savedTracks.map((t) => t.videoId)),
                savedTracksNextCursor: savedResult.nextCursor,
                syncInFlight: false,
              },
            }));
          } else {
            useLyrixStore.setState((s) => ({
              library: { ...s.library, syncInFlight: false },
            }));
          }
        })
        .catch(() => {
          useLyrixStore.setState((s) => ({
            library: { ...s.library, syncInFlight: false },
          }));
        });

      // Populate recommendation data from parallel fetch
      forYouP.then((tracks) => {
        const s = useLyrixStore.getState();
        if (tracks.length > 0) s.setForYou(tracks);
        else s.setRecoLoading("forYouLoading", false);
      });
      mixesP.then((mixes) => {
        const s = useLyrixStore.getState();
        if (mixes.length > 0) s.setMixes(mixes);
        else s.setRecoLoading("mixesLoading", false);
      });
      recentP.then((tracks) => {
        const s = useLyrixStore.getState();
        if (tracks.length > 0) s.setRecentlyPlayed(tracks);
        else s.setRecoLoading("recentlyPlayedLoading", false);
      });
    });
  }, [setUser, clearUser]);

  return <>{children}</>;
}

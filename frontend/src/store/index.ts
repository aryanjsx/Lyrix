import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  listPlaylists,
  listSavedTracks,
  saveTrackToLibrary as apiSaveTrackLibrary,
  unsaveTrackFromLibrary as apiUnsaveTrackLibrary,
  type SavedTrackApiRow,
} from "@/services/playlistApi";

export interface Track {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: "music" | "podcast";
  /** Present when track comes from search / API; defaults to 0 when saving to backend. */
  filterScore?: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  coverThumbnail: string | null;
  syncEnabled: boolean;
  createdAt: string;
}

export interface SavedLibraryItem {
  videoId: string;
  savedAt: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

export interface LibraryState {
  savedTrackIds: Set<string>;
  savedTracks: SavedLibraryItem[];
  playlists: PlaylistSummary[];
  syncInFlight: boolean;
  savedTracksNextCursor: string | null;
}

export interface PlayerState {
  videoId: string | null;
  status: "idle" | "loading" | "playing" | "paused" | "buffering" | "error";
  position: number;
  duration: number;
  volume: number;
  mode: "audio" | "video";
  restartCounter: number;
}

export interface QueueState {
  current: Track | null;
  next: Track | null;
  upcoming: Track[];
  history: Track[];
  playlistMode: boolean;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
}

export interface RecommendationTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

export interface SmartMixData {
  id: string;
  title: string;
  description: string;
  mixType: string;
  tracks: RecommendationTrack[];
  generatedAt: string;
}

export interface RecommendationState {
  forYou: RecommendationTrack[];
  trending: RecommendationTrack[];
  moreLikeThis: RecommendationTrack[];
  mixes: SmartMixData[];
  recentlyPlayed: RecommendationTrack[];
  forYouLoading: boolean;
  trendingLoading: boolean;
  moreLikeThisLoading: boolean;
  mixesLoading: boolean;
  recentlyPlayedLoading: boolean;
}

export type PlaySource = "similar_list" | "search" | "queue" | "recommendation" | "direct";

export interface SimilarQueueState {
  tracks: RecommendationTrack[];
  seedVideoId: string | null;
  seedGenre: string | null;
  seedLanguage: string | null;
  excludeIds: Set<string>;
  isAppending: boolean;
  isInitialLoading: boolean;
  lastPlaySource: PlaySource;
}

export interface NetworkState {
  status: "online" | "slow" | "offline";
  type: "4g" | "3g" | "2g" | "unknown";
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PreferencesState {
  languages: string[];
  hasSetPrefs: boolean;
  showOnboarding: boolean;
}

export interface UserState {
  isLoggedIn: boolean;
  profile: UserProfile | null;
  mode: "guest" | "authenticated";
}

export interface PlayerContext {
  type: "queue" | "playlist" | "daily_mix" | "radio" | null;
  label: string | null;
}

interface LyrixStore {
  player: PlayerState;
  queue: QueueState;
  network: NetworkState;
  user: UserState;
  preferences: PreferencesState;
  library: LibraryState;
  recommendations: RecommendationState;
  similarQueue: SimilarQueueState;
  playerContext: PlayerContext;

  setPlayerStatus: (status: PlayerState["status"]) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  togglePlaybackMode: () => void;

  playTrack: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (videoId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  advanceQueue: () => void;
  dismissPlayer: () => void;
  setPlaylistMode: (mode: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  previousTrack: () => void;

  setNetwork: (network: NetworkState) => void;

  setUser: (profile: UserProfile) => void;
  clearUser: () => void;

  setLanguagePrefs: (languages: string[]) => void;
  setShowOnboarding: (show: boolean) => void;

  syncLibrary: () => Promise<void>;
  appendSavedTracksPage: (
    rows: SavedTrackApiRow[],
    nextCursor: string | null
  ) => void;
  setSavedTracks: (tracks: SavedLibraryItem[]) => void;
  addSavedTrack: (item: SavedLibraryItem) => void;
  removeSavedTrack: (videoId: string) => void;
  setPlaylists: (playlists: PlaylistSummary[]) => void;
  addPlaylist: (playlist: PlaylistSummary) => void;
  patchPlaylist: (id: string, patch: Partial<PlaylistSummary>) => void;
  removePlaylist: (id: string) => void;
  saveTrackToLibrary: (track: Track) => Promise<void>;
  unsaveTrackFromLibrary: (videoId: string) => Promise<void>;
  bumpPlaylistTrackCount: (playlistId: string) => void;

  setForYou: (tracks: RecommendationTrack[]) => void;
  setTrending: (tracks: RecommendationTrack[]) => void;
  setMoreLikeThis: (tracks: RecommendationTrack[]) => void;
  setMixes: (mixes: SmartMixData[]) => void;
  setRecentlyPlayed: (tracks: RecommendationTrack[]) => void;
  setRecoLoading: (key: keyof Pick<RecommendationState, "forYouLoading" | "trendingLoading" | "moreLikeThisLoading" | "mixesLoading" | "recentlyPlayedLoading">, value: boolean) => void;

  initSimilarQueue: (seedVideoId: string, genre: string, language: string, tracks: RecommendationTrack[]) => void;
  consumeSimilarTrack: (videoId: string) => void;
  appendSimilarTrack: (track: RecommendationTrack) => void;
  setSimilarAppending: (value: boolean) => void;
  setLastPlaySource: (source: PlaySource) => void;
  setPlayerContext: (ctx: PlayerContext) => void;
  clearPlayerContext: () => void;

  restoreSession: (data: {
    player: Partial<PlayerState>;
    queue: Partial<QueueState>;
  }) => void;
}

const MAX_HISTORY = 20;

function getOptimisticAuthState(): UserState {
  if (typeof window === "undefined") {
    return { isLoggedIn: false, profile: null, mode: "guest" };
  }
  try {
    const hasSession = localStorage.getItem("lyrix_has_session") === "1";
    if (hasSession) {
      return { isLoggedIn: true, profile: null, mode: "authenticated" };
    }
  } catch {
    // localStorage unavailable
  }
  return { isLoggedIn: false, profile: null, mode: "guest" };
}

const emptyLibrary = (): LibraryState => ({
  savedTrackIds: new Set(),
  savedTracks: [],
  playlists: [],
  syncInFlight: false,
  savedTracksNextCursor: null,
});

function rowsToSavedItems(rows: SavedTrackApiRow[]): SavedLibraryItem[] {
  return rows.map((row) => ({
    videoId: row.videoId,
    savedAt: row.savedAt,
    title: row.title,
    channel: row.channel,
    duration: row.duration,
    thumbnail: row.thumbnail,
    category: row.category,
    filterScore: row.filterScore,
  }));
}

export const useLyrixStore = create<LyrixStore>()(
  subscribeWithSelector((set, get) => ({
    player: {
      videoId: null,
      status: "idle",
      position: 0,
      duration: 0,
      volume: 80,
      mode: "audio",
      restartCounter: 0,
    },

    queue: {
      current: null,
      next: null,
      upcoming: [],
      history: [],
      playlistMode: false,
      shuffle: false,
      repeat: "off",
    },

    network: {
      status: "online",
      type: "unknown",
    },

    user: getOptimisticAuthState(),

    preferences: {
      languages: [],
      hasSetPrefs: false,
      showOnboarding: false,
    },

    library: emptyLibrary(),

    similarQueue: {
      tracks: [],
      seedVideoId: null,
      seedGenre: null,
      seedLanguage: null,
      excludeIds: new Set<string>(),
      isAppending: false,
      isInitialLoading: true,
      lastPlaySource: "direct" as PlaySource,
    },

    playerContext: { type: null, label: null },

    recommendations: {
      forYou: [],
      trending: [],
      moreLikeThis: [],
      mixes: [],
      recentlyPlayed: [],
      forYouLoading: false,
      trendingLoading: false,
      moreLikeThisLoading: false,
      mixesLoading: false,
      recentlyPlayedLoading: false,
    },

    setPlayerStatus: (status) =>
      set((state) => ({ player: { ...state.player, status } })),

    setPosition: (position) =>
      set((state) => ({ player: { ...state.player, position } })),

    setDuration: (duration) =>
      set((state) => ({ player: { ...state.player, duration } })),

    setVolume: (volume) =>
      set((state) => ({ player: { ...state.player, volume } })),

    togglePlaybackMode: () =>
      set((state) => ({
        player: {
          ...state.player,
          mode: state.player.mode === "audio" ? "video" : "audio",
        },
      })),

    playTrack: (track) =>
      set((state) => {
        const history = state.queue.current
          ? [state.queue.current, ...state.queue.history].slice(0, MAX_HISTORY)
          : state.queue.history;

        const fullQueue = [
          ...(state.queue.next ? [state.queue.next] : []),
          ...state.queue.upcoming,
        ];
        const queueIdx = fullQueue.findIndex(
          (t) => t.videoId === track.videoId
        );

        if (queueIdx >= 0) {
          const remaining = fullQueue.slice(queueIdx + 1);
          return {
            player: {
              ...state.player,
              videoId: track.videoId,
              status: "loading",
              position: 0,
              duration: track.duration,
            },
            queue: {
              ...state.queue,
              current: track,
              next: remaining[0] ?? null,
              upcoming: remaining.slice(1),
              history,
            },
          };
        }

        return {
          player: {
            ...state.player,
            videoId: track.videoId,
            status: "loading",
            position: 0,
            duration: track.duration,
          },
          queue: {
            ...state.queue,
            current: track,
            next: null,
            upcoming: [],
            playlistMode: false,
            history,
          },
        };
      }),

    addToQueue: (track) =>
      set((state) => {
        if (state.queue.current?.videoId === track.videoId) return state;
        if (state.queue.next?.videoId === track.videoId) return state;
        if (state.queue.upcoming.some((t) => t.videoId === track.videoId))
          return state;

        if (!state.queue.current) {
          return {
            player: {
              ...state.player,
              videoId: track.videoId,
              status: "loading",
              position: 0,
              duration: track.duration,
            },
            queue: {
              ...state.queue,
              current: track,
              next: state.queue.next,
            },
          };
        }

        if (!state.queue.next) {
          return {
            queue: { ...state.queue, next: track },
          };
        }

        return {
          queue: {
            ...state.queue,
            upcoming: [...state.queue.upcoming, track],
          },
        };
      }),

    removeFromQueue: (videoId) =>
      set((state) => {
        if (state.queue.current?.videoId === videoId) return state;

        if (state.queue.next?.videoId === videoId) {
          const newNext = state.queue.upcoming[0] ?? null;
          return {
            queue: {
              ...state.queue,
              next: newNext,
              upcoming: state.queue.upcoming.slice(newNext ? 1 : 0),
            },
          };
        }

        return {
          queue: {
            ...state.queue,
            upcoming: state.queue.upcoming.filter((t) => t.videoId !== videoId),
          },
        };
      }),

    reorderQueue: (fromIndex, toIndex) =>
      set((state) => {
        const items = [
          ...(state.queue.next ? [state.queue.next] : []),
          ...state.queue.upcoming,
        ];
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return state;
        const moved = [...items];
        const [item] = moved.splice(fromIndex, 1);
        moved.splice(toIndex, 0, item);
        return {
          queue: {
            ...state.queue,
            next: moved[0] ?? null,
            upcoming: moved.slice(1),
          },
        };
      }),

    advanceQueue: () =>
      set((state) => {
        const { current, next, upcoming, history, shuffle, repeat } = state.queue;

        if (repeat === "one" && current) {
          return {
            player: {
              ...state.player,
              videoId: current.videoId,
              status: "loading",
              position: 0,
              duration: current.duration,
            },
          };
        }

        const newHistory = current
          ? [current, ...history].slice(0, MAX_HISTORY)
          : history;

        let pool = [...upcoming];
        let newNext = next;

        if (!newNext && pool.length > 0 && !shuffle) {
          newNext = pool[0];
          pool = pool.slice(1);
        }

        if (shuffle && pool.length > 0) {
          const allPool = newNext ? [newNext, ...pool] : pool;
          const filtered = current
            ? allPool.filter((t) => t.videoId !== current.videoId)
            : allPool;
          const candidates = filtered.length > 0 ? filtered : allPool;
          const idx = Math.floor(Math.random() * candidates.length);
          const picked = candidates[idx];
          const rest = allPool.filter((t) => t !== picked);
          newNext = picked;
          pool = rest;
        }

        if (newNext && current && newNext.videoId === current.videoId && pool.length > 0) {
          const alt = pool[0];
          pool = [newNext, ...pool.slice(1)];
          newNext = alt;
        }

        const newCurrent = newNext;
        const nextAfter = pool[0] ?? null;
        const newUpcoming = pool.slice(nextAfter ? 1 : 0);

        if (!newCurrent && repeat === "all" && newHistory.length > 0) {
          const restored = [...newHistory].reverse();
          const first = restored[0];
          const restOfQueue = restored.slice(1);
          return {
            player: {
              ...state.player,
              videoId: first.videoId,
              status: "loading",
              position: 0,
              duration: first.duration,
            },
            queue: {
              ...state.queue,
              current: first,
              next: restOfQueue[0] ?? null,
              upcoming: restOfQueue.slice(1),
              history: [],
            },
          };
        }

        if (!newCurrent) {
          const similar = state.recommendations.moreLikeThis;
          const seenIds = new Set([
            current?.videoId,
            ...newHistory.map((t) => t.videoId),
          ]);
          const available = similar.filter((t) => !seenIds.has(t.videoId));

          if (available.length > 0) {
            const first = available[0];
            const rest = available.slice(1);
            const similarAsTrack = (t: typeof first) => ({
              videoId: t.videoId,
              title: t.title,
              channel: t.channel,
              duration: t.duration,
              thumbnail: t.thumbnail,
              category: t.category as "music" | "podcast",
              filterScore: t.filterScore,
            });
            return {
              player: {
                ...state.player,
                videoId: first.videoId,
                status: "loading",
                position: 0,
                duration: first.duration,
              },
              queue: {
                ...state.queue,
                current: similarAsTrack(first),
                next: rest[0] ? similarAsTrack(rest[0]) : null,
                upcoming: rest.slice(1).map(similarAsTrack),
                history: newHistory,
              },
            };
          }
        }

        return {
          player: {
            ...state.player,
            videoId: newCurrent?.videoId ?? null,
            status: newCurrent ? "loading" : "idle",
            position: 0,
            duration: newCurrent?.duration ?? 0,
          },
          queue: {
            ...state.queue,
            current: newCurrent,
            next: nextAfter,
            upcoming: newUpcoming,
            history: newHistory,
          },
        };
      }),

    dismissPlayer: () =>
      set((state) => ({
        player: {
          ...state.player,
          videoId: null,
          status: "idle",
          position: 0,
          duration: 0,
        },
        queue: {
          ...state.queue,
          current: null,
          next: null,
          upcoming: [],
          playlistMode: false,
        },
      })),

    setPlaylistMode: (mode) =>
      set((state) => ({
        queue: { ...state.queue, playlistMode: mode },
      })),

    toggleShuffle: () =>
      set((state) => ({
        queue: { ...state.queue, shuffle: !state.queue.shuffle },
      })),

    cycleRepeat: () =>
      set((state) => {
        const order: Array<"off" | "one" | "all"> = ["off", "all", "one"];
        const idx = order.indexOf(state.queue.repeat);
        const next = order[(idx + 1) % order.length];
        return { queue: { ...state.queue, repeat: next } };
      }),

    previousTrack: () =>
      set((state) => {
        if (state.player.position > 3) {
          return {
            player: { ...state.player, position: 0, restartCounter: state.player.restartCounter + 1 },
          };
        }

        const prev = state.queue.history[0];
        if (!prev) {
          return { player: { ...state.player, position: 0, restartCounter: state.player.restartCounter + 1 } };
        }

        const newUpcoming = state.queue.next
          ? [state.queue.next, ...state.queue.upcoming]
          : state.queue.upcoming;

        return {
          player: {
            ...state.player,
            videoId: prev.videoId,
            status: "loading",
            position: 0,
            duration: prev.duration,
          },
          queue: {
            ...state.queue,
            current: prev,
            next: state.queue.current,
            upcoming: newUpcoming,
            history: state.queue.history.slice(1),
          },
        };
      }),

    setNetwork: (network) => set({ network }),

    setUser: (profile) =>
      set({
        user: {
          isLoggedIn: true,
          profile,
          mode: "authenticated",
        },
      }),

    setLanguagePrefs: (languages) =>
      set((state) => ({
        preferences: { ...state.preferences, languages, hasSetPrefs: true },
      })),

    setShowOnboarding: (show) =>
      set((state) => ({
        preferences: { ...state.preferences, showOnboarding: show },
      })),

    clearUser: () => {
      try { localStorage.removeItem("lyrix_has_session"); } catch { /* noop */ }
      set({
        user: {
          isLoggedIn: false,
          profile: null,
          mode: "guest",
        },
        library: emptyLibrary(),
        recommendations: {
          forYou: [],
          trending: [],
          moreLikeThis: [],
          mixes: [],
          recentlyPlayed: [],
          forYouLoading: false,
          trendingLoading: false,
          moreLikeThisLoading: false,
          mixesLoading: false,
          recentlyPlayedLoading: false,
        },
      });
    },

    syncLibrary: async () => {
      const { user, library } = get();
      if (!user.isLoggedIn || library.syncInFlight) return;
      set({ library: { ...library, syncInFlight: true } });
      try {
        const [playlistRows, savedResult] = await Promise.all([
          listPlaylists(),
          listSavedTracks(),
        ]);
        const savedTracks = rowsToSavedItems(savedResult.tracks).sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        set({
          library: {
            ...get().library,
            playlists: playlistRows,
            savedTracks,
            savedTrackIds: new Set(savedTracks.map((t) => t.videoId)),
            savedTracksNextCursor: savedResult.nextCursor,
            syncInFlight: false,
          },
        });
      } catch {
        set({ library: { ...get().library, syncInFlight: false } });
      }
    },

    appendSavedTracksPage: (rows, nextCursor) =>
      set((state) => {
        const newItems = rowsToSavedItems(rows);
        const seen = new Set(state.library.savedTracks.map((t) => t.videoId));
        const merged = [...state.library.savedTracks];
        for (const item of newItems) {
          if (!seen.has(item.videoId)) {
            merged.push(item);
            seen.add(item.videoId);
          }
        }
        const savedTracks = merged.sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        return {
          library: {
            ...state.library,
            savedTracks,
            savedTrackIds: new Set(savedTracks.map((t) => t.videoId)),
            savedTracksNextCursor: nextCursor,
          },
        };
      }),

    setSavedTracks: (tracks) =>
      set((state) => {
        const savedTracks = [...tracks].sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        return {
          library: {
            ...state.library,
            savedTrackIds: new Set(savedTracks.map((t) => t.videoId)),
            savedTracks,
            savedTracksNextCursor: null,
          },
        };
      }),

    addSavedTrack: (item) =>
      set((state) => {
        const without = state.library.savedTracks.filter(
          (t) => t.videoId !== item.videoId
        );
        const savedTracks = [item, ...without].sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        const nextIds = new Set(state.library.savedTrackIds);
        nextIds.add(item.videoId);
        return {
          library: {
            ...state.library,
            savedTrackIds: nextIds,
            savedTracks,
          },
        };
      }),

    removeSavedTrack: (videoId) =>
      set((state) => {
        const nextIds = new Set(state.library.savedTrackIds);
        nextIds.delete(videoId);
        return {
          library: {
            ...state.library,
            savedTrackIds: nextIds,
            savedTracks: state.library.savedTracks.filter(
              (t) => t.videoId !== videoId
            ),
          },
        };
      }),

    setPlaylists: (playlists) =>
      set((state) => ({
        library: { ...state.library, playlists },
      })),

    addPlaylist: (playlist) =>
      set((state) => ({
        library: {
          ...state.library,
          playlists: [playlist, ...state.library.playlists],
        },
      })),

    patchPlaylist: (id, patch) =>
      set((state) => ({
        library: {
          ...state.library,
          playlists: state.library.playlists.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        },
      })),

    removePlaylist: (id) =>
      set((state) => ({
        library: {
          ...state.library,
          playlists: state.library.playlists.filter((p) => p.id !== id),
        },
      })),

    saveTrackToLibrary: async (track) => {
      await apiSaveTrackLibrary(track, track.filterScore ?? 0);
      const savedAt = new Date().toISOString();
      get().addSavedTrack({
        videoId: track.videoId,
        savedAt,
        title: track.title,
        channel: track.channel,
        duration: track.duration,
        thumbnail: track.thumbnail,
        category: track.category,
        filterScore: track.filterScore ?? 0,
      });
    },

    unsaveTrackFromLibrary: async (videoId) => {
      await apiUnsaveTrackLibrary(videoId);
      get().removeSavedTrack(videoId);
    },

    bumpPlaylistTrackCount: (playlistId) =>
      set((state) => ({
        library: {
          ...state.library,
          playlists: state.library.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, trackCount: p.trackCount + 1 }
              : p
          ),
        },
      })),

    setForYou: (tracks) =>
      set((state) => ({
        recommendations: { ...state.recommendations, forYou: tracks, forYouLoading: false },
      })),

    setTrending: (tracks) =>
      set((state) => ({
        recommendations: { ...state.recommendations, trending: tracks, trendingLoading: false },
      })),

    setMoreLikeThis: (tracks) =>
      set((state) => ({
        recommendations: { ...state.recommendations, moreLikeThis: tracks, moreLikeThisLoading: false },
      })),

    setMixes: (mixes) =>
      set((state) => ({
        recommendations: { ...state.recommendations, mixes, mixesLoading: false },
      })),

    setRecentlyPlayed: (tracks) =>
      set((state) => ({
        recommendations: { ...state.recommendations, recentlyPlayed: tracks, recentlyPlayedLoading: false },
      })),

    setRecoLoading: (key, value) =>
      set((state) => ({
        recommendations: { ...state.recommendations, [key]: value },
      })),

    initSimilarQueue: (seedVideoId, genre, language, tracks) =>
      set((state) => {
        const excludeIds = new Set<string>(tracks.map((t) => t.videoId));
        excludeIds.add(seedVideoId);
        return {
          similarQueue: {
            tracks,
            seedVideoId,
            seedGenre: genre,
            seedLanguage: language,
            excludeIds,
            isAppending: false,
            isInitialLoading: false,
            lastPlaySource: "direct" as PlaySource,
          },
          recommendations: {
            ...state.recommendations,
            moreLikeThis: tracks,
            moreLikeThisLoading: false,
          },
        };
      }),

    consumeSimilarTrack: (videoId) =>
      set((state) => {
        const newTracks = state.similarQueue.tracks.filter((t) => t.videoId !== videoId);
        const newExcludeIds = new Set(state.similarQueue.excludeIds);
        newExcludeIds.add(videoId);
        return {
          similarQueue: {
            ...state.similarQueue,
            tracks: newTracks,
            excludeIds: newExcludeIds,
          },
        };
      }),

    appendSimilarTrack: (track) =>
      set((state) => {
        const newExcludeIds = new Set(state.similarQueue.excludeIds);
        newExcludeIds.add(track.videoId);
        return {
          similarQueue: {
            ...state.similarQueue,
            tracks: [...state.similarQueue.tracks, track],
            excludeIds: newExcludeIds,
            isAppending: false,
          },
        };
      }),

    setSimilarAppending: (value) =>
      set((state) => ({
        similarQueue: { ...state.similarQueue, isAppending: value },
      })),

    setLastPlaySource: (source) =>
      set((state) => ({
        similarQueue: { ...state.similarQueue, lastPlaySource: source },
      })),

    setPlayerContext: (ctx) => set({ playerContext: ctx }),
    clearPlayerContext: () =>
      set({ playerContext: { type: null, label: null } }),

    restoreSession: (data) =>
      set((state) => ({
        player: { ...state.player, ...data.player },
        queue: { ...state.queue, ...data.queue },
      })),
  }))
);

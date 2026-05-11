import { useCallback, useEffect, useRef, useMemo } from "react";
import { useLyrixStore } from "@/store";
import type { Track } from "@/store";
import { searchTracks } from "@/services/api";
import { fetchMoreLikeThis } from "@/services/recommendationApi";
import { logPlay, updateSecondsPlayed } from "@/services/authApi";
import { analytics, EVENTS } from "@/services/analyticsService";
import { playbackMetrics } from "@/services/playbackMetrics";
import { radioService } from "@/services/radioService";
import { LANGUAGES } from "@/config/languages";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: Array<() => void> = [];

function loadYouTubeAPI(): void {
  if (apiLoaded) return;
  apiLoaded = true;

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScript = document.getElementsByTagName("script")[0];
  firstScript?.parentNode?.insertBefore(tag, firstScript);

  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
  };
}

function onAPIReady(cb: () => void): void {
  if (apiReady) {
    cb();
  } else {
    readyCallbacks.push(cb);
  }
}

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
const MAX_RETRIES = 5;

function getBackoffDelay(attempt: number): number {
  return Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS);
}

let sharedPlayer: YT.Player | null = null;
let sharedInitialized = false;
let sharedPendingSeek: number | null = null;
let sharedRetryCount = 0;
let sharedRetryTimer: ReturnType<typeof setTimeout> | null = null;
let sharedCuedVideo: string | null = null;
let autoFillInFlight = false;
let positionInterval: ReturnType<typeof setInterval> | null = null;
let lastLoggedVideoId: string | null = null;
let lastFlushedSeconds = 0;
let secondsFlushTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListenerAdded = false;

function getExistingIds(): Set<string | undefined> {
  const state = useLyrixStore.getState();
  return new Set([
    state.queue.current?.videoId,
    state.queue.next?.videoId,
    ...state.queue.upcoming.map((t) => t.videoId),
    ...state.queue.history.slice(0, 5).map((t) => t.videoId),
  ]);
}

function enqueueFresh(tracks: Track[], existing: Set<string | undefined>, limit: number): number {
  let added = 0;
  for (const track of tracks) {
    if (added >= limit) break;
    if (!existing.has(track.videoId)) {
      useLyrixStore.getState().addToQueue(track);
      existing.add(track.videoId);
      added++;
    }
  }
  return added;
}

function recoToTrack(r: { videoId: string; title: string; channel: string; duration: number; thumbnail: string; category: string; filterScore: number }): Track {
  return {
    videoId: r.videoId,
    title: r.title,
    channel: r.channel,
    duration: r.duration,
    thumbnail: r.thumbnail,
    category: r.category as "music" | "podcast",
    filterScore: r.filterScore,
  };
}

let radioFillInFlight = false;

async function ensureRadioQueue(): Promise<void> {
  if (radioFillInFlight || !radioService.isActive()) return;
  const state = useLyrixStore.getState();
  const upcoming = state.queue.upcoming.length + (state.queue.next ? 1 : 0);
  if (upcoming >= 3) return;

  radioFillInFlight = true;
  try {
    const newTracks = await radioService.fetchNextBatch();
    if (newTracks.length > 0) {
      const existing = getExistingIds();
      enqueueFresh(newTracks, existing, 10);
    }
  } catch {
    // best-effort
  } finally {
    radioFillInFlight = false;
  }
}

async function autoFillQueue(): Promise<void> {
  if (autoFillInFlight) return;
  const state = useLyrixStore.getState();
  const lastPlayed = state.queue.current ?? state.queue.history[0] ?? null;
  if (!lastPlayed) return;

  autoFillInFlight = true;
  const TARGET = 5;
  try {
    const existing = getExistingIds();
    let added = 0;

    const cached = state.recommendations.moreLikeThis;
    if (cached.length > 0) {
      added = enqueueFresh(cached.map(recoToTrack), existing, TARGET);
    }

    if (added < TARGET && lastPlayed.videoId) {
      const prefLangs = useLyrixStore.getState().preferences.languages;
      let searchQuery = lastPlayed.title;
      if (prefLangs.length > 0) {
        const kw = LANGUAGES.find((l) => prefLangs.includes(l.id))?.keywords[0];
        if (kw) searchQuery = `${lastPlayed.title} ${kw}`;
      }

      const [recoResult, searchResult] = await Promise.allSettled([
        fetchMoreLikeThis(lastPlayed.videoId),
        searchTracks(searchQuery),
      ]);

      if (recoResult.status === "fulfilled") {
        useLyrixStore.getState().setMoreLikeThis(recoResult.value);
        added += enqueueFresh(recoResult.value.map(recoToTrack), existing, TARGET - added);
      }

      if (added < TARGET && searchResult.status === "fulfilled") {
        enqueueFresh(searchResult.value.tracks, existing, TARGET - added);
      }
    }
  } catch {
    // auto-fill is best-effort
  } finally {
    autoFillInFlight = false;
  }
}

function flushSecondsPlayed(): void {
  if (sharedPlayer?.getCurrentTime) {
    const livePos = sharedPlayer.getCurrentTime();
    if (typeof livePos === "number" && livePos > 0) {
      useLyrixStore.getState().setPosition(Math.floor(livePos));
    }
  }
  const s = useLyrixStore.getState();
  const vid = s.queue.current?.videoId;
  const pos = s.player.position;
  if (vid && s.user.isLoggedIn && pos > 0 && pos !== lastFlushedSeconds) {
    lastFlushedSeconds = pos;
    updateSecondsPlayed(vid, pos).catch(() => {});
  }
}

function startPeriodicFlush(): void {
  if (secondsFlushTimer) return;
  secondsFlushTimer = setInterval(flushSecondsPlayed, 15_000);
}

function stopPeriodicFlush(): void {
  if (secondsFlushTimer) {
    clearInterval(secondsFlushTimer);
    secondsFlushTimer = null;
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    flushSecondsPlayed();
  }
}

function ensureVisibilityListener(): void {
  if (visibilityListenerAdded) return;
  visibilityListenerAdded = true;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", flushSecondsPlayed);
}

let isFirstPlayForTrack = true;
let wasBuffering = false;

function handleStateChange(event: YT.OnStateChangeEvent): void {
  const { setPlayerStatus, advanceQueue } = useLyrixStore.getState();

  switch (event.data) {
    case YT.PlayerState.PLAYING: {
      setPlayerStatus("playing");
      sharedRetryCount = 0;

      if (sharedPendingSeek !== null && sharedPendingSeek > 0) {
        sharedPlayer?.seekTo(sharedPendingSeek, true);
        sharedPendingSeek = null;
      }

      const s = useLyrixStore.getState();
      const current = s.queue.current;
      const vid = current?.videoId;
      if (vid) {
        if (isFirstPlayForTrack) {
          playbackMetrics.onFirstPlay(vid);
          isFirstPlayForTrack = false;
        } else if (wasBuffering) {
          playbackMetrics.onBufferingEnd(vid);
        }
        wasBuffering = false;

        radioService.markPlayed(vid);
        ensureRadioQueue().catch(() => {});
        analytics.track(EVENTS.PLAYBACK_STARTED, { video_id: vid });
        if (s.user.isLoggedIn && vid !== lastLoggedVideoId) {
          lastLoggedVideoId = vid;
          lastFlushedSeconds = 0;
          logPlay(vid, {
            title: current.title,
            channel: current.channel,
            duration: current.duration,
            thumbnail: current.thumbnail,
            category: current.category,
          }).catch(() => {
            console.warn("[Lyrix] logPlay failed for", vid);
          });
        }
      }
      startPeriodicFlush();
      ensureVisibilityListener();
      break;
    }
    case YT.PlayerState.PAUSED: {
      if (sharedPlayer?.getCurrentTime) {
        const pos = sharedPlayer.getCurrentTime();
        if (typeof pos === "number") {
          useLyrixStore.getState().setPosition(Math.floor(pos));
        }
      }
      setPlayerStatus("paused");
      analytics.track(EVENTS.PLAYBACK_PAUSED);
      flushSecondsPlayed();
      stopPeriodicFlush();
      break;
    }
    case YT.PlayerState.BUFFERING: {
      setPlayerStatus("buffering");
      wasBuffering = true;
      const bufferVid = useLyrixStore.getState().queue.current?.videoId;
      if (bufferVid && sharedPlayer?.getCurrentTime) {
        const pos = sharedPlayer.getCurrentTime() ?? 0;
        playbackMetrics.onBufferingStart(bufferVid, pos);
      }
      break;
    }
    case YT.PlayerState.CUED:
      break;
    case YT.PlayerState.ENDED: {
      stopPeriodicFlush();
      const state = useLyrixStore.getState();
      const endedVid = state.queue.current?.videoId;
      if (endedVid && state.user.isLoggedIn && state.player.position > 0) {
        updateSecondsPlayed(endedVid, state.player.position).catch(() => {});
      }

      if (endedVid && sharedPlayer) {
        const dur = sharedPlayer.getDuration?.() ?? 0;
        const played = sharedPlayer.getCurrentTime?.() ?? 0;
        playbackMetrics.onTrackCompleted(endedVid, dur, played);
      }
      isFirstPlayForTrack = true;

      if (state.queue.repeat === "one" && endedVid && sharedPlayer?.seekTo) {
        sharedPlayer.seekTo(0, true);
        sharedPlayer.playVideo();
        useLyrixStore.getState().setPosition(0);
        lastLoggedVideoId = null;
        break;
      }

      if (
        state.queue.playlistMode &&
        !state.queue.next &&
        state.queue.upcoming.length === 0
      ) {
        useLyrixStore.getState().setPlaylistMode(false);
      }

      lastLoggedVideoId = null;

      const queueHasNext = !!state.queue.next || state.queue.upcoming.length > 0;
      if (queueHasNext) {
        advanceQueue();
      } else if (radioService.isActive()) {
        ensureRadioQueue().then(() => {
          useLyrixStore.getState().advanceQueue();
        });
      } else {
        analytics.track(EVENTS.QUEUE_EXHAUSTED);
        autoFillQueue().then(() => {
          useLyrixStore.getState().advanceQueue();
        });
      }
      break;
    }
    case YT.PlayerState.UNSTARTED:
      break;
  }
}

function retryCurrentTrack(): void {
  const state = useLyrixStore.getState();
  const videoId = state.player.videoId;

  if (sharedRetryCount >= MAX_RETRIES) {
    state.setPlayerStatus("error");
    setTimeout(() => useLyrixStore.getState().advanceQueue(), 2000);
    sharedRetryCount = 0;
    return;
  }

  const delay = getBackoffDelay(sharedRetryCount);
  sharedRetryCount++;

  sharedRetryTimer = setTimeout(() => {
    if (videoId && sharedPlayer?.loadVideoById) {
      playbackMetrics.onLoadVideoById(videoId);
      sharedPlayer.loadVideoById({ videoId, startSeconds: 0 } as never);
    }
  }, delay);
}

async function retryPlaybackOnReconnect(attempt: number): Promise<void> {
  if (attempt > 4 || !sharedPlayer) return;
  await new Promise((r) => setTimeout(r, 2000));
  const ytState =
    typeof sharedPlayer.getPlayerState === "function"
      ? sharedPlayer.getPlayerState()
      : -1;
  if (ytState === YT.PlayerState.PLAYING) return;
  const delay = Math.pow(2, attempt) * 1000;
  await new Promise((r) => setTimeout(r, delay));
  sharedPlayer.playVideo();
  retryPlaybackOnReconnect(attempt + 1);
}

const SKIP_IMMEDIATELY_ERRORS = new Set([2, 100, 101, 150]);

function handleError(event: YT.OnErrorEvent): void {
  const state = useLyrixStore.getState();
  if (!state.player.videoId) return;

  if (SKIP_IMMEDIATELY_ERRORS.has(event.data)) {
    console.warn("[YT Player] Skippable error:", event.data);
  } else {
    console.error("[YT Player] Error:", event.data);
  }
  state.setPlayerStatus("error");

  const isFatal = SKIP_IMMEDIATELY_ERRORS.has(event.data);
  playbackMetrics.onPlayerError(
    state.player.videoId,
    event.data,
    sharedRetryCount,
    isFatal
  );

  if (isFatal) {
    analytics.track(EVENTS.PLAYBACK_SKIPPED, {
      video_id: state.player.videoId,
      reason: "yt_error",
      error_code: event.data,
    });
    setTimeout(() => {
      const current = useLyrixStore.getState();
      if (current.queue.next || current.queue.upcoming.length > 0) {
        current.advanceQueue();
      } else {
        current.setPlayerStatus("idle");
      }
    }, 1000);
    return;
  }

  retryCurrentTrack();
}

function startPositionPolling(): void {
  if (positionInterval) return;
  positionInterval = setInterval(() => {
    const state = useLyrixStore.getState();
    if (sharedPlayer && state.player.status === "playing") {
      const currentTime = sharedPlayer.getCurrentTime?.();
      if (typeof currentTime === "number") {
        state.setPosition(Math.floor(currentTime));
      }
      const dur = sharedPlayer.getDuration?.();
      if (typeof dur === "number" && dur > 0) {
        state.setDuration(Math.floor(dur));
      }
    }
  }, 1000);
}

export function usePlayer() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initPlayer = useCallback((container: HTMLDivElement) => {
    if (sharedInitialized || !container) return;

    loadYouTubeAPI();

    onAPIReady(() => {
      if (sharedInitialized) return;
      sharedInitialized = true;

      const playerDiv = document.createElement("div");
      playerDiv.id = "yt-player";
      container.appendChild(playerDiv);

      sharedPlayer = new window.YT.Player("yt-player", {
        height: "68",
        width: "120",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            const state = useLyrixStore.getState();
            sharedPlayer?.setVolume(state.player.volume);
            startPositionPolling();

            if (state.player.videoId && sharedPlayer?.cueVideoById) {
              sharedPlayer.cueVideoById({ videoId: state.player.videoId, startSeconds: 0 } as never);
            }
          },
          onStateChange: handleStateChange,
          onError: handleError,
        },
      });
    });
  }, []);

  useEffect(() => {
    const unsub = useLyrixStore.subscribe(
      (state) => state.player.videoId,
      (videoId, prevVideoId) => {
        if (!videoId || !sharedInitialized || !sharedPlayer) return;
        sharedRetryCount = 0;
        const wasCued = sharedCuedVideo === videoId;
        sharedCuedVideo = null;
        isFirstPlayForTrack = true;
        wasBuffering = false;

        if (prevVideoId && prevVideoId !== videoId) {
          flushSecondsPlayed();
          lastLoggedVideoId = null;
          sharedPendingSeek = null;
        }

        if (videoId === prevVideoId) {
          sharedPlayer.seekTo(0, true);
          sharedPlayer.playVideo();
          useLyrixStore.getState().setPosition(0);
          return;
        }

        const s = useLyrixStore.getState();
        const current = s.queue.current;
        if (current) {
          playbackMetrics.onTrackClicked(
            {
              videoId: current.videoId,
              title: current.title,
              channel: current.channel,
              duration: current.duration,
              category: current.category ?? "music",
              filterScore: current.filterScore ?? 0,
            },
            {
              source: s.playerContext?.type ?? "queue",
              queuePosition: 0,
              isPreloaded: wasCued,
            }
          );
        }

        const { status } = s.player;
        if (status === "paused" && sharedPlayer.cueVideoById) {
          sharedPlayer.cueVideoById({ videoId, startSeconds: 0 } as never);
        } else if (sharedPlayer.loadVideoById) {
          playbackMetrics.onLoadVideoById(videoId);
          sharedPlayer.loadVideoById({ videoId, startSeconds: 0 } as never);
        }
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useLyrixStore.subscribe(
      (state) => state.player.restartCounter,
      () => {
        if (sharedPlayer && sharedInitialized) {
          sharedPlayer.seekTo(0, true);
          sharedPlayer.playVideo();
        }
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useLyrixStore.subscribe(
      (state) => ({ next: state.queue.next, status: state.player.status, videoId: state.player.videoId }),
      ({ next, status, videoId }) => {
        if (
          next &&
          sharedInitialized &&
          status !== "playing" &&
          status !== "buffering" &&
          status !== "loading" &&
          sharedPlayer?.cueVideoById &&
          sharedCuedVideo !== next.videoId &&
          next.videoId !== videoId
        ) {
          sharedCuedVideo = next.videoId;
          sharedPlayer.cueVideoById({ videoId: next.videoId, startSeconds: 0 } as never);
        }
      },
      { equalityFn: (a, b) => a.next?.videoId === b.next?.videoId && a.status === b.status && a.videoId === b.videoId }
    );
    return unsub;
  }, []);

  useEffect(() => {
    let prevNetworkStatus = useLyrixStore.getState().network.status;
    let pausedByNetwork = false;

    const unsub = useLyrixStore.subscribe(
      (state) => state.network.status,
      (status) => {
        if (status === "offline" && prevNetworkStatus !== "offline") {
          const state = useLyrixStore.getState();
          if (state.player.status === "playing" && sharedPlayer) {
            sharedPlayer.pauseVideo();
            pausedByNetwork = true;
          }
        }

        if (prevNetworkStatus === "offline" && status === "online") {
          if (pausedByNetwork && sharedPlayer) {
            const state = useLyrixStore.getState();
            if (state.player.videoId) {
              try {
                const session = JSON.parse(
                  localStorage.getItem("lyrix_player_session") ?? "{}"
                );
                const savedPosition = session.playbackPosition ?? 0;
                if (savedPosition > 0) {
                  sharedPlayer.seekTo(savedPosition, true);
                }
              } catch {
                // fall through — play from current position
              }
              setTimeout(() => {
                sharedPlayer?.playVideo();
                retryPlaybackOnReconnect(0);
              }, 300);
            }
            pausedByNetwork = false;
          }
        }
        prevNetworkStatus = status;
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    return () => {
      if (sharedRetryTimer) clearTimeout(sharedRetryTimer);
    };
  }, []);

  const loadVideo = useCallback((videoId: string) => {
    if (sharedPlayer?.loadVideoById) {
      sharedPlayer.loadVideoById({ videoId, startSeconds: 0 } as never);
    }
  }, []);

  const cueVideo = useCallback((videoId: string) => {
    if (sharedPlayer?.cueVideoById) {
      sharedPlayer.cueVideoById({ videoId, startSeconds: 0 } as never);
    }
  }, []);

  const play = useCallback(() => {
    if (!sharedPlayer) return;
    const state = useLyrixStore.getState();
    const ytState = typeof sharedPlayer.getPlayerState === "function"
      ? sharedPlayer.getPlayerState()
      : -1;

    // -1 = unstarted, 5 = cued — video was loaded but never played
    if ((ytState === -1 || ytState === 5) && state.player.videoId) {
      sharedPlayer.loadVideoById({ videoId: state.player.videoId, startSeconds: 0 } as never);
      return;
    }
    sharedPlayer.playVideo();
  }, []);

  const pause = useCallback(() => {
    sharedPlayer?.pauseVideo();
  }, []);

  const stop = useCallback(() => {
    sharedPlayer?.stopVideo();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    sharedPlayer?.seekTo(seconds, true);
  }, []);

  const setVolume = useCallback((vol: number) => {
    sharedPlayer?.setVolume(vol);
    useLyrixStore.getState().setVolume(vol);
  }, []);

  const setPendingSeek = useCallback((seconds: number) => {
    sharedPendingSeek = seconds;
  }, []);

  const playerRef = useMemo(() => ({ current: sharedPlayer }), []);

  return {
    initPlayer,
    loadVideo,
    cueVideo,
    play,
    pause,
    stop,
    seekTo,
    setVolume,
    setPendingSeek,
    playerRef,
  };
}

import { useEffect, useState, useRef } from "react";
import { useLyrixStore, Track } from "@/store";

const SESSION_KEY = "lyrix_player_session";

interface SessionData {
  currentTrack: Track | null;
  queue: Track[];
  playbackPosition: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  playlistMode: boolean;
  history: Track[];
  lastActive: string;
}

function saveSession(data: Partial<SessionData>): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const existing: SessionData = raw
      ? JSON.parse(raw)
      : {
          currentTrack: null,
          queue: [],
          playbackPosition: 0,
          volume: 80,
          shuffle: false,
          repeat: "off" as const,
          playlistMode: false,
          history: [],
          lastActive: new Date().toISOString(),
        };

    const merged: SessionData = {
      ...existing,
      ...data,
      lastActive: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  } catch {
    // localStorage may be unavailable
  }
}

function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

function computeInitialSeek(): number | null {
  const session = loadSession();
  if (!session) return null;
  const lastActive = new Date(session.lastActive).getTime();
  if (Date.now() - lastActive > MAX_SESSION_AGE_MS) return null;
  if (session.currentTrack && session.playbackPosition > 0) {
    return session.playbackPosition;
  }
  return null;
}

export function useSession(): { pendingSeekPosition: number | null } {
  const restoredRef = useRef(false);
  const [pendingSeekPosition] = useState<number | null>(computeInitialSeek);

  const restoreSession = useLyrixStore((s) => s.restoreSession);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const session = loadSession();
    if (!session) return;

    const lastActive = new Date(session.lastActive).getTime();
    if (Date.now() - lastActive > MAX_SESSION_AGE_MS) {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
      return;
    }

    const savedQueue = session.queue ?? [];
    restoreSession({
      player: {
        videoId: session.currentTrack?.videoId ?? null,
        position: session.playbackPosition,
        volume: session.volume,
        status: session.currentTrack ? "paused" : "idle",
      },
      queue: {
        current: session.currentTrack ?? null,
        next: savedQueue[0] ?? null,
        upcoming: savedQueue.slice(1),
        shuffle: session.shuffle ?? false,
        repeat: session.repeat ?? "off",
        playlistMode: session.playlistMode ?? false,
        history: session.history ?? [],
      },
    });
  }, [restoreSession]);

  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTrackId: string | null = null;

    function flushSession(): void {
      const state = useLyrixStore.getState();
      const queue = [
        ...(state.queue.next ? [state.queue.next] : []),
        ...state.queue.upcoming,
      ];
      saveSession({
        currentTrack: state.queue.current,
        queue,
        playbackPosition: state.player.position,
        volume: state.player.volume,
        shuffle: state.queue.shuffle,
        repeat: state.queue.repeat,
        playlistMode: state.queue.playlistMode,
        history: state.queue.history,
      });
    }

    const unsubscribe = useLyrixStore.subscribe(
      (state) => ({
        currentId: state.queue.current?.videoId ?? null,
        nextId: state.queue.next?.videoId ?? null,
        upcomingLen: state.queue.upcoming.length,
        position: state.player.position,
        volume: state.player.volume,
        shuffle: state.queue.shuffle,
        repeat: state.queue.repeat,
        playlistMode: state.queue.playlistMode,
        historyLen: state.queue.history.length,
      }),
      (slice) => {
        const trackChanged = slice.currentId !== lastTrackId;
        lastTrackId = slice.currentId;

        if (trackChanged) {
          if (saveTimer) clearTimeout(saveTimer);
          flushSession();
        } else {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(flushSession, 1000);
        }
      }
    );

    const handleBeforeUnload = () => flushSession();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, []);

  return { pendingSeekPosition };
}

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Track } from "@/store";
import { useLyrixStore } from "@/store";
import * as playlistApi from "@/services/playlistApi";
import { captureError } from "@/services/telemetry";
import { analytics, EVENTS } from "@/services/analyticsService";
import { CreatePlaylistModal } from "./CreatePlaylistModal";

export interface AddToPlaylistMenuProps {
  track: Track;
  onAuthRequired: () => void;
  /** Render as submenu body (e.g. inside TrackCard overflow menu) */
  embedded?: boolean;
  onBack?: () => void;
  /** Called after a track is added to a playlist */
  onDismiss?: () => void;
}

export function AddToPlaylistMenu({
  track,
  onAuthRequired,
  embedded = false,
  onBack,
  onDismiss,
}: AddToPlaylistMenuProps) {
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const playlists = useLyrixStore((s) => s.library.playlists);
  const bumpPlaylistTrackCount = useLyrixStore((s) => s.bumpPlaylistTrackCount);

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedded || !open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, embedded]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [feedback]);

  async function addTo(playlistId: string, name: string) {
    try {
      await playlistApi.addTrackToPlaylist(
        playlistId,
        track,
        track.filterScore ?? 0
      );
      bumpPlaylistTrackCount(playlistId);
      setFeedback(`Added to ${name}`);
      analytics.track(EVENTS.PLAYLIST_TRACK_ADDED, {
        playlist_id: playlistId,
        video_id: track.videoId,
      });
      setOpen(false);
      onDismiss?.();
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)));
      setFeedback(
        err instanceof Error ? err.message : "Could not add to playlist"
      );
    }
  }

  function toggle() {
    if (!isLoggedIn) {
      onAuthRequired();
      return;
    }
    setOpen((v) => !v);
  }

  const panelClasses = embedded
    ? "w-full py-1"
    : "absolute right-0 z-40 mt-1 w-[min(calc(100vw-2rem),280px)] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

  function panelContent() {
    return (
      <div className={panelClasses} role="listbox" aria-label="Your playlists">
        {embedded && onBack ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span aria-hidden="true">←</span> Back
          </button>
        ) : null}
        <ul className="max-h-52 overflow-y-auto">
          {playlists.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              No playlists yet
            </li>
          )}
          {playlists.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={(e) => {
                  e.stopPropagation();
                  void addTo(p.id, p.name);
                }}
              >
                <span className="truncate pr-2">{p.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                  {p.trackCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            className="w-full px-3 py-2.5 text-left text-sm font-medium text-purple-600 hover:bg-zinc-50 dark:text-purple-400 dark:hover:bg-zinc-800"
            onClick={(e) => {
              e.stopPropagation();
              if (!embedded) setOpen(false);
              setCreateOpen(true);
            }}
          >
            Create new playlist
          </button>
        </div>
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="relative w-full">
        {panelContent()}
        {feedback ? (
          <p
            className="px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400"
            role="status"
            aria-live="polite"
          >
            {feedback}
          </p>
        ) : null}
        <CreatePlaylistModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(playlist) => void addTo(playlist.id, playlist.name)}
        />
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className="flex min-h-10 min-w-10 touch-manipulation items-center justify-center rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Add to playlist"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {panelContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {feedback && (
        <p
          className="absolute right-0 top-full z-30 mt-1 max-w-[220px] rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900"
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      )}

      <CreatePlaylistModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(playlist) => void addTo(playlist.id, playlist.name)}
      />
    </div>
  );
}

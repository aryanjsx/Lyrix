import { useCallback, useState } from "react";
import type { Track } from "@/store";
import { useLyrixStore } from "@/store";
import * as playlistApi from "@/services/playlistApi";
import { captureError } from "@/services/telemetry";
import { analytics, EVENTS } from "@/services/analyticsService";
import { GuestModal } from "@/components/ui/GuestModal";

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-red-500"
        aria-hidden
      >
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17l-.022.012-.007.003-.003.001a.751.751 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
      aria-hidden
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5A5.5 5.5 0 0 0 16.5 3c-1.73 0-3 .5-4.5 2Z" />
    </svg>
  );
}

export interface SaveButtonProps {
  track: Track;
  onAuthRequired?: () => void;
}

export function SaveButton({ track, onAuthRequired }: SaveButtonProps) {
  const [guestOpen, setGuestOpen] = useState(false);
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const isSaved = useLyrixStore((s) =>
    s.library.savedTrackIds.has(track.videoId)
  );
  const addSavedTrack = useLyrixStore((s) => s.addSavedTrack);
  const removeSavedTrack = useLyrixStore((s) => s.removeSavedTrack);
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(
    async (e: React.MouseEvent | React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoggedIn) {
        onAuthRequired?.();
        setGuestOpen(true);
        return;
      }
      if (busy) return;
      setBusy(true);
      try {
        if (isSaved) {
          removeSavedTrack(track.videoId);
          try {
            await playlistApi.unsaveTrackFromLibrary(track.videoId);
            analytics.track(EVENTS.TRACK_UNLIKED, { video_id: track.videoId });
          } catch (err) {
            addSavedTrack({
              videoId: track.videoId,
              savedAt: new Date().toISOString(),
              title: track.title,
              channel: track.channel,
              duration: track.duration,
              thumbnail: track.thumbnail,
              category: track.category,
              filterScore: track.filterScore ?? 0,
            });
            captureError(err instanceof Error ? err : new Error(String(err)));
          }
        } else {
          const savedItem = {
            videoId: track.videoId,
            savedAt: new Date().toISOString(),
            title: track.title,
            channel: track.channel,
            duration: track.duration,
            thumbnail: track.thumbnail,
            category: track.category,
            filterScore: track.filterScore ?? 0,
          };
          addSavedTrack(savedItem);
          try {
            await playlistApi.saveTrackToLibrary(
              track,
              track.filterScore ?? 0
            );
            analytics.track(EVENTS.TRACK_LIKED, { video_id: track.videoId });
          } catch (err) {
            removeSavedTrack(track.videoId);
            captureError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [
      isLoggedIn,
      isSaved,
      busy,
      onAuthRequired,
      track,
      addSavedTrack,
      removeSavedTrack,
    ]
  );

  const label = isSaved ? "Remove from saved" : "Save track";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label={label}
        aria-pressed={isSaved}
        className="group flex min-h-11 min-w-11 flex-shrink-0 touch-manipulation items-center justify-center rounded-full p-2.5 text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-red-400"
      >
        <HeartIcon filled={isSaved} />
      </button>
      <GuestModal open={guestOpen} onOpenChange={setGuestOpen} />
    </>
  );
}

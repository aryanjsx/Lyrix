import { useEffect, useState, useCallback } from "react";
import { useLyrixStore } from "@/store";
import { usePlayer } from "@/hooks/usePlayer";
import { toast } from "@/components/ui/Toast";

const SEEK_STEP = 10;
const VOLUME_STEP = 5;

export function useKeyboardShortcuts() {
  const { play, pause, seekTo, setVolume } = usePlayer();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const toggleShortcuts = useCallback(() => {
    setShowShortcuts((prev) => !prev);
  }, []);

  const closeShortcuts = useCallback(() => {
    setShowShortcuts(false);
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target.isContentEditable) {
        return;
      }

      const state = useLyrixStore.getState();
      const { status, position, duration, volume } = state.player;

      switch (e.key) {
        case " ":
          if (status === "idle") return;
          e.preventDefault();
          if (status === "playing") pause();
          else play();
          break;
        case "ArrowLeft":
          if (status === "idle") return;
          e.preventDefault();
          seekTo(Math.max(0, position - SEEK_STEP));
          break;
        case "ArrowRight":
          if (status === "idle") return;
          e.preventDefault();
          seekTo(Math.min(duration, position + SEEK_STEP));
          break;
        case "ArrowUp":
          if (status === "idle") return;
          e.preventDefault();
          setVolume(Math.min(100, volume + VOLUME_STEP));
          break;
        case "ArrowDown":
          if (status === "idle") return;
          e.preventDefault();
          setVolume(Math.max(0, volume - VOLUME_STEP));
          break;
        case "m":
        case "M":
          if (status === "idle") return;
          e.preventDefault();
          if (volume === 0) {
            setVolume(70);
            toast("Unmuted", "info");
          } else {
            setVolume(0);
            toast("Muted", "info");
          }
          break;
        case "l":
        case "L": {
          if (status === "idle") return;
          e.preventDefault();
          const current = state.queue.current;
          if (!current) break;
          const isLiked = state.library.savedTrackIds.has(current.videoId);
          if (isLiked) {
            useLyrixStore.getState().removeSavedTrack(current.videoId);
            useLyrixStore.getState().unsaveTrackFromLibrary(current.videoId).catch(() => {});
            toast("Removed from liked songs", "info");
          } else {
            useLyrixStore.getState().addSavedTrack({
              videoId: current.videoId,
              savedAt: new Date().toISOString(),
              title: current.title,
              channel: current.channel,
              duration: current.duration,
              thumbnail: current.thumbnail,
              category: current.category,
              filterScore: current.filterScore ?? 0,
            });
            useLyrixStore.getState().saveTrackToLibrary(current).catch(() => {});
            toast("Added to liked songs", "success");
          }
          break;
        }
        case "?":
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
          break;
        case "Escape":
          setShowShortcuts(false);
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [play, pause, seekTo, setVolume]);

  return { showShortcuts, toggleShortcuts, closeShortcuts };
}

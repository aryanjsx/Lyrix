import { motion, AnimatePresence } from "framer-motion";
import { useLyrixStore } from "@/store";
import {
  saveTrackToLibrary as apiSaveTrack,
  unsaveTrackFromLibrary as apiUnsaveTrack,
} from "@/services/playlistApi";
import { ArtistLink } from "@/components/ui/ArtistLink";

function PlaybackModeToggle() {
  const mode = useLyrixStore((s) => s.player.mode);
  const toggle = useLyrixStore((s) => s.togglePlaybackMode);

  return (
    <div
      className="inline-flex rounded-full p-[3px]"
      style={{ background: "var(--np-bg-elevated)", border: "1px solid var(--np-border)" }}
    >
      <button
        type="button"
        onClick={() => { if (mode !== "audio") toggle(); }}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-150"
        style={{
          background: mode === "audio" ? "var(--np-accent)" : "transparent",
          color: mode === "audio" ? "#fff" : "var(--np-text-secondary)",
          fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        Audio
      </button>
      <button
        type="button"
        onClick={() => { if (mode !== "video") toggle(); }}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-150"
        style={{
          background: mode === "video" ? "var(--np-accent)" : "transparent",
          color: mode === "video" ? "#fff" : "var(--np-text-secondary)",
          fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        Video
      </button>
    </div>
  );
}

function stripDurationFromChannel(channel: string): string {
  const parts = channel.split(" • ");
  if (parts.length > 1 && /^\d{1,2}:\d{2}(:\d{2})?$/.test(parts[parts.length - 1].trim())) {
    return parts.slice(0, -1).join(" • ");
  }
  return channel;
}

export function TrackInfo() {
  const current = useLyrixStore((s) => s.queue.current);
  const isSaved = useLyrixStore((s) =>
    current ? s.library.savedTrackIds.has(current.videoId) : false
  );
  const addSavedTrack = useLyrixStore((s) => s.addSavedTrack);
  const removeSavedTrack = useLyrixStore((s) => s.removeSavedTrack);

  const toggleSave = () => {
    if (!current) return;
    if (isSaved) {
      removeSavedTrack(current.videoId);
      apiUnsaveTrack(current.videoId).catch(() => {});
    } else {
      addSavedTrack({
        videoId: current.videoId,
        savedAt: new Date().toISOString(),
        title: current.title,
        channel: current.channel,
        duration: current.duration,
        thumbnail: current.thumbnail,
        category: current.category,
        filterScore: current.filterScore ?? 0,
      });
      apiSaveTrack(current, current.filterScore ?? 0).catch(() => {});
    }
  };

  return (
    <div className="mt-6 w-full text-center">
      {/* Song Title */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={current?.videoId ?? "none"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="line-clamp-2 text-[28px] font-bold leading-tight"
          style={{
            fontFamily: "var(--font-playfair, 'Playfair Display'), serif",
            color: "var(--np-text-primary)",
          }}
        >
          {current?.title ?? "Nothing playing"}
        </motion.h1>
      </AnimatePresence>

      {/* Artist + Album */}
      <p className="mt-2 text-sm" style={{ fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif" }}>
        {current?.channel ? (
          <ArtistLink
            name={stripDurationFromChannel(current.channel)}
            className="cursor-pointer"
            style={{ color: "var(--np-text-secondary)" }}
          />
        ) : (
          <span style={{ color: "var(--np-text-secondary)" }}>&nbsp;</span>
        )}
      </p>

      {/* Action Row */}
      <div className="mt-4 flex items-center justify-center gap-4">
        {/* Heart/Like */}
        <motion.button
          onClick={toggleSave}
          whileTap={{ scale: 0.85 }}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{ color: isSaved ? "#ef4444" : "var(--np-text-muted)" }}
          aria-label={isSaved ? "Remove from saved" : "Save track"}
        >
          <AnimatePresence mode="wait">
            <motion.svg
              key={isSaved ? "filled" : "outline"}
              initial={{ scale: 0 }}
              animate={{ scale: isSaved ? [1.4, 1] : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              width="20" height="20" viewBox="0 0 24 24"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </motion.svg>
          </AnimatePresence>
        </motion.button>

        {/* Audio/Video Toggle */}
        <PlaybackModeToggle />

        {/* External Link */}
        {current && (
          <motion.a
            href={`https://www.youtube.com/watch?v=${current.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--np-text-muted)" }}
            aria-label="Open on YouTube"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </motion.a>
        )}
      </div>
    </div>
  );
}

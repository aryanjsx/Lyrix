import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useLyrixStore } from "@/store";
import { radioService } from "@/services/radioService";
import { usePlayer } from "@/hooks/usePlayer";
import { useAlbumColors } from "@/hooks/useAlbumColors";
import { shareService } from "@/services/shareService";
import { motion, AnimatePresence } from "framer-motion";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { formatDuration } from "@/utils/format";

function stripDurationFromChannel(channel: string): string {
  const parts = channel.split(" \u2022 ");
  if (parts.length > 1 && /^\d{1,2}:\d{2}(:\d{2})?$/.test(parts[parts.length - 1].trim())) {
    return parts.slice(0, -1).join(" \u2022 ");
  }
  return channel;
}

function ProgressStrip() {
  const position = useLyrixStore((s) => s.player.position);
  const duration = useLyrixStore((s) => s.player.duration);
  const { seekTo } = usePlayer();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? (position / duration) * 100 : 0;

  const seekFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current || duration <= 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(fraction * duration);
    },
    [duration, seekTo]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      seekFromEvent(e.clientX);
      const onMove = (me: MouseEvent) => seekFromEvent(me.clientX);
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekFromEvent]
  );

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute left-0 right-0 top-[-1px] z-10 cursor-pointer"
      style={{ height: hovered || dragging ? 4 : 2, transition: "height 150ms ease" }}
      role="slider"
      aria-label="Seek"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      tabIndex={0}
    >
      {/* Track background */}
      <div className="absolute inset-0" style={{ background: "var(--player-border)" }} />
      {/* Fill */}
      <div
        className="absolute left-0 top-0 h-full"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, var(--track-color), var(--accent))`,
          transition: dragging ? "none" : "width 300ms linear",
        }}
      />
      {/* Scrubber dot */}
      {(hovered || dragging) && (
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${pct}%`,
            transform: `translate(-50%, -50%)`,
            width: 10,
            height: 10,
            background: "var(--accent)",
            boxShadow: "0 0 6px var(--accent-glow)",
          }}
        />
      )}
    </div>
  );
}

function MiniControls() {
  const player = useLyrixStore((s) => s.player);
  const advanceQueue = useLyrixStore((s) => s.advanceQueue);
  const previousTrack = useLyrixStore((s) => s.previousTrack);
  const shuffle = useLyrixStore((s) => s.queue.shuffle);
  const repeat = useLyrixStore((s) => s.queue.repeat);
  const toggleShuffle = useLyrixStore((s) => s.toggleShuffle);
  const cycleRepeat = useLyrixStore((s) => s.cycleRepeat);
  const { play, pause } = usePlayer();

  const isPlaying = player.status === "playing";
  const isBuffering = player.status === "buffering";
  const isIdle = player.status === "idle";

  return (
    <div className="flex items-center gap-2">
      {/* Shuffle */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        onClick={(e) => { e.stopPropagation(); toggleShuffle(); }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ color: shuffle ? "var(--accent)" : "var(--text-muted)" }}
        aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
        {shuffle && (
          <span className="absolute -bottom-0.5 h-1 w-1 rounded-full" style={{ background: "var(--accent)" }} />
        )}
      </motion.button>

      {/* Previous */}
      <motion.button
        type="button"
        whileHover={{ background: "var(--nav-hover-bg)" }}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => { e.stopPropagation(); previousTrack(); }}
        disabled={isIdle}
        className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
        style={{ color: "var(--text-secondary)" }}
        aria-label="Previous track"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="19,20 9,12 19,4" />
          <rect x="4" y="4" width="3" height="16" rx="1" />
        </svg>
      </motion.button>

      {/* Play/Pause */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }}
        disabled={isIdle}
        className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40"
        style={{
          background: "var(--text-primary)",
          color: "#08080c",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4), 0 0 12px var(--track-glow)",
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isBuffering ? (
          <svg className="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </motion.button>

      {/* Next */}
      <motion.button
        type="button"
        whileHover={{ background: "var(--nav-hover-bg)" }}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => { e.stopPropagation(); advanceQueue(); }}
        disabled={isIdle}
        className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
        style={{ color: "var(--text-secondary)" }}
        aria-label="Next track"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,4 15,12 5,20" />
          <rect x="17" y="4" width="3" height="16" rx="1" />
        </svg>
      </motion.button>

      {/* Repeat */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        onClick={(e) => { e.stopPropagation(); cycleRepeat(); }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ color: repeat !== "off" ? "var(--accent)" : "var(--text-muted)" }}
        aria-label={repeat === "off" ? "Enable repeat" : repeat === "all" ? "Repeat one" : "Disable repeat"}
      >
        <div className="relative flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {repeat === "one" && (
            <span className="absolute text-[7px] font-bold" style={{ color: "var(--accent)" }}>1</span>
          )}
        </div>
        {repeat !== "off" && (
          <span className="absolute -bottom-0.5 h-1 w-1 rounded-full" style={{ background: "var(--accent)" }} />
        )}
      </motion.button>
    </div>
  );
}

function VolumeSlider() {
  const volume = useLyrixStore((s) => s.player.volume);
  const { setVolume } = usePlayer();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(Math.round(pct * 100));
  };

  const isMuted = volume === 0;

  return (
    <div className="hidden items-center gap-2.5 lg:flex">
      <button
        type="button"
        onClick={() => setVolume(isMuted ? 70 : 0)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/[0.06]"
        style={{ color: "var(--text-secondary)" }}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            {volume > 50 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
          </svg>
        )}
      </button>
      <div
        onClick={handleClick}
        className="relative h-[3px] cursor-pointer rounded-full"
        style={{ width: 90, background: "var(--nav-border)" }}
        role="slider"
        aria-label="Volume"
        aria-valuenow={volume}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${volume}%`, background: "var(--accent)", pointerEvents: "none" }}
        />
        <div
          className="absolute top-1/2 rounded-full transition-transform hover:scale-[1.3]"
          style={{
            left: `${volume}%`,
            transform: `translate(-50%, -50%)`,
            width: 10,
            height: 10,
            background: "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}

export function MiniPlayer() {
  const router = useRouter();
  const current = useLyrixStore((s) => s.queue.current);
  const status = useLyrixStore((s) => s.player.status);
  const position = useLyrixStore((s) => s.player.position);
  const duration = useLyrixStore((s) => s.player.duration);
  const isSaved = useLyrixStore((s) =>
    current ? s.library.savedTrackIds.has(current.videoId) : false
  );
  const saveTrack = useLyrixStore((s) => s.saveTrackToLibrary);
  const unsaveTrack = useLyrixStore((s) => s.unsaveTrackFromLibrary);
  const dismissPlayer = useLyrixStore((s) => s.dismissPlayer);
  const advanceQueue = useLyrixStore((s) => s.advanceQueue);
  const previousTrack = useLyrixStore((s) => s.previousTrack);
  const { stop, play, pause } = usePlayer();

  useAlbumColors(current?.thumbnail ?? null);

  const isNowPlaying = router.pathname === "/now-playing";
  const visible = (status !== "idle" || current !== null) && !isNowPlaying;
  const isPlaying = status === "playing";

  const goToNowPlaying = () => router.push("/now-playing");

  const handleDismiss = () => {
    stop();
    dismissPlayer();
  };

  const addSavedTrack = useLyrixStore((s) => s.addSavedTrack);
  const removeSavedTrack = useLyrixStore((s) => s.removeSavedTrack);

  const toggleSave = () => {
    if (!current) return;
    if (isSaved) {
      removeSavedTrack(current.videoId);
      unsaveTrack(current.videoId).catch(() => {});
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
      saveTrack(current).catch(() => {});
    }
  };

  useEffect(() => {
    if (visible) {
      document.documentElement.style.setProperty("--player-height", "72px");
    } else {
      document.documentElement.style.setProperty("--player-height", "0px");
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <>
        <motion.div
          initial={{ y: 72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 72, opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[90] hidden sm:block"
          style={{
            height: 72,
            background: "var(--player-bg)",
            backdropFilter: "blur(32px) saturate(200%)",
            WebkitBackdropFilter: "blur(32px) saturate(200%)",
            borderTop: "1px solid var(--player-border)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.5), 0 -1px 0 rgba(255,255,255,0.03)",
          }}
          role="region"
          aria-label="Now Playing"
        >
          <ProgressStrip />

          {/* Three-column layout */}
          <div className="mx-auto flex h-full max-w-[1920px] items-center px-4">
            {/* LEFT — Track Info (35%) */}
            <div className="flex w-[35%] items-center gap-3 overflow-hidden">
              {/* Thumbnail */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={current?.videoId ?? "empty"}
                  initial={{ scale: 0.85, rotate: -2 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative flex-shrink-0 overflow-hidden rounded-lg"
                  style={{
                    width: 46,
                    height: 46,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
                    animation: isPlaying ? "mp-breathe 6s ease-in-out infinite" : "none",
                    filter: isPlaying ? "saturate(1)" : "saturate(0.7)",
                  }}
                >
                  {current?.thumbnail ? (
                    <TrackThumbnail
                      src={current.thumbnail}
                      alt={current.title}
                      fill
                      sizes="46px"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-800" />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={current?.videoId ?? "none"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="truncate text-sm font-semibold"
                    style={{
                      fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                      color: "var(--text-primary)",
                    }}
                  >
                    {current?.title ?? "No track"}
                  </motion.p>
                </AnimatePresence>
                {radioService.isActive() && (
                  <div className="flex items-center gap-1 text-[10px] text-purple-400/70">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" /><circle cx="12" cy="12" r="1" />
                    </svg>
                    <span className="truncate">{radioService.getActive()?.seedLabel} Radio</span>
                  </div>
                )}
                {current?.channel ? (
                  <Link
                    href={`/artist/${encodeURIComponent(current.channel)}`}
                    className="truncate text-xs hover:underline block"
                    style={{
                      fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                      color: "var(--text-secondary)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {stripDurationFromChannel(current.channel)}
                  </Link>
                ) : (
                  <p
                    className="truncate text-xs"
                    style={{
                      fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                      color: "var(--text-secondary)",
                    }}
                  >
                    &nbsp;
                  </p>
                )}
              </div>

            </div>

            {/* CENTER — Controls (30%) */}
            <div className="flex w-[30%] flex-col items-center justify-center">
              <div className="flex items-center gap-1">
                {/* Heart — next to shuffle */}
                <motion.button
                  onClick={(e) => { e.stopPropagation(); void toggleSave(); }}
                  whileTap={{ scale: 0.85 }}
                  className="hidden flex-shrink-0 items-center justify-center rounded-lg md:flex"
                  style={{ color: isSaved ? "#ef4444" : "var(--text-muted)", width: 32, height: 32 }}
                  aria-label={isSaved ? "Remove from saved" : "Save track"}
                >
                  <AnimatePresence mode="wait">
                    <motion.svg
                      key={isSaved ? "filled" : "outline"}
                      initial={{ scale: 0 }}
                      animate={{ scale: isSaved ? [1.4, 1] : 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      width="16" height="16" viewBox="0 0 24 24"
                      fill={isSaved ? "currentColor" : "none"}
                      stroke="currentColor" strokeWidth="1.8"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </motion.svg>
                  </AnimatePresence>
                </motion.button>
                <MiniControls />
              </div>
              <span
                className="mt-0.5 text-[10px] tracking-[0.05em]"
                style={{
                  fontFamily: "var(--font-dm-mono, 'DM Mono'), monospace",
                  color: "var(--text-muted)",
                }}
              >
                {formatDuration(position)}&nbsp;/&nbsp;{formatDuration(duration)}
              </span>
            </div>

            {/* RIGHT — Extras (35%) */}
            <div className="flex w-[35%] items-center justify-end gap-3">
              {/* Share */}
              <motion.button
                type="button"
                whileHover={{ background: "var(--nav-hover-bg)" }}
                whileTap={{ scale: 0.85 }}
                onClick={() => {
                  if (!current) return;
                  void shareService.share({
                    videoId: current.videoId,
                    title: current.title,
                    channel: current.channel,
                  });
                }}
                className="hidden h-8 w-8 items-center justify-center rounded-lg md:flex"
                style={{ color: "var(--text-muted)" }}
                aria-label="Share track"
                title="Share"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </motion.button>
              <VolumeSlider />

              {/* Expand */}
              <motion.button
                type="button"
                whileHover={{ background: "var(--nav-hover-bg)" }}
                onClick={goToNowPlaying}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ color: "var(--text-muted)" }}
                aria-label="Open full player"
                title="Open full player"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </motion.button>

              {/* Close */}
              <motion.button
                type="button"
                whileHover={{ background: "rgba(255,255,255,0.06)" }}
                onClick={handleDismiss}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ color: "var(--text-muted)" }}
                aria-label="Dismiss player"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* MOBILE MINI PLAYER */}
        <motion.div
          initial={{ y: 64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 64, opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
            if (info.offset.x < -60) advanceQueue();
            if (info.offset.x > 60) previousTrack();
          }}
          className="fixed left-0 right-0 z-[91] sm:hidden"
          style={{
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
            height: 64,
            background: "var(--player-bg)",
            backdropFilter: "blur(32px) saturate(200%)",
            WebkitBackdropFilter: "blur(32px) saturate(200%)",
            borderTop: "1px solid var(--player-border)",
            boxShadow: "0 -2px 16px rgba(0,0,0,0.4)",
          }}
          role="region"
          aria-label="Now Playing"
        >
          <ProgressStrip />

          <div className="flex h-full items-center gap-3 px-3">
            {/* Thumbnail — tap opens full player */}
            <div
              className="relative h-11 w-11 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
              onClick={goToNowPlaying}
              style={{
                animation: isPlaying ? "mp-breathe 6s ease-in-out infinite" : "none",
              }}
            >
              {current?.thumbnail ? (
                <TrackThumbnail
                  src={current.thumbnail}
                  alt={current.title}
                  fill
                  sizes="44px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div className="h-full w-full bg-zinc-800" />
              )}
            </div>

            {/* Text — tap opens full player */}
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={goToNowPlaying}
            >
              <p
                className="truncate text-sm font-semibold"
                style={{
                  fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                  color: "var(--text-primary)",
                }}
              >
                {current?.title ?? "No track"}
              </p>
              {radioService.isActive() ? (
                <div className="flex items-center gap-1 text-[10px] text-purple-400/70">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" /><circle cx="12" cy="12" r="1" />
                  </svg>
                  <span className="truncate">{radioService.getActive()?.seedLabel} Radio</span>
                </div>
              ) : (
                <p
                  className="truncate text-xs"
                  style={{
                    fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                    color: "var(--text-secondary)",
                  }}
                >
                  {stripDurationFromChannel(current?.channel ?? "")}
                </p>
              )}
            </div>

            {/* Heart */}
            <motion.button
              onClick={(e) => { e.stopPropagation(); void toggleSave(); }}
              whileTap={{ scale: 0.85 }}
              className="flex-shrink-0"
              style={{ color: isSaved ? "#ef4444" : "var(--text-muted)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label={isSaved ? "Remove from saved" : "Save track"}
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1.8"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </motion.button>

            {/* Play/Pause */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={(e) => { e.stopPropagation(); void (isPlaying ? pause() : play()); }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: "var(--text-primary)",
                color: "#08080c",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              )}
            </motion.button>

            {/* Next */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); advanceQueue(); }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Next track"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,4 15,12 5,20" />
                <rect x="17" y="4" width="3" height="16" rx="1" />
              </svg>
            </motion.button>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

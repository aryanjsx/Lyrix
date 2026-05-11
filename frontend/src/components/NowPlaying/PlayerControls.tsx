import { useRef, useState, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { motion } from "framer-motion";
import { useLyrixStore } from "@/store";
import { usePlayer } from "@/hooks/usePlayer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ProgressBar() {
  const position = useLyrixStore((s) => s.player.position);
  const duration = useLyrixStore((s) => s.player.duration);
  const { seekTo } = usePlayer();
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? (position / duration) * 100 : 0;

  const getPositionFromEvent = useCallback(
    (e: ReactMouseEvent<Element> | globalThis.MouseEvent) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      const fraction = getPositionFromEvent(e);
      seekTo(fraction * duration);

      const onMove = (me: globalThis.MouseEvent) => {
        const f = getPositionFromEvent(me);
        seekTo(f * duration);
      };
      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [duration, seekTo, getPositionFromEvent]
  );

  return (
    <div className="mb-5 w-full">
      <div className="flex items-center gap-3">
        <span
          className="w-10 text-right text-[11px]"
          style={{ fontFamily: "var(--font-dm-mono, 'DM Mono'), monospace", color: "var(--np-text-muted)" }}
        >
          {formatTime(position)}
        </span>
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          role="slider"
          aria-label="Seek position"
          aria-valuenow={Math.round(position)}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          tabIndex={0}
          className={`np-progress-track relative flex-1 cursor-pointer rounded-full ${isDragging ? "dragging" : ""}`}
          style={{ background: "var(--np-border)" }}
        >
          <div
            className="relative h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, var(--np-accent), var(--np-dynamic-color, var(--np-accent)))`,
              transition: isDragging ? "none" : "width 300ms linear",
              pointerEvents: "none",
            }}
          >
            <div
              className="np-progress-thumb absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full"
              style={{
                background: `linear-gradient(135deg, var(--np-accent), var(--np-dynamic-color, var(--np-accent)))`,
                boxShadow: "0 0 8px var(--np-accent-glow)",
              }}
            />
          </div>
        </div>
        <span
          className="w-10 text-[11px]"
          style={{ fontFamily: "var(--font-dm-mono, 'DM Mono'), monospace", color: "var(--np-text-muted)" }}
        >
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

function ControlsRow() {
  const status = useLyrixStore((s) => s.player.status);
  const advanceQueue = useLyrixStore((s) => s.advanceQueue);
  const previousTrack = useLyrixStore((s) => s.previousTrack);
  const shuffle = useLyrixStore((s) => s.queue.shuffle);
  const repeat = useLyrixStore((s) => s.queue.repeat);
  const toggleShuffle = useLyrixStore((s) => s.toggleShuffle);
  const cycleRepeat = useLyrixStore((s) => s.cycleRepeat);
  const { play, pause } = usePlayer();

  const isPlaying = status === "playing";
  const isBuffering = status === "buffering";

  return (
    <div className="flex items-center justify-center gap-6">
      {/* Shuffle */}
      <motion.button
        onClick={toggleShuffle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
        className="relative flex flex-col items-center"
        style={{ color: shuffle ? "var(--np-accent)" : "var(--np-text-secondary)" }}
        aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
        {shuffle && (
          <span className="absolute -bottom-2 h-1 w-1 rounded-full" style={{ background: "var(--np-accent)" }} />
        )}
      </motion.button>

      {/* Previous */}
      <motion.button
        onClick={previousTrack}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.15 }}
        className="flex items-center justify-center"
        style={{ color: "var(--np-text-secondary)" }}
        aria-label="Previous track"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="19,20 9,12 19,4" />
          <rect x="4" y="4" width="3" height="16" rx="1" />
        </svg>
      </motion.button>

      {/* Play/Pause */}
      <motion.button
        onClick={() => isPlaying ? pause() : play()}
        whileHover={{ scale: 1.05, background: "var(--np-accent)" }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "var(--np-text-primary)",
          color: "var(--np-bg-primary)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 20px var(--np-accent-glow)",
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isBuffering ? (
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : isPlaying ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </motion.button>

      {/* Next */}
      <motion.button
        onClick={advanceQueue}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.15 }}
        className="flex items-center justify-center"
        style={{ color: "var(--np-text-secondary)" }}
        aria-label="Next track"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,4 15,12 5,20" />
          <rect x="17" y="4" width="3" height="16" rx="1" />
        </svg>
      </motion.button>

      {/* Repeat */}
      <motion.button
        onClick={cycleRepeat}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
        className="relative flex flex-col items-center"
        style={{ color: repeat !== "off" ? "var(--np-accent)" : "var(--np-text-secondary)" }}
        aria-label={repeat === "off" ? "Enable repeat" : repeat === "all" ? "Repeat one" : "Disable repeat"}
      >
        <div className="relative flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {repeat === "one" && (
            <span className="absolute text-[8px] font-bold" style={{ color: "var(--np-accent)" }}>1</span>
          )}
        </div>
        {repeat !== "off" && (
          <span className="absolute -bottom-2 h-1 w-1 rounded-full" style={{ background: "var(--np-accent)" }} />
        )}
      </motion.button>
    </div>
  );
}

function VolumeRow() {
  const volume = useLyrixStore((s) => s.player.volume);
  const { setVolume } = usePlayer();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const applyVolume = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(Math.round(pct * 100));
  }, [setVolume]);

  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    applyVolume(e.clientX);
    setDragging(true);

    const onMove = (ev: MouseEvent) => applyVolume(ev.clientX);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [applyVolume]);

  const active = hovered || dragging;

  const handleMuteToggle = useCallback(() => {
    setVolume(volume > 0 ? 0 : 80);
  }, [volume, setVolume]);

  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={handleMuteToggle}
        className="transition-opacity hover:opacity-100"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
        aria-label={volume > 0 ? "Mute" : "Unmute"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "var(--np-text-secondary)" : "var(--np-text-muted)", transition: "color 0.15s" }}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          {volume === 0
            ? <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
            : <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          }
        </svg>
      </button>

      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="slider"
        aria-label="Volume"
        aria-valuenow={volume}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        className="relative cursor-pointer rounded-full transition-all duration-150"
        style={{
          width: 200,
          height: active ? 6 : 3,
          background: "var(--np-border)",
        }}
      >
        <div
          className="h-full rounded-full transition-colors duration-150"
          style={{
            width: `${volume}%`,
            background: active ? "white" : "var(--np-text-secondary)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150"
          style={{
            left: `${volume}%`,
            width: active ? 12 : 0,
            height: active ? 12 : 0,
            marginLeft: active ? -6 : 0,
            background: "white",
            boxShadow: active ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
          }}
        />
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "var(--np-text-secondary)" : "var(--np-text-muted)", transition: "color 0.15s", flexShrink: 0 }}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    </div>
  );
}

export function PlayerControls() {
  return (
    <div className="w-full">
      <ProgressBar />
      <ControlsRow />
      <VolumeRow />
    </div>
  );
}

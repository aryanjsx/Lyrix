import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/router";
import { usePlayer } from "@/hooks/usePlayer";
import { useLyrixStore } from "@/store";

export function PersistentPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { initPlayer } = usePlayer();
  const router = useRouter();
  const mode = useLyrixStore((s) => s.player.mode);
  const isNowPlaying = router.pathname === "/now-playing";
  const showVideo = mode === "video" && isNowPlaying;

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      initPlayer(containerRef.current);
    }
  }, [initPlayer]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === containerRef.current;
      setIsFullscreen(active);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const syncRect = useCallback(() => {
    const el = document.getElementById("yt-video-target");
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, []);

  useEffect(() => {
    if (!showVideo) {
      const id = requestAnimationFrame(() => setTargetRect(null));
      return () => cancelAnimationFrame(id);
    }

    const el = document.getElementById("yt-video-target");
    if (!el) return;

    const ro = new ResizeObserver(() => syncRect());
    ro.observe(el);
    window.addEventListener("resize", syncRect, { passive: true });

    const rafId = requestAnimationFrame(() => syncRect());

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", syncRect);
    };
  }, [showVideo, syncRect]);

  useEffect(() => {
    const iframe = containerRef.current?.querySelector("iframe");
    if (!iframe) return;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
  }, [showVideo, targetRect, isFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, exitFullscreen]);

  const isVideoVisible = showVideo && targetRect;

  const style: React.CSSProperties = isFullscreen
    ? {
        width: "100%",
        height: "100%",
        background: "#000",
        overflow: "hidden",
        zIndex: 9999,
      }
    : isVideoVisible
      ? {
          position: "fixed",
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          zIndex: 50,
          borderRadius: 16,
          overflow: "hidden",
          transition: "opacity 200ms ease",
          opacity: 1,
        }
      : {
          position: "fixed",
          bottom: 0,
          left: 0,
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        };

  return (
    <>
      <div ref={containerRef} id="yt-player-container" style={style}>
        {isFullscreen && (
          <button
            onClick={exitFullscreen}
            aria-label="Exit fullscreen"
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              zIndex: 10000,
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 10,
              color: "#fff",
              padding: "10px 12px",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              transition: "background 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.6)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
            Exit
          </button>
        )}
      </div>
      {isVideoVisible && !isFullscreen && (
        <div
          className="yt-click-shield"
          style={{
            position: "fixed",
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            zIndex: 51,
            borderRadius: 16,
          }}
        />
      )}
    </>
  );
}

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

  useEffect(() => {
    if (containerRef.current) {
      initPlayer(containerRef.current);
    }
  }, [initPlayer]);

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
  }, [showVideo, targetRect]);

  const isVideoVisible = showVideo && targetRect;

  const style: React.CSSProperties = isVideoVisible
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
      <div ref={containerRef} style={style} />
      {isVideoVisible && (
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

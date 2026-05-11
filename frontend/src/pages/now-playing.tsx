import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from "framer-motion";
import { useLyrixStore } from "@/store";
import { useAlbumColors } from "@/hooks/useAlbumColors";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AlbumArt } from "@/components/NowPlaying/AlbumArt";
import { TrackInfo } from "@/components/NowPlaying/TrackInfo";
import { PlayerControls } from "@/components/NowPlaying/PlayerControls";
import { RightPanel, MobileRightPanel } from "@/components/NowPlaying/RightPanel";

function AmbientBackground({ thumbnail }: { thumbnail: string | null }) {
  const colors = useAlbumColors(thumbnail);
  const dynamicColor = colors?.dominant ?? "#a78bfa";
  const dynamicGlow = colors?.dominant
    ? `rgba(${parseInt(colors.dominant.slice(1, 3), 16)}, ${parseInt(colors.dominant.slice(3, 5), 16)}, ${parseInt(colors.dominant.slice(5, 7), 16)}, 0.6)`
    : "rgba(167, 139, 250, 0.6)";

  return (
    <>
      {/* Base */}
      <div className="absolute inset-0 z-0" style={{ background: "var(--np-bg-primary)" }} />

      {/* Blob 1 — top left */}
      <motion.div
        animate={{ background: `radial-gradient(circle, ${dynamicGlow} 0%, transparent 70%)` }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute z-0"
        style={{
          top: "-5%",
          left: "-5%",
          width: 600,
          height: 600,
          filter: "blur(120px)",
          opacity: 0.6,
          animation: "np-blob-drift-1 20s ease-in-out infinite",
        }}
      />

      {/* Blob 2 — bottom right */}
      <motion.div
        animate={{ background: `radial-gradient(circle, var(--np-accent-glow) 0%, transparent 70%)` }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute z-0"
        style={{
          bottom: "-10%",
          right: "-5%",
          width: 400,
          height: 400,
          filter: "blur(100px)",
          opacity: 0.4,
          animation: "np-blob-drift-2 25s ease-in-out infinite",
        }}
      />

      {/* Noise texture */}
      <div className="np-noise" />
    </>
  );
}

function VideoTarget({ isMobile }: { isMobile: boolean }) {
  return (
    <motion.div
      id="yt-video-target"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="mb-6 w-full overflow-hidden rounded-2xl"
      style={{
        maxWidth: isMobile ? 340 : 480,
        aspectRatio: "16/9",
        border: "1px solid var(--np-border)",
        background: "#000",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}
    />
  );
}

function ContextLabel() {
  return (
    <div
      className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
      style={{
        background: "var(--np-bg-elevated)",
        border: "1px solid var(--np-border)",
      }}
    >
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{
          background: "var(--np-accent-warm)",
          animation: "np-pulse-dot 2s ease-in-out infinite",
        }}
      />
      <span
        className="text-[10px] uppercase tracking-[0.2em]"
        style={{
          fontFamily: "var(--font-dm-mono, 'DM Mono'), monospace",
          color: "var(--np-text-secondary)",
        }}
      >
        NOW PLAYING
      </span>
    </div>
  );
}

export default function NowPlayingPage() {
  const router = useRouter();
  const current = useLyrixStore((s) => s.queue.current);
  const playbackMode = useLyrixStore((s) => s.player.mode);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1280);
    };
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (current || typeof window === "undefined") return;
    const timer = setTimeout(() => {
      const state = useLyrixStore.getState();
      if (state.queue.current) return;
      try {
        const raw = localStorage.getItem("lyrix_player_session");
        if (raw) {
          const session = JSON.parse(raw);
          if (session?.currentTrack) return;
        }
      } catch { /* */ }
      router.replace("/");
    }, 1500);
    return () => clearTimeout(timer);
  }, [current, router]);

  const dragY = useMotionValue(0);
  const dragOpacity = useTransform(dragY, [0, 300], [1, 0.3]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 120 || info.velocity.y > 500) {
        router.back();
      } else {
        void animate(dragY, 0, { type: "spring", stiffness: 300, damping: 30 });
      }
    },
    [router, dragY]
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const isVideoMode = playbackMode === "video";
  const leftWidth = isMobile ? "100%" : isTablet ? "50%" : "60%";
  const rightWidth = isMobile ? "0%" : isTablet ? "50%" : "40%";

  return (
    <>
      <Head>
        <title>{current ? `${current.title} — Lyrix` : "Now Playing — Lyrix"}</title>
      </Head>

      <motion.div
        className="np-page fixed inset-0 z-50 overflow-hidden"
        style={{
          fontFamily: "var(--font-dm-sans, 'DM Sans'), system-ui, sans-serif",
          color: "var(--np-text-primary)",
          y: isMobile ? dragY : 0,
          opacity: isMobile ? dragOpacity : 1,
        }}
        drag={isMobile ? "y" : false}
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        onDragEnd={isMobile ? handleDragEnd : undefined}
      >
        <AmbientBackground thumbnail={current?.thumbnail ?? null} />

        {/* Content layer */}
        <div className="relative z-10 flex h-full flex-col overflow-hidden">
          {/* Navbar */}
          <div
            className="relative z-20 flex-shrink-0"
            style={{
              background: "rgba(10, 10, 15, 0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderBottom: "1px solid var(--np-border)",
            }}
          >
            <SiteHeader />
          </div>

          {/* Two-column layout */}
          <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {/* LEFT PANEL */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col items-center justify-center overflow-hidden"
              style={{
                width: leftWidth,
                padding: isMobile ? "20px" : "40px",
              }}
            >
              <div className="flex w-full max-w-[380px] flex-col items-center">
                <ContextLabel />

                {/* Album Art or Video Target */}
                {isVideoMode ? (
                  <VideoTarget isMobile={isMobile} />
                ) : (
                  <div
                    className="w-full"
                    style={{
                      maxWidth: isMobile ? 240 : isTablet ? 260 : 320,
                    }}
                  >
                    <AlbumArt />
                  </div>
                )}

                <TrackInfo />

                <div className="mt-6 w-full">
                  <PlayerControls />
                </div>

                {/* Mobile: button to open bottom sheet */}
                {isMobile && (
                  <button
                    onClick={() => setMobileSheetOpen(true)}
                    className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-xs transition-colors"
                    style={{
                      background: "var(--np-bg-elevated)",
                      border: "1px solid var(--np-border)",
                      color: "var(--np-text-secondary)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                    Lyrics, Queue & Similar
                  </button>
                )}
              </div>
            </motion.div>

            {/* RIGHT PANEL — desktop/tablet only */}
            {!isMobile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                style={{ width: rightWidth }}
                className="overflow-hidden"
              >
                <RightPanel />
              </motion.div>
            )}
          </div>
        </div>

        {/* Mobile bottom sheet */}
        {isMobile && (
          <AnimatePresence>
            {mobileSheetOpen && (
              <MobileRightPanel isOpen={mobileSheetOpen} onClose={() => setMobileSheetOpen(false)} />
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLyrixStore, type RecommendationTrack } from "@/store";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { detectGenre, detectLanguage } from "@/services/trackMetadataService";
import { getPreferredLanguage } from "@/hooks/usePreferredLanguage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatDur(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SimilarTrackRowProps {
  track: RecommendationTrack;
  isCurrent: boolean;
  onPlay: () => void;
  onAdd: () => void;
}

export function SimilarTrackRow({ track, isCurrent, onPlay, onAdd }: SimilarTrackRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex cursor-pointer items-center gap-3 rounded-[10px] px-3 transition-all duration-200"
      style={{
        height: 64,
        background: hovered || isCurrent ? "var(--np-bg-elevated)" : "transparent",
        border: hovered ? "1px solid var(--np-border)" : "1px solid transparent",
        borderLeft: isCurrent ? "2px solid var(--np-accent)" : undefined,
      }}
    >
      {/* Thumbnail */}
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md">
        {track.thumbnail && (
          <TrackThumbnail
            src={track.thumbnail}
            alt={track.title}
            fill
            sizes="44px"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            style={{ objectFit: "cover" }}
          />
        )}
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 overflow-hidden">
        <p
          className="truncate text-sm font-medium"
          style={{
            fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
            color: isCurrent ? "var(--np-accent)" : "var(--np-text-primary)",
          }}
        >
          {track.title}
        </p>
        <p
          className="truncate text-xs"
          style={{
            fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
            color: "var(--np-text-secondary)",
          }}
        >
          {track.channel}
        </p>
      </div>

      {/* Actions — visible on hover */}
      <motion.div
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        className="flex items-center gap-2"
        style={{ pointerEvents: hovered ? "auto" : "none" }}
      >
        <span
          className="text-[11px]"
          style={{ fontFamily: "var(--font-dm-mono, 'DM Mono'), monospace", color: "var(--np-text-muted)" }}
        >
          {formatDur(track.duration)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
          style={{
            background: "var(--np-bg-elevated)",
            border: "1px solid var(--np-border)",
            color: "var(--np-text-secondary)",
          }}
          aria-label={`Add ${track.title} to queue`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </motion.div>
    </div>
  );
}

function AppendSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 px-3 py-3"
    >
      <div className="h-11 w-11 animate-pulse rounded-md bg-white/5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/5" />
      </div>
    </motion.div>
  );
}

async function fetchSeedTracks(
  videoId: string,
  genre: string,
  language: string,
  count = 20
): Promise<RecommendationTrack[]> {
  const params = new URLSearchParams({
    videoId,
    genre,
    language,
    count: String(count),
  });
  const res = await fetch(`${API_URL}/api/similar/seed?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json() as { tracks: RecommendationTrack[] };
  return data.tracks ?? [];
}

async function fetchNextTrack(
  seedVideoId: string,
  excludeIds: string[],
  genre: string,
  language: string
): Promise<RecommendationTrack | null> {
  const params = new URLSearchParams({
    seedVideoId,
    excludeIds: excludeIds.join(","),
    genre,
    language,
  });
  const res = await fetch(`${API_URL}/api/similar/next?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json() as { track: RecommendationTrack | null };
  return data.track ?? null;
}

export function SimilarList() {
  const similarTracks = useLyrixStore((s) => s.similarQueue.tracks);
  const seedVideoId = useLyrixStore((s) => s.similarQueue.seedVideoId);
  const seedGenre = useLyrixStore((s) => s.similarQueue.seedGenre);
  const seedLanguage = useLyrixStore((s) => s.similarQueue.seedLanguage);
  const excludeIds = useLyrixStore((s) => s.similarQueue.excludeIds);
  const isAppending = useLyrixStore((s) => s.similarQueue.isAppending);
  const isInitialLoading = useLyrixStore((s) => s.similarQueue.isInitialLoading);
  const lastPlaySource = useLyrixStore((s) => s.similarQueue.lastPlaySource);

  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId ?? null);
  const currentTrack = useLyrixStore((s) => s.queue.current);

  const initSimilarQueue = useLyrixStore((s) => s.initSimilarQueue);
  const consumeSimilarTrack = useLyrixStore((s) => s.consumeSimilarTrack);
  const appendSimilarTrack = useLyrixStore((s) => s.appendSimilarTrack);
  const setSimilarAppending = useLyrixStore((s) => s.setSimilarAppending);
  const setLastPlaySource = useLyrixStore((s) => s.setLastPlaySource);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);

  const lastInitRef = useRef<string | null>(null);
  const appendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAppendingRef = useRef(false);

  const doAppend = useCallback(async () => {
    const state = useLyrixStore.getState().similarQueue;
    if (isAppendingRef.current) return;
    if (!state.seedVideoId || !state.seedGenre || !state.seedLanguage) return;

    isAppendingRef.current = true;
    setSimilarAppending(true);

    try {
      const track = await fetchNextTrack(
        state.seedVideoId,
        Array.from(state.excludeIds),
        state.seedGenre,
        state.seedLanguage
      );
      if (track) {
        appendSimilarTrack(track);
      } else {
        setSimilarAppending(false);
      }
    } catch {
      setSimilarAppending(false);
    } finally {
      isAppendingRef.current = false;
    }
  }, [setSimilarAppending, appendSimilarTrack]);

  const handlePlayFromList = useCallback((track: RecommendationTrack) => {
    setLastPlaySource("similar_list");
    consumeSimilarTrack(track.videoId);

    playTrack({
      videoId: track.videoId,
      title: track.title,
      channel: track.channel,
      duration: track.duration,
      thumbnail: track.thumbnail,
      category: track.category as "music" | "podcast",
      filterScore: track.filterScore,
    });

    if (appendDebounceRef.current) clearTimeout(appendDebounceRef.current);
    appendDebounceRef.current = setTimeout(() => {
      void doAppend();
    }, 300);
  }, [consumeSimilarTrack, playTrack, setLastPlaySource, doAppend]);

  useEffect(() => {
    if (!currentVideoId || !currentTrack) return;
    if (lastPlaySource === "similar_list") return;
    if (currentVideoId === lastInitRef.current) return;

    lastInitRef.current = currentVideoId;

    const genre = detectGenre(currentTrack);
    const language = detectLanguage(currentTrack, getPreferredLanguage());

    void fetchSeedTracks(currentVideoId, genre, language, 20).then((tracks) => {
      if (tracks.length > 0) {
        initSimilarQueue(currentVideoId, genre, language, tracks);
      }
    });
  }, [currentVideoId, currentTrack, lastPlaySource, initSimilarQueue]);

  useEffect(() => {
    if (lastPlaySource === "similar_list") {
      setLastPlaySource("direct");
    }
  }, [currentVideoId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isInitialLoading && similarTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10" style={{ color: "var(--np-text-muted)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span className="text-xs">{currentVideoId ? "Loading similar tracks..." : "Play a track to see suggestions"}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <AnimatePresence mode="popLayout">
        {similarTracks.map((track) => (
          <motion.div
            key={track.videoId}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -32, scale: 0.94, transition: { duration: 0.2 } }}
            transition={{
              layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.25 },
              y: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
            }}
          >
            <SimilarTrackRow
              track={track}
              isCurrent={track.videoId === currentVideoId}
              onPlay={() => handlePlayFromList(track)}
              onAdd={() =>
                addToQueue({
                  videoId: track.videoId,
                  title: track.title,
                  channel: track.channel,
                  duration: track.duration,
                  thumbnail: track.thumbnail,
                  category: track.category as "music" | "podcast",
                  filterScore: track.filterScore,
                })
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {isAppending && <AppendSkeleton />}
      </AnimatePresence>
    </div>
  );
}

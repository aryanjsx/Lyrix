import { useRef, useState, useEffect } from "react";
import useSWR from "swr";
import { type Track, useLyrixStore } from "@/store";
import { searchTracks } from "@/services/api";
import { motion } from "framer-motion";
import { ArtistLink } from "@/components/ui/ArtistLink";

const REMIX_PATTERN = /remix|mashup|slowed\s*\+?\s*reverb|8d\s*audio|bass\s*boosted|nonstop|non[- ]?stop|dj\s*mix|megamix/i;

function isOriginalTrack(track: Track): boolean {
  return !REMIX_PATTERN.test(track.title);
}

interface CuratedSongsProps {
  title: string;
  query: string;
  gradient: string;
  icon: React.ReactNode;
  maxTracks?: number;
  delay?: number;
  excludeIds?: Set<string>;
}

function SongCard({ track, index }: { track: Track; index: number }) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const isPlaying = currentVideoId === track.videoId;

  return (
    <motion.button
      type="button"
      onClick={() => playTrack(track)}
      className="group flex w-[150px] flex-shrink-0 flex-col gap-2 rounded-md bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[160px] lg:w-[175px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/40">
        <img
          src={track.thumbnail}
          alt={track.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex gap-0.5">
              <span className="inline-block h-3 w-0.5 animate-pulse rounded-full bg-green-400" />
              <span className="inline-block h-4 w-0.5 animate-pulse rounded-full bg-green-400 [animation-delay:0.15s]" />
              <span className="inline-block h-2.5 w-0.5 animate-pulse rounded-full bg-green-400 [animation-delay:0.3s]" />
            </div>
          </div>
        )}
        <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 opacity-0 shadow-xl shadow-black/50 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </span>
      </div>
      <div className="min-w-0 text-left">
        <p className={`truncate text-[13px] font-medium ${isPlaying ? "text-green-400" : "text-white"}`}>
          {track.title}
        </p>
        <ArtistLink
          name={track.channel}
          className="truncate text-xs text-zinc-400 block"
        />
      </div>
    </motion.button>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[150px] flex-shrink-0 p-3 sm:w-[160px] lg:w-[175px]">
          <div className="aspect-square animate-pulse rounded-md bg-zinc-800" />
          <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
          <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export function CuratedSongs({ title, query, gradient, icon, maxTracks = 20, delay = 0, excludeIds }: CuratedSongsProps) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [ready, setReady] = useState(delay === 0);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || delay === 0) return;
    const timer = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(timer);
  }, [isVisible, delay]);

  const shouldFetch = isVisible && ready;

  const { data, isLoading: loading } = useSWR(
    shouldFetch ? `curated:${query}` : null,
    () => searchTracks(query),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 120_000,
      errorRetryCount: 1,
    }
  );

  const tracks = (data?.tracks ?? [])
    .filter(isOriginalTrack)
    .filter((t) => !excludeIds || !excludeIds.has(t.videoId))
    .slice(0, maxTracks);

  if (!isVisible) return <div ref={sentinelRef} style={{ minHeight: 1 }} />;
  if (!ready) return <div ref={sentinelRef}><CardsSkeleton count={6} /></div>;
  if (!loading && tracks.length === 0) return null;

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    playTrack(tracks[0]);
    for (let i = 1; i < tracks.length; i++) {
      addToQueue(tracks[i]);
    }
  };

  return (
    <section ref={sentinelRef}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}>
          {icon}
        </div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {tracks.length > 0 && (
          <button
            type="button"
            onClick={handlePlayAll}
            className="ml-auto text-sm font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            Play all
          </button>
        )}
      </div>

      {loading ? (
        <CardsSkeleton count={8} />
      ) : (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {tracks.map((track, i) => (
            <SongCard key={track.videoId} track={track} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

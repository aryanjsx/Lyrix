import { useEffect, useRef, useState } from "react";
import { useLyrixStore, type RecommendationTrack } from "@/store";
import { fetchForYou } from "@/services/recommendationApi";
import { motion } from "framer-motion";
import { recommendationToTrack } from "@/utils/mappers";

const LOAD_TIMEOUT_MS = 8_000;

function TrackTile({ track, index }: { track: RecommendationTrack; index: number }) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const isPlaying = currentVideoId === track.videoId;

  return (
    <motion.button
      type="button"
      onClick={() => playTrack(recommendationToTrack(track))}
      className="group flex w-[160px] flex-shrink-0 flex-col gap-2 rounded-md bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[180px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/30">
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
        <p className={`truncate text-sm font-medium ${isPlaying ? "text-green-400" : "text-white"}`}>
          {track.title}
        </p>
        <p className="truncate text-xs text-zinc-400">
          {track.channel}
        </p>
      </div>
    </motion.button>
  );
}

export function ForYouSection() {
  const tracks = useLyrixStore((s) => s.recommendations.forYou);
  const loading = useLyrixStore((s) => s.recommendations.forYouLoading);
  const setForYou = useLyrixStore((s) => s.setForYou);
  const setLoading = useLyrixStore((s) => s.setRecoLoading);
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const [attempted, setAttempted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn || tracks.length > 0 || loading || attempted) return;
    setLoading("forYouLoading", true);

    timerRef.current = setTimeout(() => {
      setLoading("forYouLoading", false);
      setAttempted(true);
    }, LOAD_TIMEOUT_MS);

    fetchForYou()
      .then((results) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (results.length > 0) setForYou(results);
        setAttempted(true);
      })
      .catch(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setLoading("forYouLoading", false);
        setAttempted(true);
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoggedIn, tracks.length, loading, attempted, setForYou, setLoading]);

  if (!isLoggedIn || tracks.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Made For You</h2>
        {/* <p className="mt-1 text-sm text-zinc-500">Based on your listening history</p> */}
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {tracks.slice(0, 20).map((t, i) => (
          <TrackTile key={t.videoId} track={t} index={i} />
        ))}
      </div>
    </section>
  );
}

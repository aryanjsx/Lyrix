import { useEffect, useState } from "react";
import { useLyrixStore, type Track } from "@/store";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { motion } from "framer-motion";
import { ArtistLink } from "@/components/ui/ArtistLink";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface RecentTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  playedAt: string;
}

export function RecentlyPlayed() {
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const [recent, setRecent] = useState<RecentTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      setRecent([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/history/recent?limit=12`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRecent(Array.isArray(data) ? data : []);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  if (loading) {
    return (
      <section>
        <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">
          Recently Played
        </h2>
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[160px] flex-shrink-0 sm:w-[180px]">
              <div className="aspect-square animate-pulse rounded-md bg-zinc-800" />
              <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (recent.length === 0) {
    return (
      <EmptyState
        icon="ti-clock"
        title="Nothing played yet"
        description="Tracks you listen to will appear here."
        size="sm"
      />
    );
  }

  return (
    <section aria-label="Recently played">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Recently Played
        </h2>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {recent.map((track, i) => {
          const isPlaying = currentVideoId === track.videoId;
          return (
            <motion.button
              key={track.videoId}
              type="button"
              onClick={() =>
                playTrack({
                  videoId: track.videoId,
                  title: track.title,
                  channel: track.channel,
                  duration: track.duration,
                  thumbnail: track.thumbnail,
                  category: "music",
                })
              }
              className="group flex w-[160px] flex-shrink-0 flex-col gap-2 rounded-md bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[180px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/30">
                <TrackThumbnail
                  src={track.thumbnail}
                  alt={track.title}
                  fill
                  sizes="180px"
                  style={{ objectFit: "cover" }}
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
                <p
                  className={`truncate text-sm font-medium ${
                    isPlaying ? "text-green-400" : "text-white"
                  }`}
                >
                  {track.title}
                </p>
                <ArtistLink
                  name={track.channel}
                  className="truncate text-xs text-zinc-400 block"
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

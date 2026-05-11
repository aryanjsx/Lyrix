import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useLyrixStore, type Track } from "@/store";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { motion } from "framer-motion";
import { formatDuration } from "@/utils/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ArtistTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

interface ArtistData {
  artistName: string;
  tracks: ArtistTrack[];
  thumbnail: string | null;
}

export default function ArtistPage() {
  const router = useRouter();
  const artistName = typeof router.query.id === "string"
    ? decodeURIComponent(router.query.id)
    : "";
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);

  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/artist/detail?name=${encodeURIComponent(artistName)}`
        );
        if (res.ok && !cancelled) {
          setData(await res.json());
        } else if (!cancelled) {
          setData(null);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artistName]);

  function handlePlay(t: ArtistTrack) {
    const track: Track = {
      videoId: t.videoId,
      title: t.title,
      channel: t.channel,
      duration: t.duration,
      thumbnail: t.thumbnail,
      category: t.category as "music" | "podcast",
      filterScore: t.filterScore,
    };
    playTrack(track);
  }

  function handlePlayAll() {
    if (!data?.tracks.length) return;
    const tracks = data.tracks.map((t) => ({
      videoId: t.videoId,
      title: t.title,
      channel: t.channel,
      duration: t.duration,
      thumbnail: t.thumbnail,
      category: t.category as "music" | "podcast",
      filterScore: t.filterScore,
    }));
    playTrack(tracks[0]);
    tracks.slice(1).forEach((t) => addToQueue(t));
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <div className="mb-6 h-48 animate-pulse rounded-2xl bg-zinc-800" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="h-10 w-10 animate-pulse rounded-md bg-zinc-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!data || data.tracks.length === 0) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <EmptyState
            icon="ti-user-off"
            title="Artist not found"
            description={`We couldn't find results for "${artistName}".`}
            action={{
              label: "Back to search",
              icon: "ti-arrow-left",
              onClick: () => router.back(),
            }}
            size="lg"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-28 py-6">
        {/* Artist header */}
        <motion.div
          className="relative mb-6 rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-48 bg-gradient-to-b from-purple-900/40 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <h1 className="text-3xl font-bold text-white">{data.artistName}</h1>
            <p className="text-white/50 text-sm mt-1">
              {data.tracks.length} songs found on Lyrix
            </p>
          </div>
        </motion.div>

        {/* Play all */}
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handlePlayAll}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/25 transition-transform hover:scale-105 active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </button>
          <span className="text-sm text-zinc-400">Play all</span>
        </div>

        {/* Popular tracks */}
        <section>
          <h2 className="text-base font-medium text-white mb-4">Popular</h2>
          <div className="space-y-1">
            {data.tracks.slice(0, 20).map((track, i) => {
              const isActive = currentVideoId === track.videoId;
              return (
                <motion.button
                  key={track.videoId}
                  type="button"
                  onClick={() => handlePlay(track)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                  }`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                >
                  <span className="w-6 text-right text-sm font-bold text-zinc-500">
                    {i + 1}
                  </span>
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md">
                    <TrackThumbnail
                      src={track.thumbnail}
                      alt={track.title}
                      fill
                      sizes="40px"
                      style={{ objectFit: "cover" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <polygon points="6,3 20,12 6,21" />
                      </svg>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${isActive ? "text-purple-400" : "text-white"}`}>
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {track.channel}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-zinc-500">
                    {formatDuration(track.duration)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

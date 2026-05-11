import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useLyrixStore, type Track } from "@/store";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";
import { motion } from "framer-motion";
import { formatDuration } from "@/utils/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SharedPlaylistTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
}

interface SharedPlaylistData {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  trackCount: number;
  tracks: SharedPlaylistTrack[];
}

export default function SharedPlaylistPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const setPlaylistMode = useLyrixStore((s) => s.setPlaylistMode);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);

  const [data, setData] = useState<SharedPlaylistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/playlists/shared/${encodeURIComponent(token)}`);
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
  }, [token]);

  function toTrack(t: SharedPlaylistTrack): Track {
    return {
      videoId: t.videoId,
      title: t.title,
      channel: t.channel,
      duration: t.duration,
      thumbnail: t.thumbnail,
      category: (t.category === "podcast" ? "podcast" : "music") as "music" | "podcast",
    };
  }

  function handlePlayAll() {
    if (!data?.tracks.length) return;
    setPlaylistMode(true);
    playTrack(toTrack(data.tracks[0]));
    data.tracks.slice(1).forEach((t) => addToQueue(toTrack(t)));
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

  if (!data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <EmptyState
            icon="ti-playlist-x"
            title="Playlist not found"
            description="This shared playlist link is invalid or has been removed."
            action={{ label: "Go home", icon: "ti-home", onClick: () => router.push("/") }}
            size="lg"
          />
        </main>
      </div>
    );
  }

  const thumbnails = data.tracks.slice(0, 4).map((t) => t.thumbnail);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-28 py-6">
        {/* Shared playlist header */}
        <motion.div
          className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <PlaylistCover
            thumbnails={thumbnails}
            customCover={data.coverImage}
            size={160}
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">
              Shared Playlist
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              {data.name}
            </h1>
            {data.description && (
              <p className="mt-1 text-sm text-white/50">{data.description}</p>
            )}
            <p className="mt-2 text-sm text-white/70">
              <span className="font-medium text-white">
                {data.tracks.length} songs
              </span>
            </p>
          </div>
        </motion.div>

        {/* Play all */}
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handlePlayAll}
            disabled={data.tracks.length === 0}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/25 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </button>
          <span className="text-sm text-zinc-400">Play all</span>
        </div>

        {/* Track list */}
        <div className="space-y-1">
          {data.tracks.map((track, i) => {
            const isActive = currentVideoId === track.videoId;
            return (
              <button
                key={track.videoId}
                type="button"
                onClick={() => playTrack(toTrack(track))}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                }`}
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
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isActive ? "text-purple-400" : "text-white"}`}>
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-zinc-400">{track.channel}</p>
                </div>
                <span className="flex-shrink-0 text-xs text-zinc-500">
                  {formatDuration(track.duration)}
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useLyrixStore, type Track } from "@/store";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { motion } from "framer-motion";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LikedSongsPage() {
  const router = useRouter();
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const savedTracks = useLyrixStore((s) => s.library.savedTracks);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const removeSavedTrack = useLyrixStore((s) => s.removeSavedTrack);
  const unsaveTrack = useLyrixStore((s) => s.unsaveTrackFromLibrary);

  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? savedTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(filter.toLowerCase()) ||
          t.channel.toLowerCase().includes(filter.toLowerCase())
      )
    : savedTracks;

  const handlePlay = (t: typeof savedTracks[number]) => {
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
  };

  const handleUnlike = (videoId: string) => {
    removeSavedTrack(videoId);
    unsaveTrack(videoId).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900/50 via-[var(--bg-primary)] to-[var(--bg-primary)]">
      <SiteHeader />

      <main className="px-4 pb-28 pt-6 sm:px-6 sm:pb-8 lg:px-8">
        {/* Header */}
        <motion.div
          className="mb-8 flex items-center gap-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-600 to-rose-700 shadow-xl shadow-pink-900/30 sm:h-40 sm:w-40">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Playlist</p>
            <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">Liked Songs</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {savedTracks.length} {savedTracks.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </motion.div>

        {!isLoggedIn ? (
          <p className="text-center text-sm text-zinc-400">Sign in to see your liked songs.</p>
        ) : savedTracks.length === 0 ? (
          <EmptyState
            icon="ti-heart"
            title="No liked songs yet"
            description="Tap the heart on any track to save it here."
            action={{
              label: "Find something to like",
              icon: "ti-search",
              onClick: () => router.push("/"),
            }}
            size="lg"
          />
        ) : (
          <>
            {/* Search/Filter */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Filter liked songs..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-purple-500/50 focus:bg-white/[0.06]"
              />
            </div>

            {/* Track list */}
            <div className="space-y-1">
              {filtered.map((track, i) => {
                const isActive = currentVideoId === track.videoId;
                return (
                  <motion.div
                    key={track.videoId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="w-6 text-right text-xs tabular-nums text-zinc-500">
                      {i + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => handlePlay(track)}
                      className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md"
                    >
                      {track.thumbnail ? (
                        <TrackThumbnail
                          src={track.thumbnail}
                          alt={track.title}
                          fill
                          sizes="40px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div className="h-full w-full bg-zinc-800" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <polygon points="6,3 20,12 6,21" />
                        </svg>
                      </div>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${isActive ? "text-purple-400" : "text-white"}`}>
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-zinc-400">{track.channel}</p>
                    </div>

                    <span className="hidden text-xs tabular-nums text-zinc-500 sm:block">
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleUnlike(track.videoId)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 opacity-0 transition-opacity hover:bg-white/[0.06] group-hover:opacity-100"
                      aria-label="Remove from liked"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { useLyrixStore, type Track } from "@/store";
import { ArtistLink } from "@/components/ui/ArtistLink";
import { formatDuration } from "@/utils/format";

interface ArtistTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

interface ArtistTrackListProps {
  tracks: ArtistTrack[];
  artistName: string;
}

export function ArtistTrackList({ tracks, artistName }: ArtistTrackListProps) {
  const [showAll, setShowAll] = useState(false);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const playerStatus = useLyrixStore((s) => s.player.status);

  const displayedTracks = showAll ? tracks : tracks.slice(0, 5);

  function handlePlayTrack(t: ArtistTrack, index: number) {
    const storeTrack: Track = {
      videoId: t.videoId,
      title: t.title,
      channel: t.channel,
      duration: t.duration,
      thumbnail: t.thumbnail,
      category: t.category === "podcast" ? "podcast" : "music",
      filterScore: t.filterScore,
    };
    playTrack(storeTrack);
    tracks.slice(index + 1).forEach((next) => {
      addToQueue({
        videoId: next.videoId,
        title: next.title,
        channel: next.channel,
        duration: next.duration,
        thumbnail: next.thumbnail,
        category: next.category === "podcast" ? "podcast" : "music",
        filterScore: next.filterScore,
      });
    });
  }

  return (
    <section aria-label={`Popular songs by ${artistName}`}>
      <h2 className="mb-4 text-base font-medium text-white">Popular</h2>

      <div className="space-y-1">
        {displayedTracks.map((track, index) => {
          const isCurrentTrack = currentVideoId === track.videoId;
          const isPlaying = isCurrentTrack && playerStatus === "playing";

          return (
            <motion.div
              key={track.videoId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => handlePlayTrack(track, index)}
              className={`group flex cursor-pointer items-center gap-4 rounded-xl px-3 py-2.5 transition-colors ${
                isCurrentTrack ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <div className="flex w-6 flex-shrink-0 items-center justify-center">
                {isPlaying ? (
                  <div className="flex h-4 items-end justify-center gap-px">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 rounded-full bg-white"
                        animate={{ height: ["40%", "100%", "40%"] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <span className="text-xs text-white/30 group-hover:hidden">
                      {index + 1}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="white"
                      className="hidden group-hover:block"
                      aria-hidden="true"
                    >
                      <polygon points="6,3 20,12 6,21" />
                    </svg>
                  </>
                )}
              </div>

              <img
                src={track.thumbnail}
                alt={track.title}
                className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
                loading="lazy"
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm transition-colors ${
                    isCurrentTrack
                      ? "font-medium text-white"
                      : "text-white/80 group-hover:text-white"
                  }`}
                >
                  {track.title}
                </p>
                <ArtistLink
                  name={track.channel}
                  className="mt-0.5 block truncate text-xs text-white/40"
                />
              </div>

              <span className="flex-shrink-0 text-xs text-white/30">
                {formatDuration(track.duration)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {tracks.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={showAll ? "rotate-180" : ""}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {showAll ? "Show less" : `Show ${tracks.length - 5} more`}
        </button>
      )}
    </section>
  );
}

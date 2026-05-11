import { useLyrixStore, type Track } from "@/store";
import { ArtistLink } from "@/components/ui/ArtistLink";

interface AppearsOnTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  filterScore: number;
}

interface ArtistAppearsOnProps {
  tracks: AppearsOnTrack[];
}

export default function ArtistAppearsOn({ tracks }: ArtistAppearsOnProps) {
  const playTrack = useLyrixStore((s) => s.playTrack);

  function handlePlay(t: AppearsOnTrack) {
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
  }

  return (
    <section aria-label="Appears on">
      <h2 className="mb-4 text-base font-medium text-white">Appears On</h2>

      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 scrollbar-hide">
        {tracks.map((track) => (
          <button
            key={track.videoId}
            type="button"
            onClick={() => handlePlay(track)}
            className="group w-40 flex-shrink-0 text-left"
          >
            <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-white/5">
              <img
                src={track.thumbnail}
                alt={track.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="black" className="ml-0.5">
                    <polygon points="6,3 20,12 6,21" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="truncate text-sm text-white/80 transition-colors group-hover:text-white">
              {track.title}
            </p>
            <ArtistLink
              name={track.channel}
              className="mt-0.5 block truncate text-xs text-white/35"
            />
          </button>
        ))}
      </div>
    </section>
  );
}

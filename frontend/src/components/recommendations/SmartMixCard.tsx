import { useLyrixStore, type SmartMixData } from "@/store";
import { recommendationToTrack } from "@/utils/mappers";

interface SmartMixCardProps {
  mix: SmartMixData;
}

export function SmartMixCard({ mix }: SmartMixCardProps) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);

  const handlePlayAll = () => {
    if (mix.tracks.length === 0) return;
    playTrack(recommendationToTrack(mix.tracks[0]));
    for (let i = 1; i < mix.tracks.length; i++) {
      addToQueue(recommendationToTrack(mix.tracks[i]));
    }
  };

  const mixTypeColors: Record<string, string> = {
    top_artists: "from-purple-600/80 to-indigo-900/90",
    time_of_day: "from-amber-600/80 to-orange-900/90",
    discovery: "from-emerald-600/80 to-teal-900/90",
  };

  const gradient = mixTypeColors[mix.mixType] ?? "from-zinc-600/80 to-zinc-900/90";

  const coverThumbnails = mix.tracks.slice(0, 4).map((t) => t.thumbnail);

  return (
    <button
      type="button"
      onClick={handlePlayAll}
      className="group flex w-[160px] flex-shrink-0 flex-col gap-2 rounded-md bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[180px]"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/40">
        {coverThumbnails.length >= 4 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {coverThumbnails.map((thumb, i) => (
              <img
                key={i}
                src={thumb}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ))}
          </div>
        ) : coverThumbnails.length > 0 ? (
          <img
            src={coverThumbnails[0]}
            alt={mix.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        <div className={`absolute inset-0 bg-gradient-to-t ${gradient} opacity-60`} />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-white/70">
            {mix.tracks.length} tracks
          </span>
        </div>
        <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 opacity-0 shadow-xl shadow-black/50 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </span>
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold text-white">
          {mix.title}
        </p>
        <p className="line-clamp-2 text-xs leading-tight text-zinc-400">
          {mix.description}
        </p>
      </div>
    </button>
  );
}

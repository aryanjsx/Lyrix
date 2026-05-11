import useSWR from "swr";
import { motion } from "framer-motion";
import { useLyrixStore, type RecommendationTrack } from "@/store";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import { recommendationToTrack } from "@/utils/mappers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DailyMix {
  id: string;
  label: string;
  description: string;
  color: string;
  tracks: RecommendationTrack[];
  generatedAt: string;
}

async function fetcher(url: string) {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

function DailyMixCard({ mix, index }: { mix: DailyMix; index: number }) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);

  const handlePlay = () => {
    if (!mix.tracks.length) return;
    const tracks = mix.tracks.map(recommendationToTrack);
    playTrack(tracks[0]);
    tracks.slice(1).forEach((t) => addToQueue(t));
  };

  const thumbs = mix.tracks.slice(0, 4).map((t) => t.thumbnail);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="group w-[160px] flex-shrink-0 cursor-pointer sm:w-[180px]"
      onClick={handlePlay}
      role="button"
      aria-label={`Play ${mix.label}`}
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-white/5">
        {thumbs.length >= 4 ? (
          <div className="grid h-full w-full grid-cols-2 gap-0.5">
            {thumbs.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `${mix.color}22` }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={mix.color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-white transition-transform group-hover:translate-y-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="black"
            >
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </div>
        </div>
      </div>

      <p className="truncate text-sm font-medium text-white">{mix.label}</p>
      <p className="mt-0.5 truncate text-xs text-white/40">
        {mix.description}
      </p>
    </motion.div>
  );
}

function DailyMixesSkeleton() {
  return (
    <section>
      <div className="mb-4 h-6 w-28 animate-pulse rounded bg-white/10" />
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-[160px] flex-shrink-0 sm:w-[180px]"
          >
            <div className="mb-3 aspect-square animate-pulse rounded-xl bg-white/5" />
            <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
            <div className="mt-1 h-3 w-32 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DailyMixes() {
  const { data: mixes, isLoading } = useSWR<DailyMix[]>(
    `${API_URL}/api/mixes/daily`,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60 * 60 * 1000,
      dedupingInterval: 60 * 60 * 1000,
    }
  );

  if (isLoading) return <DailyMixesSkeleton />;
  if (!mixes?.length) return null;

  return (
    <section aria-label="Daily mixes">
      <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">
        Daily Mixes
      </h2>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {mixes.map((mix, i) => (
          <DailyMixCard key={mix.id} mix={mix} index={i} />
        ))}
      </div>
    </section>
  );
}

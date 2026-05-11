import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { useLyrixStore, type RecommendationTrack } from "@/store";
import {
  getTimeContext,
  getMinutesUntilNextSlot,
} from "@/services/timeContextService";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import { recommendationToTrack } from "@/utils/mappers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SunriseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
    <path d="M17 18a5 5 0 0 0-10 0" /><line x1="12" y1="2" x2="12" y2="9" /><line x1="4.22" y1="10.22" x2="5.64" y2="11.64" /><line x1="1" y1="18" x2="3" y2="18" /><line x1="21" y1="18" x2="23" y2="18" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" /><line x1="23" y1="22" x2="1" y2="22" /><polyline points="8 6 12 2 16 6" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

function SlotIcon({ slot }: { slot: string }) {
  if (slot === "early_morning" || slot === "morning") return <SunriseIcon />;
  if (slot === "afternoon") return <SunIcon />;
  return <MoonIcon />;
}

function TrackTile({
  track,
  index,
}: {
  track: RecommendationTrack;
  index: number;
}) {
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
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
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
        <p
          className={`truncate text-sm font-medium ${isPlaying ? "text-green-400" : "text-white"}`}
        >
          {track.title}
        </p>
        <p className="truncate text-xs text-zinc-400">{track.channel}</p>
      </div>
    </motion.button>
  );
}

async function fetcher(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetchWithAuth(url, { signal: controller.signal });
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function TimeAwareSection() {
  const [ctx] = useState(() => getTimeContext());
  const ttlMs = getMinutesUntilNextSlot() * 60 * 1000;
  const prefLangs = useLyrixStore((s) => s.preferences.languages);

  const langParam = prefLangs.length > 0
    ? `&languages=${encodeURIComponent(prefLangs.join(","))}`
    : "";
  const swrKey = `${API_URL}/api/recommendations/time-aware?slot=${ctx.slot}&limit=12${langParam}`;

  const { data, isLoading } = useSWR<RecommendationTrack[]>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: Math.max(ttlMs, 300_000),
      dedupingInterval: Math.max(ttlMs, 300_000),
      errorRetryCount: 1,
      loadingTimeout: 3000,
      keepPreviousData: true,
    }
  );

  if (isLoading) {
    return (
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
            <SlotIcon slot={ctx.slot} />
          </div>
          <div>
            <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
            <div className="mt-1 h-3 w-48 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-[160px] flex-shrink-0 sm:w-[180px]"
            >
              <div className="mb-2 aspect-square animate-pulse rounded-md bg-white/5" />
              <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-1 h-3 w-16 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!data?.length) return null;

  return (
    <section aria-label={`${ctx.label} recommendations`}>
      <motion.div
        className="mb-4 flex items-center gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
          <SlotIcon slot={ctx.slot} />
        </div>
        <div>
          <h2 className="text-base font-medium text-white">{ctx.greeting}</h2>
          <p className="text-xs text-white/40">
            Music for your {ctx.label.toLowerCase()}
          </p>
        </div>
      </motion.div>

      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {data.map((t, i) => (
          <TrackTile key={t.videoId} track={t} index={i} />
        ))}
      </div>
    </section>
  );
}

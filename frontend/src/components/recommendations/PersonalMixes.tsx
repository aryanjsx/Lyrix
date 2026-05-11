import { useEffect, useState, useMemo, useRef } from "react";
import { type Track, useLyrixStore } from "@/store";
import { searchTracks } from "@/services/api";
import { motion } from "framer-motion";

interface MixDef {
  id: string;
  title: string;
  description: string;
  queries: string[];
  gradient: string;
}

const MIXES_BY_LANGUAGE: Record<string, MixDef[]> = {
  hindi: [
    { id: "hindi-my-mix", title: "My Mix", description: "Arijit Singh, Pritam, Shreya Ghoshal and more", queries: ["Arijit Singh latest official", "Pritam bollywood songs official", "Shreya Ghoshal hindi songs official"], gradient: "from-violet-600 to-indigo-800" },
    { id: "hindi-chill-mix", title: "Chill Mix", description: "Relaxing Hindi melodies for quiet moments", queries: ["hindi chill acoustic unplugged official", "bollywood lofi slow songs official", "hindi peaceful songs official"], gradient: "from-sky-600 to-blue-800" },
    { id: "hindi-mood-mix", title: "Mood Mix", description: "Feel-good Bollywood vibes", queries: ["hindi happy feel good songs official", "bollywood dance upbeat songs official", "hindi motivational songs official"], gradient: "from-amber-500 to-orange-700" },
    { id: "hindi-throwback-mix", title: "Throwback Mix", description: "Nostalgic Bollywood classics", queries: ["bollywood retro classic hit songs", "90s hindi songs official evergreen", "old bollywood romantic songs official"], gradient: "from-rose-600 to-pink-800" },
  ],
  punjabi: [
    { id: "punjabi-my-mix", title: "Punjabi Mix", description: "AP Dhillon, Diljit, Karan Aujla and more", queries: ["AP Dhillon latest songs official", "Diljit Dosanjh punjabi songs official", "Karan Aujla official songs 2026"], gradient: "from-orange-500 to-red-700" },
    { id: "punjabi-party-mix", title: "Punjabi Party", description: "High-energy Punjabi beats", queries: ["punjabi party dance songs official 2026", "punjabi bass boosted official songs", "punjabi hip hop official songs 2026"], gradient: "from-red-500 to-rose-700" },
  ],
  english: [
    { id: "eng-my-mix", title: "Pop Mix", description: "Taylor Swift, The Weeknd, Dua Lipa and more", queries: ["Taylor Swift latest songs official", "The Weeknd songs official", "Dua Lipa official songs"], gradient: "from-purple-600 to-violet-800" },
    { id: "eng-chill-mix", title: "Chill Mix", description: "Lofi, indie, and relaxing vibes", queries: ["english chill lofi official songs", "indie pop relaxing songs official", "calm acoustic english songs official"], gradient: "from-teal-600 to-emerald-800" },
    { id: "eng-hiphop-mix", title: "Hip-Hop Mix", description: "Drake, Kendrick, Travis Scott and more", queries: ["Drake latest songs official", "Kendrick Lamar official songs", "Travis Scott latest official songs"], gradient: "from-yellow-600 to-amber-800" },
  ],
  tamil: [
    { id: "tamil-my-mix", title: "Tamil Mix", description: "Anirudh, Sid Sriram, Yuvan and more", queries: ["Anirudh Ravichander tamil songs official", "Sid Sriram tamil songs official", "Yuvan Shankar Raja songs official"], gradient: "from-emerald-600 to-green-800" },
  ],
  telugu: [
    { id: "telugu-my-mix", title: "Telugu Mix", description: "Thaman, DSP, Sid Sriram and more", queries: ["Thaman S telugu songs official", "Devi Sri Prasad telugu official songs", "Sid Sriram telugu songs official"], gradient: "from-blue-600 to-indigo-800" },
  ],
  korean: [
    { id: "kpop-mix", title: "K-Pop Mix", description: "BTS, BLACKPINK, NewJeans and more", queries: ["BTS official songs latest", "BLACKPINK official songs", "NewJeans official songs latest"], gradient: "from-pink-500 to-rose-700" },
  ],
};

const DEFAULT_MIXES: MixDef[] = [
  { id: "global-mix", title: "My Mix", description: "Based on your music taste", queries: ["latest trending official songs 2026", "top hits official music 2026", "popular songs official new releases"], gradient: "from-violet-600 to-indigo-800" },
  { id: "global-chill", title: "Chill Mix", description: "Relax and unwind", queries: ["chill lofi official songs relaxing", "acoustic calm official songs", "peaceful music official instrumental"], gradient: "from-sky-600 to-blue-800" },
];

interface PersonalMixesProps {
  languages?: Set<string>;
  excludeIds?: Set<string>;
}

interface LoadedMix {
  def: MixDef;
  tracks: Track[];
}

export function PersonalMixes({ languages, excludeIds }: PersonalMixesProps) {
  const [mixes, setMixes] = useState<LoadedMix[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mixDefs = useMemo(() => {
    if (!languages || languages.size === 0) {
      return [
        ...(MIXES_BY_LANGUAGE["hindi"]?.slice(0, 2) ?? []),
        ...(MIXES_BY_LANGUAGE["english"]?.slice(0, 2) ?? []),
      ];
    }
    const result: MixDef[] = [];
    for (const lang of languages) {
      const items = MIXES_BY_LANGUAGE[lang];
      if (items) result.push(...items);
    }
    return result.length > 0 ? result.slice(0, 6) : DEFAULT_MIXES;
  }, [languages]);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    async function loadOneMix(def: MixDef): Promise<{ def: MixDef; tracks: Track[] }> {
      const first = await searchTracks(def.queries[0]);
      const allTracks: Track[] = [];
      const seen = new Set<string>();
      for (const t of first.tracks) {
        if (!seen.has(t.videoId)) { seen.add(t.videoId); allTracks.push(t); }
      }
      if (allTracks.length >= 8) return { def, tracks: allTracks };

      const rest = await Promise.allSettled(
        def.queries.slice(1).map((q) => searchTracks(q))
      );
      for (const r of rest) {
        if (r.status === "fulfilled") {
          for (const t of r.value.tracks) {
            if (!seen.has(t.videoId)) { seen.add(t.videoId); allTracks.push(t); }
          }
        }
      }
      return { def, tracks: allTracks };
    }

    async function loadMixes() {
      const globalExclude = new Set<string>(excludeIds ?? []);
      const loaded: LoadedMix[] = [];
      const BATCH_SIZE = 2;

      for (let i = 0; i < mixDefs.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = mixDefs.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(loadOneMix));

        for (const r of results) {
          if (r.status === "fulfilled") {
            const deduped = r.value.tracks.filter(
              (t) => !globalExclude.has(t.videoId)
            );
            for (const t of deduped) globalExclude.add(t.videoId);
            if (deduped.length >= 4) {
              loaded.push({ def: r.value.def, tracks: deduped.slice(0, 25) });
            }
          }
        }
        setMixes([...loaded]);
        if (i === 0) setLoading(false);
      }

      setMixes(loaded);
      setLoading(false);
    }

    const timer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 20_000);

    loadMixes().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixDefs, isVisible]);

  if (!isVisible) return <div ref={sectionRef} style={{ minHeight: 1 }} />;
  if (!loading && mixes.length === 0) return null;

  const handlePlayMix = (mix: LoadedMix) => {
    if (mix.tracks.length === 0) return;
    playTrack(mix.tracks[0]);
    for (let i = 1; i < mix.tracks.length; i++) {
      addToQueue(mix.tracks[i]);
    }
  };

  return (
    <section ref={sectionRef}>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Made For You</h2>
      </div>

      {loading ? (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[180px] flex-shrink-0 p-3 sm:w-[200px]">
              <div className="aspect-square animate-pulse rounded-lg bg-zinc-800" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="mt-1.5 h-3 w-full animate-pulse rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {mixes.map((mix, i) => (
            <MixCard
              key={mix.def.id}
              mix={mix}
              index={i}
              onPlay={() => handlePlayMix(mix)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MixCard({ mix, index, onPlay }: { mix: LoadedMix; index: number; onPlay: () => void }) {
  const coverThumbs = mix.tracks.slice(0, 4).map((t) => t.thumbnail);

  return (
    <motion.button
      type="button"
      onClick={onPlay}
      className="group flex w-[180px] flex-shrink-0 flex-col gap-2 rounded-lg bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[200px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-lg shadow-black/40">
        {coverThumbs.length >= 4 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {coverThumbs.map((thumb, i) => (
              <img key={i} src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
            ))}
          </div>
        ) : coverThumbs.length > 0 ? (
          <img src={coverThumbs[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${mix.def.gradient}`} />
        )}
        <div className={`absolute inset-0 bg-gradient-to-t ${mix.def.gradient} opacity-50`} />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" opacity="0.8">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <span className="text-[11px] font-medium text-white/80">
              {mix.tracks.length} tracks
            </span>
          </div>
        </div>
        <span className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-green-500 opacity-0 shadow-xl shadow-black/50 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </span>
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold text-white">{mix.def.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-zinc-400">
          {mix.def.description}
        </p>
      </div>
    </motion.button>
  );
}

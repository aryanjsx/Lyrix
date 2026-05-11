import { useState, useEffect, useRef } from "react";
import { type Track, useLyrixStore } from "@/store";
import { searchTracks } from "@/services/api";
import { motion } from "framer-motion";
import { ArtistLink } from "@/components/ui/ArtistLink";

interface PodcastCategory {
  id: string;
  title: string;
  query: string;
  gradient: string;
}

const PODCASTS_BY_LANGUAGE: Record<string, PodcastCategory[]> = {
  hindi: [
    { id: "hindi-podcast-stories", title: "Hindi Stories & Talks", query: "The Ranveer Show podcast full episode hindi", gradient: "from-indigo-600 to-purple-700" },
    { id: "hindi-podcast-motivation", title: "Hindi Motivation", query: "Shwetabh Gangwar podcast full episode", gradient: "from-amber-600 to-orange-700" },
    { id: "hindi-podcast-comedy", title: "Hindi Comedy", query: "Honestly by Tanmay Bhat podcast episode", gradient: "from-pink-600 to-rose-700" },
  ],
  english: [
    { id: "eng-podcast-tech", title: "Tech & Science", query: "Lex Fridman podcast full episode", gradient: "from-cyan-600 to-blue-700" },
    { id: "eng-podcast-stories", title: "True Crime", query: "JRE Joe Rogan Experience full episode podcast", gradient: "from-red-600 to-rose-700" },
    { id: "eng-podcast-business", title: "Business & Finance", query: "Diary of a CEO Steven Bartlett podcast episode", gradient: "from-emerald-600 to-teal-700" },
    { id: "eng-podcast-comedy", title: "Comedy & Talk", query: "Flagrant podcast full episode Andrew Schulz", gradient: "from-yellow-600 to-amber-700" },
  ],
  punjabi: [
    { id: "punjabi-podcast", title: "Punjabi Podcasts", query: "punjabi podcast full episode AK Talk Show", gradient: "from-orange-600 to-red-700" },
  ],
  tamil: [
    { id: "tamil-podcast", title: "Tamil Podcasts", query: "tamil podcast full episode Paridhabangal", gradient: "from-emerald-600 to-green-700" },
  ],
  telugu: [
    { id: "telugu-podcast", title: "Telugu Podcasts", query: "telugu podcast full episode Chill Maama", gradient: "from-blue-600 to-indigo-700" },
  ],
  korean: [
    { id: "korean-podcast", title: "Korean Podcasts", query: "korean podcast full episode talk show", gradient: "from-pink-600 to-purple-700" },
  ],
  japanese: [
    { id: "japanese-podcast", title: "Japanese Podcasts", query: "japanese podcast full episode nihongo", gradient: "from-red-600 to-pink-700" },
  ],
  spanish: [
    { id: "spanish-podcast", title: "Spanish Podcasts", query: "podcast en español episodio completo", gradient: "from-yellow-600 to-orange-700" },
  ],
};

const DEFAULT_PODCASTS: PodcastCategory[] = [
  { id: "popular-podcasts", title: "Popular Podcasts", query: "Joe Rogan Experience podcast full episode", gradient: "from-purple-600 to-indigo-700" },
  { id: "ted-talks", title: "TED Talks", query: "TED Talk full length presentation 2026", gradient: "from-red-600 to-rose-700" },
  { id: "storytelling", title: "Diary of a CEO", query: "Diary of a CEO Steven Bartlett full episode", gradient: "from-amber-600 to-orange-700" },
  { id: "self-improvement", title: "Self Improvement", query: "Andrew Huberman Lab podcast full episode", gradient: "from-emerald-600 to-teal-700" },
  { id: "news-daily", title: "Lex Fridman", query: "Lex Fridman podcast full episode latest", gradient: "from-sky-600 to-blue-700" },
];

function PodcastCard({ track, index }: { track: Track; index: number }) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const isPlaying = currentVideoId === track.videoId;

  return (
    <motion.button
      type="button"
      onClick={() => playTrack(track)}
      className="group flex w-[150px] flex-shrink-0 flex-col gap-2 rounded-md bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[160px] lg:w-[175px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-lg shadow-black/40">
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
        <p className={`line-clamp-2 text-[13px] font-medium leading-tight ${isPlaying ? "text-green-400" : "text-white"}`}>
          {track.title}
        </p>
        <ArtistLink
          name={track.channel}
          className="mt-0.5 truncate text-xs text-zinc-400 block"
        />
      </div>
    </motion.button>
  );
}

function PodcastRow({ category }: { category: PodcastCategory }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    setLoading(true);

    searchTracks(category.query, undefined, "podcast")
      .then((result) => {
        if (cancelled) return;
        if (result.tracks.length > 0) {
          setTracks(result.tracks.slice(0, 15));
          setLoading(false);
        } else if (retryCount < 2) {
          const delay = (retryCount + 1) * 3000;
          setTimeout(() => {
            if (!cancelled) setRetryCount((c) => c + 1);
          }, delay);
          setLoading(false);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (retryCount < 2) {
          const delay = (retryCount + 1) * 3000;
          setTimeout(() => {
            if (!cancelled) setRetryCount((c) => c + 1);
          }, delay);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [category.query, retryCount, isVisible]);

  if (!isVisible) {
    return (
      <div ref={rowRef} style={{ minHeight: 1 }} />
    );
  }

  if (!loading && tracks.length === 0) return null;

  return (
    <div ref={rowRef}>
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${category.gradient}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-white">{category.title}</h3>
      </div>

      {loading ? (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[150px] flex-shrink-0 p-3 sm:w-[160px] lg:w-[175px]">
              <div className="aspect-square animate-pulse rounded-lg bg-zinc-800" />
              <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : (
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {tracks.map((track, i) => (
            <PodcastCard key={track.videoId} track={track} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

interface PodcastSectionProps {
  languages?: Set<string>;
}

export function PodcastSection({ languages }: PodcastSectionProps) {
  const categories: PodcastCategory[] = [];

  if (languages && languages.size > 0) {
    for (const lang of languages) {
      const items = PODCASTS_BY_LANGUAGE[lang];
      if (items) categories.push(...items);
    }
  }

  if (categories.length === 0) {
    categories.push(...DEFAULT_PODCASTS);
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">Podcasts</h2>
      </div>

      {categories.map((cat) => (
        <PodcastRow key={cat.id} category={cat} />
      ))}
    </section>
  );
}

import { useEffect, useMemo, useState, useCallback } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { useLyrixStore, type Track } from "@/store";
import { saveGuestPrefs } from "@/config/languages";
import { searchTracks, SearchResult } from "@/services/api";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { searchHistoryService } from "@/services/searchHistoryService";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ForYouSection } from "@/components/recommendations/ForYouSection";
import { TrendingSection } from "@/components/recommendations/TrendingSection";
import { BrowseGenres } from "@/components/recommendations/BrowseGenres";
import { QuickPicks } from "@/components/recommendations/QuickPicks";
import { CuratedSongs } from "@/components/recommendations/CuratedSongs";
import { PersonalMixes } from "@/components/recommendations/PersonalMixes";
import { PodcastSection } from "@/components/recommendations/PodcastSection";
import { TimeAwareSection } from "@/components/home/TimeAwareSection";
import { DailyMixes } from "@/components/home/DailyMixes";
import { RecentlyPlayed } from "@/components/home/RecentlyPlayed";
import { analytics, EVENTS } from "@/services/analyticsService";
import { getTimeContext } from "@/services/timeContextService";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface HomepageTrack {
  videoId: string;
  title: string;
  channel: string;
  channelId?: string;
  duration: number;
  thumbnail: string;
  category: "music" | "podcast";
  filterScore: number;
}

interface HomepageCategory {
  id: string;
  title: string;
  query: string;
  representativeTrack: HomepageTrack | null;
}

interface HomepageData {
  trending: HomepageTrack[];
  categories: HomepageCategory[];
  recent: HomepageTrack[];
  meta: {
    servedFromCache: boolean;
    generatedAt: string;
    languages?: string[];
    errors?: string[];
  };
}

export const getServerSideProps: GetServerSideProps<{ homepage: HomepageData | null }> = async (ctx) => {
  try {
    let languages = "";
    const cookieHeader = ctx.req.headers.cookie ?? "";
    const match = cookieHeader.match(/lyrix_languages=([^;]*)/);
    if (match) {
      languages = decodeURIComponent(match[1]);
    }

    const langParam = languages ? `?languages=${encodeURIComponent(languages)}` : "";
    const res = await fetch(`${API_URL}/api/homepage${langParam}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(600),
    });

    if (!res.ok) {
      return { props: { homepage: null } };
    }

    const homepage: HomepageData = await res.json();
    return { props: { homepage } };
  } catch {
    return { props: { homepage: null } };
  }
};

const NOTE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
const BOLT = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const CLOUD = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>;
const HEART = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;

interface CuratedPlaylist {
  title: string;
  query: string;
  gradient: string;
  icon: React.ReactNode;
  language: string;
}

const PLAYLISTS_BY_LANGUAGE: Record<string, CuratedPlaylist[]> = {
  hindi: [
    { title: "Bollywood Chartbusters", query: "latest bollywood official hindi songs 2026", gradient: "from-orange-600/90 to-pink-700/90", icon: NOTE, language: "hindi" },
    { title: "Hindi Romantic", query: "hindi romantic official love songs new", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "hindi" },
    { title: "Hindi Chill", query: "hindi chill acoustic unplugged official songs", gradient: "from-teal-600/90 to-cyan-700/90", icon: CLOUD, language: "hindi" },
    { title: "Hindi Workout", query: "hindi high energy official motivational songs", gradient: "from-red-600/90 to-yellow-700/90", icon: BOLT, language: "hindi" },
  ],
  english: [
    { title: "Top Pop Hits", query: "top english pop official songs 2026", gradient: "from-purple-600/90 to-indigo-700/90", icon: NOTE, language: "english" },
    { title: "English Chill", query: "english chill acoustic official songs", gradient: "from-teal-600/90 to-cyan-700/90", icon: CLOUD, language: "english" },
    { title: "English Romantic", query: "english romantic official love songs new", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "english" },
    { title: "English Workout", query: "english workout official motivational songs", gradient: "from-red-600/90 to-yellow-700/90", icon: BOLT, language: "english" },
  ],
  punjabi: [
    { title: "Punjabi Power", query: "latest punjabi official songs 2026", gradient: "from-amber-600/90 to-orange-700/90", icon: BOLT, language: "punjabi" },
    { title: "Punjabi Romantic", query: "punjabi romantic official love songs new", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "punjabi" },
    { title: "Punjabi Party", query: "punjabi party official dance songs 2026", gradient: "from-fuchsia-600/90 to-violet-700/90", icon: BOLT, language: "punjabi" },
  ],
  tamil: [
    { title: "Tamil Hits", query: "latest tamil official songs hits 2026", gradient: "from-emerald-600/90 to-teal-700/90", icon: NOTE, language: "tamil" },
    { title: "Tamil Romantic", query: "tamil romantic official love songs new", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "tamil" },
    { title: "Tamil Party", query: "tamil kuthu official dance songs 2026", gradient: "from-fuchsia-600/90 to-violet-700/90", icon: BOLT, language: "tamil" },
  ],
  telugu: [
    { title: "Telugu Beats", query: "latest telugu official songs tollywood 2026", gradient: "from-blue-600/90 to-indigo-700/90", icon: NOTE, language: "telugu" },
    { title: "Telugu Romantic", query: "telugu romantic official love songs new", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "telugu" },
    { title: "Telugu Party", query: "telugu official dance mass songs 2026", gradient: "from-fuchsia-600/90 to-violet-700/90", icon: BOLT, language: "telugu" },
  ],
  bengali: [
    { title: "Bengali Hits", query: "latest bengali official songs 2026", gradient: "from-sky-600/90 to-blue-700/90", icon: NOTE, language: "bengali" },
    { title: "Bengali Romantic", query: "bengali romantic official love songs", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "bengali" },
  ],
  marathi: [
    { title: "Marathi Hits", query: "latest marathi official songs 2026", gradient: "from-lime-600/90 to-green-700/90", icon: NOTE, language: "marathi" },
    { title: "Marathi Romantic", query: "marathi romantic official love songs", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "marathi" },
  ],
  kannada: [
    { title: "Kannada Hits", query: "latest kannada official songs 2026", gradient: "from-cyan-600/90 to-teal-700/90", icon: NOTE, language: "kannada" },
    { title: "Kannada Romantic", query: "kannada romantic official love songs", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "kannada" },
  ],
  malayalam: [
    { title: "Malayalam Hits", query: "latest malayalam official songs 2026", gradient: "from-violet-600/90 to-purple-700/90", icon: NOTE, language: "malayalam" },
    { title: "Malayalam Romantic", query: "malayalam romantic official love songs", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "malayalam" },
  ],
  korean: [
    { title: "K-Pop Trending", query: "latest kpop official songs trending 2026", gradient: "from-pink-500/90 to-rose-600/90", icon: NOTE, language: "korean" },
    { title: "K-Pop Chill", query: "korean chill official rnb ballad songs", gradient: "from-teal-600/90 to-cyan-700/90", icon: CLOUD, language: "korean" },
  ],
  spanish: [
    { title: "Latin Hits", query: "latest latin reggaeton official songs 2026", gradient: "from-yellow-600/90 to-orange-700/90", icon: BOLT, language: "spanish" },
    { title: "Spanish Romantic", query: "spanish romantic official love songs", gradient: "from-rose-600/90 to-pink-700/90", icon: HEART, language: "spanish" },
  ],
  arabic: [
    { title: "Arabic Hits", query: "latest arabic official songs 2026", gradient: "from-emerald-600/90 to-cyan-700/90", icon: NOTE, language: "arabic" },
  ],
  japanese: [
    { title: "J-Pop & Anime", query: "latest japanese j-pop official songs 2026", gradient: "from-red-500/90 to-pink-600/90", icon: NOTE, language: "japanese" },
  ],
  urdu: [
    { title: "Urdu Ghazals", query: "urdu ghazal official songs latest", gradient: "from-emerald-500/90 to-green-600/90", icon: HEART, language: "urdu" },
    { title: "Urdu Songs", query: "latest urdu official songs 2026", gradient: "from-teal-500/90 to-emerald-600/90", icon: NOTE, language: "urdu" },
  ],
  bhojpuri: [
    { title: "Bhojpuri Beats", query: "latest bhojpuri official songs 2026", gradient: "from-amber-500/90 to-yellow-600/90", icon: BOLT, language: "bhojpuri" },
  ],
  haryanvi: [
    { title: "Haryanvi Hits", query: "latest haryanvi official songs 2026", gradient: "from-lime-500/90 to-emerald-600/90", icon: BOLT, language: "haryanvi" },
  ],
  gujarati: [
    { title: "Gujarati Songs", query: "latest gujarati official songs 2026", gradient: "from-orange-500/90 to-red-600/90", icon: NOTE, language: "gujarati" },
  ],
  rajasthani: [
    { title: "Rajasthani Folk", query: "rajasthani folk official songs latest", gradient: "from-yellow-500/90 to-amber-600/90", icon: NOTE, language: "rajasthani" },
  ],
};

type FilterTab = "all" | "music" | "podcasts";

function TrackCardSkeleton() {
  return (
    <div className="w-[160px] flex-shrink-0 sm:w-[180px]">
      <div className="aspect-square animate-pulse rounded-md bg-zinc-800" />
      <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
      <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">{title}</h2>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <TrackCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function SSRTrackCard({ track, index }: { track: HomepageTrack; index: number }) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const isPlaying = currentVideoId === track.videoId;

  const handlePlay = () => {
    const t: Track = {
      videoId: track.videoId,
      title: track.title,
      channel: track.channel,
      duration: track.duration,
      thumbnail: track.thumbnail,
      category: track.category,
      filterScore: track.filterScore,
    };
    playTrack(t);
  };

  return (
    <motion.button
      type="button"
      onClick={handlePlay}
      className="group flex w-[160px] flex-shrink-0 flex-col gap-2 rounded-md bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.09] sm:w-[180px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/30">
        <img
          src={track.thumbnail}
          alt={track.title}
          className="h-full w-full object-cover"
          loading={index < 4 ? "eager" : "lazy"}
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
        <p className={`truncate text-sm font-medium ${isPlaying ? "text-green-400" : "text-white"}`}>
          {track.title}
        </p>
        <p className="truncate text-xs text-zinc-400">
          {track.channel}
        </p>
      </div>
    </motion.button>
  );
}

function SSRTrendingSection({ tracks }: { tracks: HomepageTrack[] }) {
  if (tracks.length === 0) return <TrendingSection />;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Trending Now</h2>
        <button type="button" className="text-sm font-semibold text-zinc-400 transition-colors hover:text-white">
          Show all
        </button>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {tracks.slice(0, 12).map((t, i) => (
          <SSRTrackCard key={t.videoId} track={t} index={i} />
        ))}
      </div>
    </section>
  );
}

function SSRRecentSection({ tracks }: { tracks: HomepageTrack[] }) {
  if (tracks.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">New Releases</h2>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {tracks.slice(0, 12).map((t, i) => (
          <SSRTrackCard key={t.videoId} track={t} index={i} />
        ))}
      </div>
    </section>
  );
}

function SSRCategoriesSection({ categories }: { categories: HomepageCategory[] }) {
  const router = useRouter();

  if (categories.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-white sm:text-2xl">Browse</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => router.push(`/search?q=${encodeURIComponent(cat.query)}`)}
            className="relative overflow-hidden rounded-lg bg-white/[0.06] p-4 text-left transition-colors hover:bg-white/[0.1] cursor-pointer"
          >
            <p className="text-sm font-semibold text-white">{cat.title}</p>
            {cat.representativeTrack && (
              <p className="mt-0.5 truncate text-xs text-zinc-400">
                {cat.representativeTrack.title}
              </p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

type SearchSource = "cache" | "youtube" | "innertube" | "invidious" | "piped" | "library";

const SOURCE_LABELS: Record<SearchSource, string> = {
  cache: "",
  youtube: "",
  innertube: "",
  invidious: "",
  piped: "",
  library: "From your library",
};

export default function Home({ homepage: ssrHomepage }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const urlQuery = typeof router.query.q === "string" ? router.query.q : "";

  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const displayName = useLyrixStore((s) => s.user.profile?.displayName);
  const prefLangs = useLyrixStore((s) => s.preferences.languages);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [homepage, setHomepage] = useState<HomepageData | null>(ssrHomepage);

  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchSource, setSearchSource] = useState<SearchSource>("youtube");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Client-side fallback: if SSR timed out (homepage=null), fetch on client
  useEffect(() => {
    if (homepage !== null) return;
    const langParam = prefLangs.length > 0
      ? `?languages=${encodeURIComponent(prefLangs.join(","))}`
      : "";
    let cancelled = false;
    fetch(`${API_URL}/api/homepage${langParam}`, {
      headers: { Accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setHomepage(data as HomepageData);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchResults = useCallback((result: SearchResult) => {
    setSearchResults(result.tracks);
    setSearchSource(result.source as SearchSource);
    analytics.track(EVENTS.SEARCH_PERFORMED, {
      result_count: result.tracks.length,
      source: result.source,
      cache_hit: (result as SearchResult & { cacheHit?: boolean }).cacheHit ?? false,
    });
  }, []);

  const handleSearchLoading = useCallback((isLoading: boolean) => {
    setSearchLoading(isLoading);
  }, []);

  const handleSearchError = useCallback((err: string | null) => {
    setSearchError(err);
  }, []);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      searchHistoryService.add(suggestion);
      void router.replace(`/?q=${encodeURIComponent(suggestion)}`, undefined, {
        shallow: true,
      });
    },
    [router]
  );

  useEffect(() => {
    if (!urlQuery || urlQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setSearchLoading(true);

    (async () => {
      try {
        const result = await searchTracks(urlQuery, controller.signal);
        if (!cancelled) {
          setSearchResults(result.tracks);
          setSearchSource(result.source as SearchSource);
          setSearchLoading(false);
          if (result.tracks.length === 0) {
            setSearchError("No music found. Try a different search.");
          } else {
            setSearchError(null);
          }
          analytics.track(EVENTS.SEARCH_PERFORMED, {
            result_count: result.tracks.length,
            source: result.source,
            cache_hit: (result as SearchResult & { cacheHit?: boolean }).cacheHit ?? false,
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Couldn't load results. Try again.";
          setSearchError(message);
          setSearchResults([]);
          setSearchLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [urlQuery]);

  // Sync language prefs cookie and re-fetch if SSR data doesn't match current preferences
  useEffect(() => {
    if (prefLangs.length === 0) return;

    // Keep cookie in sync with current prefs
    saveGuestPrefs(prefLangs);

    const ssrLangs = ssrHomepage?.meta?.languages ?? [];
    const prefsKey = [...prefLangs].sort().join(",");
    const ssrKey = [...ssrLangs].sort().join(",");

    if (prefsKey !== ssrKey) {
      const langParam = encodeURIComponent(prefLangs.join(","));
      fetch(`${API_URL}/api/homepage?languages=${langParam}`, {
        headers: { Accept: "application/json" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setHomepage(data as HomepageData);
        })
        .catch(() => {});
    }
  }, [prefLangs, ssrHomepage]);

  function getGreeting(): string {
    const { greeting } = getTimeContext();
    return greeting;
  }

  const langSet = useMemo(() => new Set(prefLangs), [prefLangs]);

  // Collect all videoIds from SSR sections to prevent duplicates in client-side sections
  const ssrExcludeIds = useMemo(() => {
    const ids = new Set<string>();
    if (homepage) {
      for (const t of homepage.trending) ids.add(t.videoId);
      for (const t of homepage.recent) ids.add(t.videoId);
      for (const cat of homepage.categories) {
        if (cat.representativeTrack) ids.add(cat.representativeTrack.videoId);
      }
    }
    return ids;
  }, [homepage]);

  const curatedPlaylists = useMemo(() => {
    if (langSet.size === 0) {
      return (PLAYLISTS_BY_LANGUAGE["hindi"] ?? []).concat(
        PLAYLISTS_BY_LANGUAGE["english"] ?? []
      ).slice(0, 6);
    }
    const result: CuratedPlaylist[] = [];
    for (const lang of prefLangs) {
      const items = PLAYLISTS_BY_LANGUAGE[lang];
      if (items) result.push(...items);
    }
    return result;
  }, [langSet, prefLangs]);

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "music", label: "Music" },
    { id: "podcasts", label: "Podcasts" },
  ];

  const hasTrending = homepage && homepage.trending.length > 0;
  const hasRecent = homepage && homepage.recent.length > 0;
  const hasCategories = homepage && homepage.categories.length > 0;

  const sourceLabel = SOURCE_LABELS[searchSource];
  const isSearching = urlQuery.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900/50 via-[var(--bg-primary)] to-[var(--bg-primary)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        <SearchBar
          initialQuery={urlQuery}
          onResults={handleSearchResults}
          onLoading={handleSearchLoading}
          onError={handleSearchError}
        />
      </div>

      <main className="px-4 pb-28 pt-4 sm:px-6 sm:pb-8 lg:px-8">
        {isSearching ? (
          <div className="mx-auto max-w-3xl py-2">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-sm text-zinc-400">
                  Results for <span className="font-medium text-zinc-200">&ldquo;{urlQuery}&rdquo;</span>
                </h1>
                {!searchLoading && sourceLabel && (
                  <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-400">
                    {sourceLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!searchLoading && searchResults.length > 0 && (
                  <span className="text-xs text-zinc-600">{searchResults.length} tracks</span>
                )}
                <button
                  type="button"
                  onClick={() => void router.push("/", undefined, { shallow: true })}
                  className="rounded-full bg-white/[0.07] px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.12] hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
            <SearchResults
              results={searchResults}
              loading={searchLoading}
              error={searchError}
              query={urlQuery}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
        ) : (
          <>
            {/* Filter Chips */}
            <div className="mb-5 flex items-center gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    activeFilter === tab.id
                      ? "bg-white text-black"
                      : "bg-white/[0.07] text-white hover:bg-white/[0.12]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Greeting */}
            {isLoggedIn && (
              <motion.h1
                className="mb-5 text-2xl font-bold text-white sm:text-3xl"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {getGreeting()}{displayName ? `, ${displayName.split(" ")[0]}` : ""}
              </motion.h1>
            )}

            {/* Sections */}
            <div className="mt-8 min-h-[600px] space-y-10">
              {/* Music sections */}
              {(activeFilter === "all" || activeFilter === "music") && (
                <>
                  {isLoggedIn && <RecentlyPlayed />}

                  <TimeAwareSection />

                  {isLoggedIn && <ForYouSection />}

                  <DailyMixes />

                  {hasTrending ? (
                    <SSRTrendingSection tracks={homepage.trending} />
                  ) : (
                    <TrendingSection />
                  )}

                  <PersonalMixes languages={langSet} excludeIds={ssrExcludeIds} />

                  {hasCategories && (
                    <SSRCategoriesSection categories={homepage.categories} />
                  )}

                  {hasRecent && (
                    <SSRRecentSection tracks={homepage.recent} />
                  )}

                  <QuickPicks languages={langSet} />
                  {curatedPlaylists.slice(0, 4).map((pl, idx) => (
                    <CuratedSongs
                      key={pl.title}
                      title={pl.title}
                      query={pl.query}
                      gradient={pl.gradient}
                      icon={pl.icon}
                      delay={idx * 1500}
                      excludeIds={ssrExcludeIds}
                    />
                  ))}
                  <BrowseGenres languages={langSet} />
                </>
              )}

              {/* Podcast sections */}
              {(activeFilter === "all" || activeFilter === "podcasts") && (
                <PodcastSection languages={langSet} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

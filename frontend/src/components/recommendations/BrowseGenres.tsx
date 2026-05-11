import { useMemo } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

const NOTE_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
const STAR_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const BOLT_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const HEAD_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>;

interface GenreTile {
  id: string;
  label: string;
  subtitle: string;
  query: string;
  gradient: string;
  icon: React.ReactNode;
}

const GENRES_BY_LANGUAGE: Record<string, GenreTile[]> = {
  hindi: [
    { id: "hindi-top", label: "Top Hindi", subtitle: "Latest Hits", query: "latest hindi official songs 2026", gradient: "from-orange-500 to-pink-600", icon: STAR_ICON },
    { id: "hindi-retro", label: "Hindi Retro", subtitle: "Classics", query: "hindi retro classic official songs", gradient: "from-amber-500 to-orange-600", icon: NOTE_ICON },
    { id: "hindi-indie", label: "Hindi Indie", subtitle: "Independent", query: "hindi indie official songs latest", gradient: "from-violet-500 to-purple-600", icon: NOTE_ICON },
  ],
  english: [
    { id: "eng-pop", label: "Pop", subtitle: "Global Hits", query: "top english pop official songs 2026", gradient: "from-purple-500 to-blue-600", icon: STAR_ICON },
    { id: "eng-hiphop", label: "Hip Hop", subtitle: "Rap & Beats", query: "english hip hop rap official music 2026", gradient: "from-yellow-500 to-red-600", icon: HEAD_ICON },
    { id: "eng-edm", label: "EDM", subtitle: "Dance & Party", query: "english edm dance official songs 2026", gradient: "from-fuchsia-500 to-violet-600", icon: BOLT_ICON },
  ],
  punjabi: [
    { id: "punjabi-top", label: "Punjabi Top", subtitle: "Desi Beats", query: "latest punjabi official songs 2026", gradient: "from-amber-500 to-orange-600", icon: STAR_ICON },
    { id: "punjabi-party", label: "Punjabi Party", subtitle: "Dance Hits", query: "punjabi party official dance songs 2026", gradient: "from-red-500 to-rose-600", icon: BOLT_ICON },
  ],
  tamil: [
    { id: "tamil-top", label: "Tamil Top", subtitle: "Kollywood", query: "latest tamil official songs 2026", gradient: "from-emerald-500 to-teal-600", icon: STAR_ICON },
    { id: "tamil-kuthu", label: "Kuthu", subtitle: "Dance Hits", query: "tamil kuthu official dance songs", gradient: "from-fuchsia-500 to-pink-600", icon: BOLT_ICON },
  ],
  telugu: [
    { id: "telugu-top", label: "Telugu Top", subtitle: "Tollywood", query: "latest telugu official songs 2026", gradient: "from-blue-500 to-indigo-600", icon: STAR_ICON },
    { id: "telugu-mass", label: "Telugu Mass", subtitle: "High Energy", query: "telugu mass official dance songs 2026", gradient: "from-red-500 to-orange-600", icon: BOLT_ICON },
  ],
  bengali: [
    { id: "bengali-top", label: "Bengali Top", subtitle: "Latest Hits", query: "latest bengali official songs 2026", gradient: "from-sky-500 to-blue-600", icon: STAR_ICON },
  ],
  marathi: [
    { id: "marathi-top", label: "Marathi Top", subtitle: "Latest Hits", query: "latest marathi official songs 2026", gradient: "from-lime-500 to-green-600", icon: STAR_ICON },
  ],
  kannada: [
    { id: "kannada-top", label: "Kannada Top", subtitle: "Sandalwood", query: "latest kannada official songs 2026", gradient: "from-cyan-500 to-teal-600", icon: STAR_ICON },
  ],
  malayalam: [
    { id: "malayalam-top", label: "Malayalam Top", subtitle: "Mollywood", query: "latest malayalam official songs 2026", gradient: "from-violet-500 to-purple-600", icon: STAR_ICON },
  ],
  korean: [
    { id: "kpop-top", label: "K-Pop", subtitle: "Korean Wave", query: "latest kpop official songs 2026", gradient: "from-pink-500 to-rose-600", icon: STAR_ICON },
    { id: "kpop-rnb", label: "K-R&B", subtitle: "Korean Chill", query: "korean rnb official chill songs", gradient: "from-teal-500 to-cyan-600", icon: NOTE_ICON },
  ],
  spanish: [
    { id: "latin-top", label: "Latin Hits", subtitle: "Reggaeton", query: "latest latin reggaeton official songs 2026", gradient: "from-yellow-500 to-orange-600", icon: STAR_ICON },
  ],
  arabic: [
    { id: "arabic-top", label: "Arabic Hits", subtitle: "Trending", query: "latest arabic official songs 2026", gradient: "from-emerald-500 to-cyan-600", icon: STAR_ICON },
  ],
  japanese: [
    { id: "jpop-top", label: "J-Pop", subtitle: "& Anime", query: "latest japanese j-pop official songs 2026", gradient: "from-red-500 to-pink-600", icon: STAR_ICON },
  ],
  urdu: [
    { id: "urdu-top", label: "Urdu Hits", subtitle: "Latest", query: "latest urdu official songs 2026", gradient: "from-emerald-500 to-green-600", icon: STAR_ICON },
  ],
  bhojpuri: [
    { id: "bhojpuri-top", label: "Bhojpuri", subtitle: "Latest Hits", query: "latest bhojpuri official songs 2026", gradient: "from-amber-500 to-yellow-600", icon: STAR_ICON },
  ],
  haryanvi: [
    { id: "haryanvi-top", label: "Haryanvi", subtitle: "Latest Hits", query: "latest haryanvi official songs 2026", gradient: "from-lime-500 to-emerald-600", icon: STAR_ICON },
  ],
  gujarati: [
    { id: "gujarati-top", label: "Gujarati", subtitle: "Latest Hits", query: "latest gujarati official songs 2026", gradient: "from-orange-500 to-red-600", icon: STAR_ICON },
  ],
  rajasthani: [
    { id: "rajasthani-top", label: "Rajasthani", subtitle: "Folk Hits", query: "rajasthani folk official songs latest", gradient: "from-yellow-500 to-amber-600", icon: STAR_ICON },
  ],
};

interface BrowseGenresProps {
  languages?: Set<string>;
}

export function BrowseGenres({ languages }: BrowseGenresProps) {
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!languages || languages.size === 0) {
      return [
        ...(GENRES_BY_LANGUAGE["hindi"] ?? []),
        ...(GENRES_BY_LANGUAGE["english"] ?? []),
      ].slice(0, 6);
    }
    const result: GenreTile[] = [];
    for (const lang of languages) {
      const items = GENRES_BY_LANGUAGE[lang];
      if (items) result.push(...items);
    }
    return result;
  }, [languages]);

  const handleGenreClick = (query: string) => {
    void router.push(`/?q=${encodeURIComponent(query)}`);
  };

  if (filtered.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Browse by Genre</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((genre, i) => (
          <motion.button
            key={genre.id}
            type="button"
            onClick={() => handleGenreClick(genre.query)}
            className={`relative flex h-24 flex-col justify-end overflow-hidden rounded-lg bg-gradient-to-br ${genre.gradient} p-3 text-left shadow-md transition-shadow hover:shadow-xl sm:h-28`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute right-[-8px] top-[-4px] rotate-[25deg] opacity-30">
              <div className="h-16 w-16 sm:h-20 sm:w-20">{genre.icon}</div>
            </div>
            <span className="relative z-10 text-sm font-bold text-white sm:text-base">{genre.label}</span>
            <span className="relative z-10 text-[11px] text-white/70">{genre.subtitle}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

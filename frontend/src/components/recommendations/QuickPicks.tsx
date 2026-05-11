import { useMemo } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { motion } from "framer-motion";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import { slugify } from "@/lib/slugify";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Pick {
  label: string;
  query: string;
}

const PICKS_BY_LANGUAGE: Record<string, Pick[]> = {
  hindi: [
    { label: "Arijit Singh", query: "Arijit Singh hindi songs" },
    { label: "Pritam", query: "Pritam hindi songs" },
    { label: "Shreya Ghoshal", query: "Shreya Ghoshal hindi songs" },
    { label: "A.R. Rahman", query: "A.R. Rahman hindi songs" },
    { label: "Neha Kakkar", query: "Neha Kakkar hindi songs" },
    { label: "Jubin Nautiyal", query: "Jubin Nautiyal hindi songs" },
  ],
  english: [
    { label: "Taylor Swift", query: "Taylor Swift songs" },
    { label: "The Weeknd", query: "The Weeknd songs" },
    { label: "Dua Lipa", query: "Dua Lipa songs" },
    { label: "Ed Sheeran", query: "Ed Sheeran songs" },
    { label: "Drake", query: "Drake songs" },
    { label: "Billie Eilish", query: "Billie Eilish songs" },
  ],
  punjabi: [
    { label: "AP Dhillon", query: "AP Dhillon punjabi songs" },
    { label: "Sidhu Moose Wala", query: "Sidhu Moose Wala punjabi songs" },
    { label: "Diljit Dosanjh", query: "Diljit Dosanjh punjabi songs" },
    { label: "Karan Aujla", query: "Karan Aujla punjabi songs" },
    { label: "Shubh", query: "Shubh punjabi songs" },
  ],
  tamil: [
    { label: "Anirudh", query: "Anirudh Ravichander tamil songs" },
    { label: "Sid Sriram", query: "Sid Sriram tamil songs" },
    { label: "A.R. Rahman Tamil", query: "A.R. Rahman tamil songs" },
    { label: "Yuvan", query: "Yuvan Shankar Raja tamil songs" },
  ],
  telugu: [
    { label: "Thaman S", query: "Thaman S telugu songs" },
    { label: "DSP", query: "Devi Sri Prasad telugu songs" },
    { label: "Sid Sriram Telugu", query: "Sid Sriram telugu songs" },
  ],
  bengali: [
    { label: "Arijit Bengali", query: "Arijit Singh bengali songs" },
    { label: "Anupam Roy", query: "Anupam Roy bengali songs" },
  ],
  marathi: [
    { label: "Ajay-Atul", query: "Ajay-Atul marathi songs" },
  ],
  korean: [
    { label: "BTS", query: "BTS korean songs" },
    { label: "BLACKPINK", query: "BLACKPINK songs" },
    { label: "NewJeans", query: "NewJeans songs" },
    { label: "Stray Kids", query: "Stray Kids songs" },
  ],
  spanish: [
    { label: "Bad Bunny", query: "Bad Bunny songs" },
    { label: "Shakira", query: "Shakira songs" },
    { label: "Rauw Alejandro", query: "Rauw Alejandro songs" },
  ],
  japanese: [
    { label: "YOASOBI", query: "YOASOBI japanese songs" },
    { label: "Anime OST", query: "anime opening songs japanese" },
    { label: "Kenshi Yonezu", query: "Kenshi Yonezu songs" },
  ],
  urdu: [
    { label: "Atif Aslam", query: "Atif Aslam urdu songs" },
    { label: "Rahat Fateh Ali", query: "Rahat Fateh Ali Khan songs" },
  ],
};

const ARTIST_GRADIENTS = [
  "from-rose-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-lime-500 to-emerald-600",
  "from-sky-500 to-indigo-600",
  "from-red-500 to-rose-600",
  "from-teal-500 to-cyan-600",
];

function getGradient(index: number): string {
  return ARTIST_GRADIENTS[index % ARTIST_GRADIENTS.length];
}

interface QuickPicksProps {
  languages?: Set<string>;
}

function ArtistCard({
  pick,
  index,
  thumbnail,
}: {
  pick: Pick;
  index: number;
  thumbnail: string | null;
}) {
  const router = useRouter();
  const gradient = getGradient(index);

  const handleClick = () => {
    void router.push(`/artist/${slugify(pick.label)}`);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className="group flex w-[110px] flex-shrink-0 flex-col items-center gap-2.5 sm:w-[130px]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={`relative flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full shadow-lg shadow-black/30 transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 sm:h-[116px] sm:w-[116px] ${thumbnail ? "" : `bg-gradient-to-br ${gradient}`}`}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={pick.label}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl font-bold text-white/90 sm:text-4xl">
            {pick.label.charAt(0)}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/20">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 opacity-0 shadow-xl shadow-black/50 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="black">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </span>
        </div>
      </div>
      <span className="text-center text-xs font-semibold text-white sm:text-sm">
        {pick.label}
      </span>
      <span className="-mt-1 text-[10px] font-medium text-zinc-500">
        Artist
      </span>
    </motion.button>
  );
}

async function fetchBatchThumbnails(names: string[]): Promise<Record<string, string | null>> {
  const encoded = encodeURIComponent(names.join(","));
  const res = await fetchWithAuth(`${API_URL}/api/artist/thumbnails?names=${encoded}`);
  if (!res.ok) return {};
  const data = await res.json();
  return (data?.thumbnails as Record<string, string | null>) ?? {};
}

export function QuickPicks({ languages }: QuickPicksProps) {
  const filtered = useMemo(() => {
    if (!languages || languages.size === 0) {
      return [
        ...(PICKS_BY_LANGUAGE["hindi"] ?? []),
        ...(PICKS_BY_LANGUAGE["english"] ?? []),
      ].slice(0, 10);
    }
    const result: Pick[] = [];
    for (const lang of languages) {
      const items = PICKS_BY_LANGUAGE[lang];
      if (items) result.push(...items);
    }
    return result;
  }, [languages]);

  const swrKey = filtered.length > 0
    ? `artist-thumbs:${filtered.map((p) => p.label).join(",")}`
    : null;

  const { data: thumbnails } = useSWR(
    swrKey,
    () => fetchBatchThumbnails(filtered.map((p) => p.label)),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    }
  );

  if (filtered.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Popular Artists</h2>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 sm:-mx-6 sm:gap-5 sm:px-6 lg:-mx-8 lg:px-8">
        {filtered.map((pick, i) => (
          <ArtistCard
            key={pick.label}
            pick={pick}
            index={i}
            thumbnail={thumbnails?.[pick.label] ?? null}
          />
        ))}
      </div>
    </section>
  );
}

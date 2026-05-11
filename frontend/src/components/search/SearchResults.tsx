import { Track } from "@/store";
import { TrackCard } from "@/components/track/TrackCard";
import { TrackSkeleton } from "@/components/track/TrackSkeleton";
import { EmptySearchState } from "./EmptySearchState";
import { motion } from "framer-motion";

interface SearchResultsProps {
  results: Track[];
  loading: boolean;
  error: string | null;
  query?: string;
  onSuggestionClick?: (query: string) => void;
}

export function SearchResults({
  results,
  loading,
  error,
  query,
  onSuggestionClick,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <TrackSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error && results.length === 0 && query && onSuggestionClick) {
    return (
      <EmptySearchState query={query} onSuggestionClick={onSuggestionClick} />
    );
  }

  if (error && results.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-500"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-400">{error}</p>
      </motion.div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-1.5"
      role="list"
    >
      {results.map((track, i) => (
        <motion.div
          key={track.videoId}
          role="listitem"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.03 }}
        >
          <TrackCard track={track} />
        </motion.div>
      ))}
    </motion.div>
  );
}

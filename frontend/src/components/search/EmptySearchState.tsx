import { motion } from "framer-motion";
import { getQuerySuggestions } from "@/services/suggestionsService";

interface Props {
  query: string;
  onSuggestionClick: (query: string) => void;
}

export function EmptySearchState({ query, onSuggestionClick }: Props) {
  const suggestions = getQuerySuggestions(query);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/30"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>

      <h3 className="mb-1 text-base font-medium text-white/80">
        No results for &ldquo;{query}&rdquo;
      </h3>
      <p className="mb-8 text-sm text-white/40">
        Try different keywords or explore these suggestions
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/90"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

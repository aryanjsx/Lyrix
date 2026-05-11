import { motion, AnimatePresence } from "framer-motion";
import type { SearchHistoryEntry } from "@/services/searchHistoryService";

interface Props {
  isVisible: boolean;
  entries: SearchHistoryEntry[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
  highlightedIndex: number;
  trendingSuggestions: string[];
}

const ClockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 text-white/30"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrendingIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 text-white/30"
    aria-hidden="true"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const RemoveIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function SearchHistoryDropdown({
  isVisible,
  entries,
  onSelect,
  onRemove,
  onClearAll,
  highlightedIndex,
  trendingSuggestions,
}: Props) {
  const hasEntries = entries.length > 0;
  const hasTrending = trendingSuggestions.length > 0;

  if (!hasEntries && !hasTrending) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/80 shadow-xl backdrop-blur-xl"
          role="listbox"
          aria-label="Search suggestions"
        >
          {hasEntries && (
            <>
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Recent searches
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onClearAll();
                  }}
                  className="text-xs text-white/40 transition-colors hover:text-white/70"
                >
                  Clear all
                </button>
              </div>

              <div className="py-1">
                {entries.map((entry, index) => (
                  <div
                    key={entry.query}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    className={`group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                      index === highlightedIndex
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                    }`}
                    onClick={() => onSelect(entry.query)}
                  >
                    <ClockIcon />
                    <span className="flex-1 truncate text-sm text-white/80">
                      {entry.query}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemove(entry.query);
                      }}
                      className="-mr-1 rounded p-1 text-white/30 opacity-0 transition-all hover:text-white/70 group-hover:opacity-100"
                      aria-label={`Remove "${entry.query}"`}
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {hasTrending && (
            <>
              <div
                className={`px-4 py-2.5 ${
                  hasEntries ? "border-t border-white/5" : ""
                }`}
              >
                <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Trending
                </span>
              </div>
              <div className="py-1">
                {trendingSuggestions.map((suggestion, i) => {
                  const idx = hasEntries ? entries.length + i : i;
                  return (
                    <div
                      key={suggestion}
                      role="option"
                      aria-selected={idx === highlightedIndex}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                        idx === highlightedIndex
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      }`}
                      onClick={() => onSelect(suggestion)}
                    >
                      <TrendingIcon />
                      <span className="text-sm text-white/60">
                        {suggestion}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

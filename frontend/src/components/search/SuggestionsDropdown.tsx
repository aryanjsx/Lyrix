import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isVisible: boolean;
  suggestions: string[];
  onSelect: (q: string) => void;
  highlightedIndex: number;
}

export function SuggestionsDropdown({
  isVisible,
  suggestions,
  onSelect,
  highlightedIndex,
}: Props) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.12 }}
          className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl overflow-hidden"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <div
              key={s}
              role="option"
              aria-selected={i === highlightedIndex}
              onClick={() => onSelect(s)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                i === highlightedIndex ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/30 flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-sm text-white/80 truncate">{s}</span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

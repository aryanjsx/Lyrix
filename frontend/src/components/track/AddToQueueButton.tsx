import { useCallback, useEffect, useRef, useState } from "react";
import { type Track, useLyrixStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

interface AddToQueueButtonProps {
  track: Track;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const CONFIRM_DURATION_MS = 3000;

export function AddToQueueButton({ track, size = 14, className = "", style }: AddToQueueButtonProps) {
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (added) return;

      addToQueue(track);
      setAdded(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAdded(false), CONFIRM_DURATION_MS);
    },
    [addToQueue, track, added],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative flex flex-shrink-0 items-center justify-center rounded-full p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-purple-400 ${
        added
          ? "text-emerald-400"
          : "text-zinc-600 hover:bg-white/10 hover:text-zinc-300"
      } ${className}`}
      style={style}
      aria-label={added ? "Added to queue" : "Add to queue"}
      title={added ? "Added!" : "Add to queue"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {added ? (
          <motion.svg
            key="check"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <polyline points="20 6 9 17 4 12" />
          </motion.svg>
        ) : (
          <motion.svg
            key="plus"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

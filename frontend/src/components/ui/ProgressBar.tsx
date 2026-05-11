import { useLoadingBarStore } from "@/hooks/useLoadingBar";
import { motion, AnimatePresence } from "framer-motion";

export function ProgressBar() {
  const isLoading = useLoadingBarStore((s) => s.isLoading);
  const progress = useLoadingBarStore((s) => s.progress);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[9999] h-[2px] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {progress > 0 && progress < 100 ? (
            <motion.div
              className="h-full rounded-r-full"
              style={{ background: "var(--color-accent)" }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          ) : (
            <div
              className="progress-bar-indeterminate h-full w-1/3 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

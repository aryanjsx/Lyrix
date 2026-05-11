import { motion, AnimatePresence } from "framer-motion";

const SHORTCUTS = [
  { keys: ["Space"], action: "Play / pause" },
  { keys: ["\u2190"], action: "Rewind 10 seconds" },
  { keys: ["\u2192"], action: "Skip 10 seconds" },
  { keys: ["\u2191"], action: "Volume up" },
  { keys: ["\u2193"], action: "Volume down" },
  { keys: ["M"], action: "Mute / unmute" },
  { keys: ["L"], action: "Like / unlike track" },
  { keys: ["?"], action: "Show this help" },
  { keys: ["Esc"], action: "Close" },
];

export function KeyboardShortcutsOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/90 p-5 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-white/40 transition-colors hover:text-white/70"
                aria-label="Close"
              >
                <i className="ti ti-x text-sm" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2">
              {SHORTCUTS.map(({ keys, action }) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{action}</span>
                  <div className="flex gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded-md border border-white/10 bg-white/10 px-2 py-0.5 font-mono text-xs text-white/70"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-white/25">
              Shortcuts disabled while typing
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

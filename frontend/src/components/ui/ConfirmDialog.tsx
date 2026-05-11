import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onCancel}
      />
      <motion.div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 p-5 bg-black/90 border border-white/10 rounded-2xl backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <h3 className="text-sm font-medium text-white mb-2">{title}</h3>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">
          {description}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              confirmVariant === "destructive"
                ? "bg-red-500/80 hover:bg-red-500 text-white"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {loading ? "Processing\u2026" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </>
  );
}

import { motion, AnimatePresence } from "framer-motion";

interface BannerProps {
  message: string;
  type: "info" | "warning" | "error";
  visible: boolean;
}

const bgColors = {
  info: "bg-blue-600",
  warning: "bg-amber-500",
  error: "bg-red-600",
};

export function Banner({ message, type, visible }: BannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`${bgColors[type]} overflow-hidden text-center text-sm font-medium text-white`}
        >
          <div className="px-4 py-2">{message}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

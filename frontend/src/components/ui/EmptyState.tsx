import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { py: "py-8", iconSize: "text-2xl", iconBox: "w-10 h-10" },
  md: { py: "py-14", iconSize: "text-3xl", iconBox: "w-14 h-14" },
  lg: { py: "py-20", iconSize: "text-4xl", iconBox: "w-16 h-16" },
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className = "",
}: EmptyStateProps) {
  const s = SIZE_MAP[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col items-center text-center ${s.py} px-6 ${className}`}
    >
      <div
        className={`${s.iconBox} mb-5 flex items-center justify-center rounded-2xl border border-white/5 bg-white/5`}
      >
        <i className={`ti ${icon} ${s.iconSize} text-white/25`} aria-hidden="true" />
      </div>

      <h3 className="mb-1.5 text-sm font-medium text-white/70">{title}</h3>
      <p className="mb-6 max-w-xs text-xs leading-relaxed text-white/35">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="flex flex-col items-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition-colors hover:bg-white/90"
            >
              {action.icon && (
                <i className={`ti ${action.icon} text-sm`} aria-hidden="true" />
              )}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="text-xs text-white/35 transition-colors hover:text-white/60"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

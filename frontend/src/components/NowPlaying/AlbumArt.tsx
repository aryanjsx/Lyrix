import { motion, AnimatePresence } from "framer-motion";
import { useLyrixStore } from "@/store";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";

function AudioVisualizer() {
  const isPlaying = useLyrixStore((s) => s.player.status === "playing");
  const bars = ["np-vis-1", "np-vis-2", "np-vis-3", "np-vis-4", "np-vis-5"];

  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 12, marginTop: 16 }}>
      {bars.map((cls) => (
        <span
          key={cls}
          className={`np-visualizer-bar ${cls} ${!isPlaying ? "paused" : ""}`}
        />
      ))}
    </div>
  );
}

export function AlbumArt() {
  const current = useLyrixStore((s) => s.queue.current);
  const isPlaying = useLyrixStore((s) => s.player.status === "playing");

  return (
    <div className="relative flex flex-col items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={current?.videoId ?? "empty"}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative"
          style={{
            width: "100%",
            maxWidth: 320,
          }}
        >
          <div
            className="relative aspect-square overflow-hidden rounded-2xl"
            style={{
              animationName: isPlaying ? "np-breathe" : "none",
              animationDuration: "8s",
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              boxShadow: [
                "0 0 0 1px var(--np-border)",
                "0 40px 80px -20px rgba(0,0,0,0.8)",
                "0 0 60px -10px var(--np-dynamic-glow, rgba(167,139,250,0.2))",
              ].join(", "),
            }}
          >
            {current?.thumbnail ? (
              <TrackThumbnail
                src={current.thumbnail}
                alt={`${current.title} by ${current.channel}`}
                fill
                sizes="(max-width: 768px) 240px, (max-width: 1280px) 280px, 320px"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className="h-full w-full bg-zinc-900" />
            )}
          </div>

          {/* Reflection */}
          {current?.thumbnail && (
            <div className="np-reflection">
              <TrackThumbnail
                src={current.thumbnail}
                alt=""
                fill
                sizes="320px"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AudioVisualizer />
    </div>
  );
}

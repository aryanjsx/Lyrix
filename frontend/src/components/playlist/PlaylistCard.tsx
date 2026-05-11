import Link from "next/link";
import { motion } from "framer-motion";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";

export interface PlaylistCardProps {
  playlist: {
    id: string;
    name: string;
    trackCount: number;
    coverThumbnail: string | null;
    syncEnabled: boolean;
  };
  index?: number;
}

const GRADIENTS = [
  "from-purple-600 to-indigo-700",
  "from-pink-600 to-rose-700",
  "from-teal-600 to-cyan-700",
  "from-orange-600 to-amber-700",
  "from-emerald-600 to-green-700",
  "from-blue-600 to-sky-700",
];

function pickGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function PlaylistCard({ playlist, index = 0 }: PlaylistCardProps) {
  const { id, name, trackCount, coverThumbnail } = playlist;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/playlists/${id}`}
        className="group flex flex-col overflow-hidden rounded-lg bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.08]"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg shadow-black/30">
          {coverThumbnail ? (
            <TrackThumbnail
              src={coverThumbnail}
              alt={`${name} playlist cover`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${pickGradient(id)}`}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 opacity-0 shadow-xl shadow-black/50 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </span>
        </div>
        <div className="mt-3 min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">
            {name}
          </h3>
          <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
            {trackCount} {trackCount === 1 ? "track" : "tracks"}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

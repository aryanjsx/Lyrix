import Link from "next/link";
import { motion } from "framer-motion";
import { useLyrixStore } from "@/store";
import { PlaylistCard } from "./PlaylistCard";

export interface PlaylistGridProps {
  playlists: Array<{
    id: string;
    name: string;
    trackCount: number;
    coverThumbnail: string | null;
    syncEnabled: boolean;
  }>;
  onCreateNew: () => void;
}

function SystemPlaylistCard({
  href,
  name,
  subtitle,
  gradient,
  icon,
  index,
}: {
  href: string;
  name: string;
  subtitle: string;
  gradient: string;
  icon: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href}
        className="group flex flex-col overflow-hidden rounded-lg bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.08]"
      >
        <div className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br ${gradient} shadow-lg shadow-black/30`}>
          {icon}
          <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 opacity-0 shadow-xl shadow-black/50 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </span>
        </div>
        <div className="mt-3 min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{name}</h3>
          <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export function PlaylistGrid({ playlists, onCreateNew }: PlaylistGridProps) {
  const savedCount = useLyrixStore((s) => s.library.savedTrackIds.size);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {/* Create new — first position */}
      <motion.button
        type="button"
        onClick={onCreateNew}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="group flex flex-col overflow-hidden rounded-lg bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.08]"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-zinc-800/60">
          <div className="flex h-full w-full items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-300 transition-colors group-hover:bg-purple-600/30 group-hover:text-purple-300">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </div>
        <div className="mt-3 min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-white">Create playlist</p>
          <p className="mt-0.5 text-xs text-zinc-500">New collection</p>
        </div>
      </motion.button>

      {/* System playlists */}
      <SystemPlaylistCard
        href="/playlists/liked"
        name="Liked Songs"
        subtitle={`${savedCount} ${savedCount === 1 ? "song" : "songs"}`}
        gradient="from-pink-600 to-rose-700"
        icon={
          <svg width="48" height="48" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        }
        index={1}
      />
      <SystemPlaylistCard
        href="/history"
        name="Listening History"
        subtitle="All your played tracks"
        gradient="from-blue-600 to-indigo-700"
        icon={
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        }
        index={2}
      />

      {playlists.map((p, i) => (
        <PlaylistCard key={p.id} playlist={p} index={i + 3} />
      ))}
    </div>
  );
}

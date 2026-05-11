import { motion } from "framer-motion";

interface ArtistHeroProps {
  name: string;
  avatar: string | null;
  bannerImage: string | null;
  trackCount: number;
  onPlayAll: () => void;
  onShuffle: () => void;
  onRadio: () => void;
}

export function ArtistHero({
  name,
  avatar,
  bannerImage,
  trackCount,
  onPlayAll,
  onShuffle,
  onRadio,
}: ArtistHeroProps) {
  return (
    <div className="relative">
      <div className="relative h-56 overflow-hidden sm:h-72">
        {bannerImage ? (
          <>
            <img
              src={bannerImage}
              alt=""
              className="h-full w-full scale-110 object-cover blur-sm"
              style={{ filter: "blur(8px) brightness(0.4)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-purple-900/40 to-black" />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex items-end gap-5 px-6 pb-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex-shrink-0"
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-white/20 shadow-2xl sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-600 ring-2 ring-white/20 shadow-2xl sm:h-24 sm:w-24">
              <span className="text-3xl font-bold text-white">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mb-1 min-w-0 flex-1"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-white/50">
            Artist
          </p>
          <h1 className="truncate text-2xl font-bold leading-tight text-white sm:text-4xl">
            {name}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {trackCount} songs on Lyrix
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="mt-5 flex items-center gap-3 px-6"
      >
        <button
          type="button"
          onClick={onPlayAll}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-white/90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="6,3 20,12 6,21" />
          </svg>
          Play
        </button>

        <button
          type="button"
          onClick={onShuffle}
          className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          Shuffle
        </button>

        <button
          type="button"
          onClick={onRadio}
          className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
            <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
            <circle cx="12" cy="12" r="1" />
          </svg>
          Radio
        </button>
      </motion.div>
    </div>
  );
}

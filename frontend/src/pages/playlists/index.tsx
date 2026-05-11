import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useLyrixStore } from "@/store";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useLibrary } from "@/hooks/useLibrary";
import { PlaylistGrid } from "@/components/playlist/PlaylistGrid";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { LoginButton } from "@/components/auth/LoginButton";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface YouTubePlaylist {
  youtubeId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  trackCount: number;
}

export default function PlaylistsPage() {
  const router = useRouter();
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const displayName = useLyrixStore((s) => s.user.profile?.displayName);
  const syncLibrary = useLyrixStore((s) => s.syncLibrary);
  const { playlists } = useLibrary();
  const [createOpen, setCreateOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [ytPlaylists, setYtPlaylists] = useState<YouTubePlaylist[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!showImport || !isLoggedIn) return;
    let cancelled = false;
    setYtLoading(true);
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/playlists/import/youtube`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setYtPlaylists(Array.isArray(data) ? data : data.playlists ?? []);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setYtLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showImport, isLoggedIn]);

  async function handleImport(yt: YouTubePlaylist) {
    if (importingId) return;
    setImportingId(yt.youtubeId);
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/playlists/import/youtube/${encodeURIComponent(yt.youtubeId)}`,
        { method: "POST" }
      );
      if (res.ok) {
        setImportedIds((prev) => new Set(prev).add(yt.youtubeId));
        await syncLibrary();
      }
    } catch {
      // best-effort
    } finally {
      setImportingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900/50 via-[var(--bg-primary)] to-[var(--bg-primary)]">
      <SiteHeader />

      <main className="px-4 pb-28 pt-6 sm:px-6 sm:pb-8 lg:px-8">
        <motion.div
          className="mb-8 flex items-center justify-between"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Your Library
            </h1>
            {displayName && (
              <p className="mt-1 text-sm text-zinc-400">
                {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
              </p>
            )}
          </div>
          {isLoggedIn && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"/>
                </svg>
                Import from YouTube
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-105 active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Playlist
              </button>
            </div>
          )}
        </motion.div>

        {!isLoggedIn ? (
          <motion.div
            className="mx-auto max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.03] p-10 text-center backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Create your first playlist</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Sign in to create and manage your playlists.
            </p>
            <div className="mt-6 flex justify-center">
              <LoginButton />
            </div>
          </motion.div>
        ) : (
          <PlaylistGrid
            playlists={playlists}
            onCreateNew={() => setCreateOpen(true)}
          />
        )}
      </main>

      <CreatePlaylistModal open={createOpen} onOpenChange={setCreateOpen} />

      {/* YouTube Import Modal */}
      <AnimatePresence>
        {showImport && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImport(false)}
            />
            <motion.div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[70vh] bg-black/90 border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Import from YouTube</h3>
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(70vh-60px)] p-4 space-y-3">
                {ytLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-12 w-12 animate-pulse rounded bg-white/5" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
                          <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ytPlaylists.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    No YouTube playlists found. Make sure your Google account has YouTube playlists.
                  </p>
                ) : (
                  ytPlaylists.map((yt) => {
                    const imported = importedIds.has(yt.youtubeId);
                    return (
                      <div key={yt.youtubeId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                        {yt.thumbnail ? (
                          <img src={yt.thumbnail} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-white/5 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="opacity-30">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{yt.title}</p>
                          <p className="text-xs text-zinc-500">{yt.trackCount} tracks</p>
                        </div>
                        <button
                          type="button"
                          disabled={imported || importingId === yt.youtubeId}
                          onClick={() => handleImport(yt)}
                          className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                            imported
                              ? "bg-green-500/10 text-green-400"
                              : "border border-white/20 text-white hover:border-white/40 disabled:opacity-40"
                          }`}
                        >
                          {imported ? "Imported" : importingId === yt.youtubeId ? "Importing\u2026" : "Import"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

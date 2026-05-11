import { useEffect, useRef, useState } from "react";
import { Track, useLyrixStore } from "@/store";
import { ArtistLink } from "@/components/ui/ArtistLink";
import { submitFeedback } from "@/services/authApi";
import { radioService } from "@/services/radioService";
import { shareService } from "@/services/shareService";
import { SaveButton } from "@/components/track/SaveButton";
import { AddToQueueButton } from "@/components/track/AddToQueueButton";
import { AddToPlaylistMenu } from "@/components/playlist/AddToPlaylistMenu";
import { GuestModal } from "@/components/ui/GuestModal";
import { motion, AnimatePresence } from "framer-motion";
import { formatDuration } from "@/utils/format";

interface TrackCardProps {
  track: Track;
}

type MenuView = "closed" | "main" | "playlists";

export function TrackCard({ track }: TrackCardProps) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const saved = useLyrixStore((s) =>
    s.library.savedTrackIds.has(track.videoId)
  );
  const saveTrackToLibrary = useLyrixStore((s) => s.saveTrackToLibrary);
  const unsaveTrackFromLibrary = useLyrixStore(
    (s) => s.unsaveTrackFromLibrary
  );

  const [menuView, setMenuView] = useState<MenuView>("closed");
  const [guestOpen, setGuestOpen] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackThanks, setFeedbackThanks] = useState(false);
  const [hovered, setHovered] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const isPlaying = currentVideoId === track.videoId;

  const closeMenu = () => setMenuView("closed");

  useEffect(() => {
    if (menuView === "closed") return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuView]);

  const openMainMenu = () => {
    setFeedbackThanks(false);
    setMenuView("main");
  };

  const toggleMenu = () => {
    if (menuView === "closed") openMainMenu();
    else closeMenu();
  };

  return (
    <>
      <motion.div
        className={`relative flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
          isPlaying
            ? "ring-1 ring-purple-400/50"
            : ""
        }`}
        style={{ background: isPlaying ? "var(--bg-surface-hover)" : "var(--bg-surface)" }}
        onClick={() => playTrack(track)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            playTrack(track);
          }
        }}
      >
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded">
          <motion.img
            src={track.thumbnail}
            alt={`${track.title} by ${track.channel}`}
            className="h-full w-full object-cover"
            loading="lazy"
            animate={{ scale: hovered ? 1.05 : 1 }}
            transition={{ duration: 0.15 }}
          />
          {isPlaying && !hovered && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex gap-0.5">
                <span className="inline-block h-3 w-0.5 animate-pulse bg-white" />
                <span className="inline-block h-4 w-0.5 animate-pulse bg-white [animation-delay:0.15s]" />
                <span className="inline-block h-2 w-0.5 animate-pulse bg-white [animation-delay:0.3s]" />
              </div>
            </div>
          )}
          <AnimatePresence>
            {hovered && !isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center bg-black/50"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="white"
                  aria-hidden="true"
                >
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {track.title}
          </h3>
          <ArtistLink
            name={track.channel}
            className="truncate text-xs block"
            style={{ color: "var(--text-secondary)" }}
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                track.category === "music"
                  ? "bg-purple-900/50 text-purple-300"
                  : "bg-teal-900/50 text-teal-300"
              }`}
            >
              {track.category}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {formatDuration(track.duration)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Playing via YouTube
            </span>
            <a
              href={`https://www.youtube.com/watch?v=${track.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-purple-400 hover:text-purple-300"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </a>
          </div>
        </div>

        <div
          className="relative flex flex-shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <AddToQueueButton track={track} />
          <SaveButton track={track} />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu();
              }}
              className="rounded-full p-2 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-400"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Track options"
              aria-expanded={menuView !== "closed"}
              aria-haspopup="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {menuView !== "closed" ? (
              <div
                className="glass-strong absolute right-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-lg py-1 shadow-lg"
                role="menu"
              >
                {menuView === "main" ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue(track);
                        closeMenu();
                      }}
                    >
                      Add to queue
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        radioService.start({
                          type: "track",
                          id: track.videoId,
                          label: track.title,
                        });
                        useLyrixStore.getState().setPlayerContext({
                          type: "radio",
                          label: `Radio — ${track.channel}`,
                        });
                        playTrack(track);
                        radioService.fetchNextBatch().then((tracks) => {
                          tracks.forEach((t) => addToQueue(t));
                        }).catch(() => {});
                        closeMenu();
                      }}
                    >
                      Start radio
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!isLoggedIn) {
                          setGuestOpen(true);
                          closeMenu();
                          return;
                        }
                        try {
                          if (saved) {
                            await unsaveTrackFromLibrary(track.videoId);
                          } else {
                            await saveTrackToLibrary(track);
                          }
                        } catch {
                          /* */
                        }
                        closeMenu();
                      }}
                    >
                      {saved ? "Unsave" : "Save track"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isLoggedIn) {
                          setGuestOpen(true);
                          closeMenu();
                          return;
                        }
                        setMenuView("playlists");
                      }}
                    >
                      Add to playlist
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await shareService.share({
                          videoId: track.videoId,
                          title: track.title,
                          channel: track.channel,
                        });
                        closeMenu();
                      }}
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={feedbackBusy || feedbackThanks}
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (feedbackThanks || feedbackBusy) return;
                        setFeedbackBusy(true);
                        try {
                          await submitFeedback(track.videoId, "not_music");
                          setFeedbackThanks(true);
                          closeMenu();
                        } catch {
                          /* best-effort */
                        } finally {
                          setFeedbackBusy(false);
                        }
                      }}
                    >
                      {feedbackThanks ? "Thanks" : "Not music"}
                    </button>
                    <a
                      role="menuitem"
                      href={`https://www.youtube.com/watch?v=${track.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeMenu();
                      }}
                    >
                      Open on YouTube
                    </a>
                  </>
                ) : (
                  <AddToPlaylistMenu
                    track={track}
                    embedded
                    onAuthRequired={() => setGuestOpen(true)}
                    onBack={() => setMenuView("main")}
                    onDismiss={closeMenu}
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
      <GuestModal open={guestOpen} onOpenChange={setGuestOpen} />
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { ArtistLink } from "@/components/ui/ArtistLink";
import { PlaylistCover } from "@/components/playlist/PlaylistCover";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import * as playlistApi from "@/services/playlistApi";
import type { PlaylistDetailApi, PlaylistTrackApi } from "@/services/playlistApi";
import { searchTracks } from "@/services/api";
import { captureError } from "@/services/telemetry";
import { analytics, EVENTS } from "@/services/analyticsService";
import { useLyrixStore, type Track } from "@/store";
import { PlaylistTrackRow } from "./PlaylistTrackRow";

export interface PlaylistDetailProps {
  playlistId: string;
}

function toStoreTrack(row: PlaylistTrackApi): Track {
  const cat = row.category === "podcast" ? "podcast" : "music";
  return {
    videoId: row.videoId,
    title: row.title,
    channel: row.channel,
    duration: row.duration,
    thumbnail: row.thumbnail,
    category: cat,
    filterScore: row.filterScore,
  };
}

function mapRowForSortable(t: PlaylistTrackApi) {
  return {
    id: t.id,
    trackId: t.videoId,
    position: t.position,
    track: {
      id: t.videoId,
      title: t.title,
      channel: t.channel,
      duration: t.duration,
      thumbnail: t.thumbnail,
    },
  };
}

function formatSearchDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotalDuration(tracks: PlaylistTrackApi[]): string {
  const total = tracks.reduce((sum, t) => sum + t.duration, 0);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} hr ${mins} min`;
  return `${mins} min`;
}

const GRADIENTS = [
  "from-purple-700 to-indigo-900",
  "from-pink-700 to-rose-900",
  "from-teal-700 to-cyan-900",
  "from-orange-700 to-amber-900",
  "from-emerald-700 to-green-900",
  "from-blue-700 to-sky-900",
];

function pickGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const playTrack = useLyrixStore((s) => s.playTrack);
  const addToQueue = useLyrixStore((s) => s.addToQueue);
  const setPlaylistMode = useLyrixStore((s) => s.setPlaylistMode);
  const patchPlaylist = useLyrixStore((s) => s.patchPlaylist);

  const [data, setData] = useState<PlaylistDetailApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [syncing, setSyncing] = useState<"pull" | "export" | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  async function handleShare() {
    try {
      const res = await fetch(`${API_URL}/api/playlists/${playlistId}/share`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const { shareUrl } = await res.json();
        await navigator.clipboard.writeText(shareUrl);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      }
    } catch {
      // best-effort
    }
  }

  async function handleCoverUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await fetch(`${API_URL}/api/playlists/${playlistId}/cover`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ coverImage: base64 }),
        });
        refresh();
      } catch {
        // best-effort
      }
    };
    reader.readAsDataURL(file);
  }

  async function handlePullSync() {
    if (syncing) return;
    setSyncing("pull");
    try {
      const result = await playlistApi.pullFromYouTube(playlistId);
      setSyncToast(`Synced: ${result.addedCount} added, ${result.removedCount} removed`);
      refresh();
    } catch {
      setSyncToast("Sync failed — try again");
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncToast(null), 3000);
    }
  }

  async function handleExportSync() {
    if (syncing) return;
    setSyncing("export");
    try {
      const result = await playlistApi.exportToYouTube(playlistId);
      setSyncToast(`Exported ${result.exportedCount} tracks to YouTube`);
    } catch {
      setSyncToast("Export failed — try again");
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncToast(null), 3000);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const pl = await playlistApi.getPlaylist(playlistId);
      setData(pl);
      setOrder(pl.tracks.map((t) => t.videoId));
      patchPlaylist(playlistId, {
        trackCount: pl.tracks.length,
        coverThumbnail: pl.tracks[0]?.thumbnail ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlist");
      captureError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [playlistId, patchPlaylist]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const pl = await playlistApi.getPlaylist(playlistId);
        if (!cancelled) {
          setData(pl);
          setOrder(pl.tracks.map((t) => t.videoId));
          patchPlaylist(playlistId, {
            trackCount: pl.tracks.length,
            coverThumbnail: pl.tracks[0]?.thumbnail ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load playlist");
          captureError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [playlistId, patchPlaylist]);

  const trackByVideoId = useMemo(() => {
    if (!data) return new Map<string, PlaylistTrackApi>();
    return new Map(data.tracks.map((t) => [t.videoId, t]));
  }, [data]);

  const orderedTracks = useMemo(() => {
    return order
      .map((id) => trackByVideoId.get(id))
      .filter((t): t is PlaylistTrackApi => t != null)
      .map(mapRowForSortable);
  }, [order, trackByVideoId]);

  const existingVideoIds = useMemo(() => new Set(order), [order]);

  const handleSongAdded = useCallback(() => {
    refresh();
  }, [refresh]);

  async function handleDragEnd(event: DragEndEvent) {
    if (isReordering) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as string);
    const newIndex = order.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;

    const prev = order;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);

    setIsReordering(true);
    try {
      const updated = await playlistApi.reorderPlaylistTracks(playlistId, next);
      setData(updated);
      analytics.track(EVENTS.PLAYLIST_REORDERED, {
        playlist_id: playlistId,
        length: next.length,
      });
    } catch (err) {
      setOrder(prev);
      captureError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsReordering(false);
    }
  }

  function handlePlayAll() {
    if (!data?.tracks.length) return;
    const ordered = order
      .map((id) => trackByVideoId.get(id))
      .filter((t): t is PlaylistTrackApi => t != null);
    const storeTracks = ordered.map(toStoreTrack);
    setPlaylistMode(true);
    playTrack(storeTracks[0]);
    storeTracks.slice(1).forEach((t) => addToQueue(t));
    analytics.track(EVENTS.PLAYLIST_PLAY_ALL, { playlist_id: playlistId });
  }

  async function handleRemove(videoId: string) {
    try {
      await playlistApi.removeTrackFromPlaylist(playlistId, videoId);
      const remaining = data?.tracks.filter((t) => t.videoId !== videoId) ?? [];
      setData((d) => d ? { ...d, tracks: remaining } : null);
      setOrder((o) => o.filter((id) => id !== videoId));
      patchPlaylist(playlistId, {
        trackCount: remaining.length,
        coverThumbnail: remaining[0]?.thumbnail ?? null,
      });
      analytics.track(EVENTS.PLAYLIST_TRACK_REMOVED, { playlist_id: playlistId, video_id: videoId });
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const count = data.tracks.length;
  const gradient = pickGradient(playlistId);
  const coverThumb = data.tracks[0]?.thumbnail ?? null;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className={`-mx-4 -mt-6 bg-gradient-to-b ${gradient} to-transparent px-4 pb-8 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8`}>
        <Link
          href="/playlists"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Library
        </Link>

        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
          {/* Cover Art */}
          <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-lg shadow-2xl shadow-black/40 sm:h-52 sm:w-52 group">
            <PlaylistCover
              thumbnails={data.tracks.slice(0, 4).map((t) => t.thumbnail)}
              customCover={data.coverThumbnail}
              size={208}
              className="h-full w-full"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleCoverUpload}
              />
              <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </label>
          </div>

          {/* Info */}
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">Playlist</p>
            {isRenaming ? (
              <form
                className="mt-2 flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmed = renameValue.trim();
                  if (!trimmed || trimmed === data.name) {
                    setIsRenaming(false);
                    return;
                  }
                  try {
                    const updated = await playlistApi.renamePlaylist(playlistId, trimmed);
                    setData(updated);
                    patchPlaylist(playlistId, { name: trimmed });
                  } catch (err) {
                    captureError(err instanceof Error ? err : new Error(String(err)));
                  }
                  setIsRenaming(false);
                }}
              >
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value.slice(0, 100))}
                  maxLength={100}
                  className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-2xl font-bold text-white outline-none backdrop-blur focus:ring-2 focus:ring-white/30 sm:text-4xl"
                  autoFocus
                />
                <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:scale-105">
                  Save
                </button>
                <button type="button" onClick={() => setIsRenaming(false)} className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => { setRenameValue(data.name); setIsRenaming(true); }}
                className="mt-1 text-left outline-none"
              >
                <h1 className="text-3xl font-bold text-white hover:underline sm:text-5xl lg:text-6xl">
                  {data.name}
                </h1>
              </button>
            )}
            {data.description && (
              <p className="mt-2 text-sm text-white/60">{data.description}</p>
            )}
            <p className="mt-3 text-sm text-white/70">
              <span className="font-medium text-white">{count} {count === 1 ? "song" : "songs"}</span>
              {count > 0 && (
                <span className="ml-1 text-white/50">· {formatTotalDuration(data.tracks)}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handlePlayAll}
          disabled={count === 0}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/25 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="black">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setShowAddPanel((v) => !v)}
          className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${
            showAddPanel
              ? "border-green-500 bg-green-500/10 text-green-400"
              : "border-white/20 text-white hover:border-white/40 hover:scale-105"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Songs
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:border-white/30 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {shareToast ? "Link copied!" : "Share"}
        </button>
        {data.youtubePlaylistId && (
          <>
            <button
              type="button"
              onClick={handlePullSync}
              disabled={syncing !== null}
              className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:border-white/30 transition-colors disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              {syncing === "pull" ? "Syncing…" : "Pull from YouTube"}
            </button>
            <button
              type="button"
              onClick={handleExportSync}
              disabled={syncing !== null}
              className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:border-white/30 transition-colors disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              {syncing === "export" ? "Exporting…" : "Export to YouTube"}
            </button>
          </>
        )}
        {syncToast && (
          <span className="text-xs text-green-400">{syncToast}</span>
        )}
      </div>

      {/* Add songs panel */}
      <AnimatePresence>
        {showAddPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AddSongsPanel
              playlistId={playlistId}
              existingIds={existingVideoIds}
              onAdded={handleSongAdded}
              onClose={() => setShowAddPanel(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track list */}
      {count > 0 && (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.02]">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span className="w-8 text-center">#</span>
            <span className="flex-1">Title</span>
            <span className="hidden sm:block">Duration</span>
            <span className="w-8" />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col">
                {orderedTracks.map((row, i) => (
                  <li key={row.trackId}>
                    <PlaylistTrackRow
                      track={row}
                      index={i}
                      onPlay={(videoId) => {
                        const t = trackByVideoId.get(videoId);
                        if (t) playTrack(toStoreTrack(t));
                      }}
                      onRemove={handleRemove}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {count === 0 && !showAddPanel && (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">This playlist is empty</p>
          <p className="mt-1 text-xs text-zinc-600">Use the button above to add songs</p>
        </div>
      )}
    </div>
  );
}

function AddSongsPanel({
  playlistId,
  existingIds,
  onAdded,
  onClose,
}: {
  playlistId: string;
  existingIds: Set<string>;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchTracks(trimmed)
        .then((res) => setResults(res.tracks.slice(0, 10)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleAdd(track: Track) {
    if (addingId) return;
    setAddingId(track.videoId);
    try {
      await playlistApi.addTrackToPlaylist(playlistId, track);
      setAddedIds((prev) => new Set(prev).add(track.videoId));
      onAdded();
      analytics.track(EVENTS.PLAYLIST_TRACK_ADDED, { playlist_id: playlistId, video_id: track.videoId });
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setAddingId(null);
    }
  }

  const alreadyIn = (videoId: string) => existingIds.has(videoId) || addedIds.has(videoId);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-zinc-400">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs to add..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label="Close search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {searching && results.length === 0 && (
          <div className="space-y-2 px-4 py-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded bg-white/[0.06]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No results found</p>
        )}

        {results.map((track) => {
          const added = alreadyIn(track.videoId);
          return (
            <div
              key={track.videoId}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              {track.thumbnail ? (
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                  <TrackThumbnail
                    src={track.thumbnail}
                    alt={track.title}
                    fill
                    sizes="40px"
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div className="h-10 w-10 flex-shrink-0 rounded bg-zinc-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{track.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  <ArtistLink name={track.channel} className="text-zinc-500" /> · {formatSearchDuration(track.duration)}
                </p>
              </div>
              <button
                type="button"
                disabled={added || !!addingId}
                onClick={() => handleAdd(track)}
                className={`flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all ${
                  added
                    ? "bg-green-500/10 text-green-400"
                    : "border border-white/20 text-white hover:border-white/40 hover:scale-105 disabled:opacity-40"
                }`}
              >
                {added ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Added
                  </>
                ) : addingId === track.videoId ? (
                  "Adding..."
                ) : (
                  "Add"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {query.trim().length < 2 && results.length === 0 && !searching && (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          Type to search for songs
        </p>
      )}
    </div>
  );
}

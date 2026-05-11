import { useCallback } from "react";
import { useLyrixStore, type Track } from "@/store";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArtistLink } from "@/components/ui/ArtistLink";

function EqBars() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14, flexShrink: 0 }}>
      {[5, 10, 7].map((h, i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: h,
            background: "var(--np-color-accent, #a78bfa)",
            borderRadius: 1,
            animation: `np-eq 0.8s ease-in-out ${i * 0.2}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function MoveButton({ direction, onClick }: { direction: "up" | "down"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 2,
        color: "rgba(255,255,255,0.3)",
        display: "flex",
        alignItems: "center",
      }}
      aria-label={`Move ${direction}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {direction === "up"
          ? <polyline points="18 15 12 9 6 15" />
          : <polyline points="6 9 12 15 18 9" />}
      </svg>
    </button>
  );
}

export function NowPlayingQueue() {
  const current = useLyrixStore((s) => s.queue.current);
  const upcoming = useLyrixStore((s) => s.queue.upcoming);
  const next = useLyrixStore((s) => s.queue.next);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const removeFromQueue = useLyrixStore((s) => s.removeFromQueue);
  const reorderQueue = useLyrixStore((s) => s.reorderQueue);

  const queueItems: Track[] = [];
  if (next) queueItems.push(next);
  for (const t of upcoming) queueItems.push(t);

  const handleRemove = useCallback((e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    removeFromQueue(videoId);
  }, [removeFromQueue]);

  const handleMove = useCallback((from: number, to: number) => {
    reorderQueue(from, to);
  }, [reorderQueue]);

  if (!current && queueItems.length === 0) {
    return (
      <EmptyState
        icon="ti-playlist-x"
        title="Your queue is empty"
        description="Search for a song or tap any track to start listening."
        size="sm"
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", flex: 1 }}>
      {current && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ position: "relative", width: 36, height: 36, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}>
            {current.thumbnail && (
              <TrackThumbnail
                src={current.thumbnail}
                alt={current.title}
                fill
                sizes="36px"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12,
              color: "var(--np-color-accent, #a78bfa)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2,
            }}>
              {current.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--np-text-hint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {current.channel}
            </div>
          </div>
          <EqBars />
        </div>
      )}

      {queueItems.length > 0 && (
        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, padding: "8px 10px 2px" }}>
          Up next
        </div>
      )}

      {queueItems.map((track, i) => (
        <div
          key={track.videoId + i}
          onClick={() => playTrack(track)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer",
            background: "transparent",
          }}
          className="group"
        >
          <div style={{ position: "relative", width: 36, height: 36, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}>
            {track.thumbnail && (
              <TrackThumbnail
                src={track.thumbnail}
                alt={track.title}
                fill
                sizes="36px"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.82)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2,
            }}>
              {track.title}
            </div>
            <ArtistLink
              name={track.channel}
              className="block"
              style={{ fontSize: 11, color: "var(--np-text-hint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            />
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {i > 0 && <MoveButton direction="up" onClick={() => handleMove(i, i - 1)} />}
            {i < queueItems.length - 1 && <MoveButton direction="down" onClick={() => handleMove(i, i + 1)} />}
            <button
              type="button"
              onClick={(e) => handleRemove(e, track.videoId)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "rgba(255,255,255,0.3)",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Remove from queue"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

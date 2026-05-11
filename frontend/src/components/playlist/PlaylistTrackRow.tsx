import { useSortable } from "@dnd-kit/sortable";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { CSS } from "@dnd-kit/utilities";
import { formatDuration } from "@/utils/format";
import { ArtistLink } from "@/components/ui/ArtistLink";

export interface PlaylistTrackRowProps {
  track: {
    id: string;
    trackId: string;
    position: number;
    track: {
      id: string;
      title: string;
      channel: string;
      duration: number;
      thumbnail: string;
    };
  };
  index?: number;
  onPlay: (videoId: string) => void;
  onRemove: (trackId: string) => void;
}

export function PlaylistTrackRow({
  track,
  index = 0,
  onPlay,
  onRemove,
}: PlaylistTrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.trackId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = track.track;
  const videoId = track.trackId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex touch-manipulation items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-white/[0.06] ${
        isDragging ? "z-10 bg-white/[0.1] ring-1 ring-white/20" : ""
      }`}
    >
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-500 outline-none hover:text-white active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <span className="group-hover:hidden">{index + 1}</span>
        <svg
          className="hidden group-hover:block"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onPlay(videoId)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
          {meta.thumbnail ? (
            <TrackThumbnail
              src={meta.thumbnail}
              alt={`${meta.title} by ${meta.channel}`}
              fill
              sizes="40px"
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="h-full w-full bg-zinc-800" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white group-hover:text-white">
            {meta.title}
          </p>
          <ArtistLink
            name={meta.channel}
            className="truncate text-xs text-zinc-400 block"
          />
        </div>
      </button>

      <span className="hidden text-xs tabular-nums text-zinc-500 sm:block">
        {formatDuration(meta.duration)}
      </span>

      <button
        type="button"
        onClick={() => onRemove(videoId)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 opacity-0 outline-none transition-all hover:text-red-400 group-hover:opacity-100"
        aria-label="Remove from playlist"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2m-1 5v6m-6-6v6M5 6h14l-1 14H6L5 6z" />
        </svg>
      </button>
    </div>
  );
}

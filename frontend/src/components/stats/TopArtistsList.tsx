import { formatListeningTime } from "@/utils/format";

interface Artist {
  channelId: string;
  channelName: string;
  playCount: number;
  totalSeconds: number;
}

interface TopArtistsListProps {
  artists: Artist[];
}

export function TopArtistsList({ artists }: TopArtistsListProps) {
  if (artists.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No artist data yet. Listen to more music to build your profile.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {artists.map((a, i) => (
        <div
          key={a.channelId}
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800/50"
        >
          <span className="w-6 text-right text-sm font-bold text-zinc-500">
            {i + 1}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-200">{a.channelName}</p>
            <p className="text-xs text-zinc-500">
              {a.playCount} plays · {formatListeningTime(a.totalSeconds)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

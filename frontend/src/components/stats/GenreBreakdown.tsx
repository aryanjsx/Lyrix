interface GenreBreakdownProps {
  genres: Array<{ genre: string; playCount: number }>;
}

const GENRE_COLORS = [
  "from-purple-500 to-indigo-500",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-blue-500",
  "from-violet-500 to-purple-500",
  "from-fuchsia-500 to-pink-500",
  "from-lime-500 to-green-500",
];

export function GenreBreakdown({ genres }: GenreBreakdownProps) {
  if (genres.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No genre data yet. Listen to more music to build your profile.
      </p>
    );
  }

  const total = genres.reduce((sum, g) => sum + g.playCount, 0);
  const maxCount = Math.max(...genres.map((g) => g.playCount));

  return (
    <div className="space-y-3">
      {genres.slice(0, 8).map((g, i) => {
        const pct = maxCount > 0 ? (g.playCount / maxCount) * 100 : 0;
        const percentage = total > 0 ? Math.round((g.playCount / total) * 100) : 0;
        const gradient = GENRE_COLORS[i % GENRE_COLORS.length];
        return (
          <div key={g.genre} className="group">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium capitalize text-zinc-200">
                {g.genre}
              </span>
              <span className="text-xs tabular-nums text-zinc-500">
                {g.playCount} plays ({percentage}%)
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

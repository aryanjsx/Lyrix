interface Props {
  streak: number;
  longestStreak: number;
}

export function StreakBadge({ streak, longestStreak }: Props) {
  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20">
      <div className="text-3xl" role="img" aria-label="fire">
        🔥
      </div>
      <div>
        <div className="text-lg font-semibold text-white">
          {streak} day{streak !== 1 ? "s" : ""} in a row
        </div>
        <div className="text-xs text-white/40">
          Longest streak: {longestStreak} days
        </div>
      </div>
    </div>
  );
}

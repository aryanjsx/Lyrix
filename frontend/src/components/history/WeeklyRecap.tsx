import { EmptyState } from "@/components/ui/EmptyState";

export interface WeeklyRecapData {
  totalPlays: number;
  totalMinutes: number;
  topTrack: {
    videoId: string;
    title: string;
    channel: string;
    thumbnail: string;
  } | null;
  weekStart: string;
}

function RecapStat({
  label,
  value,
  icon,
  small = false,
}: {
  label: string;
  value: string;
  icon: string;
  small?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
      <i className={`ti ${icon} text-white/30 text-sm mb-2 block`} />
      <div
        className={`font-medium text-white ${
          small ? "text-xs truncate" : "text-xl"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

export function WeeklyRecap({ recap }: { recap: WeeklyRecapData }) {
  if (!recap.totalPlays) {
    return (
      <EmptyState
        icon="ti-chart-bar-off"
        title="No data this week"
        description="Listen to some music this week to see your recap."
        size="sm"
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <RecapStat
        label="Songs played"
        value={recap.totalPlays.toString()}
        icon="ti-music"
      />
      <RecapStat
        label="Minutes listened"
        value={recap.totalMinutes.toString()}
        icon="ti-clock"
      />
      <RecapStat
        label="Top track"
        value={recap.topTrack?.title ?? "\u2014"}
        icon="ti-star"
        small
      />
    </div>
  );
}

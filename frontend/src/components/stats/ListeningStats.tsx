import { motion } from "framer-motion";
import { formatListeningTime } from "@/utils/format";

interface ListeningStatsProps {
  totalPlays: number;
  totalSeconds: number;
  playsLast7Days: number;
}

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel: string;
  gradient: string;
  delay: number;
}

function StatCard({ value, label, sublabel, gradient, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-5"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06]`} />
      <div className="relative">
        <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
        <p className="mt-1 text-sm font-medium text-zinc-300">{label}</p>
        <p className="text-[11px] text-zinc-600">{sublabel}</p>
      </div>
    </motion.div>
  );
}

export function ListeningStats({
  totalPlays,
  totalSeconds,
  playsLast7Days,
}: ListeningStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        value={totalPlays.toLocaleString()}
        label="Total Plays"
        sublabel="Last 90 days"
        gradient="from-purple-500 to-indigo-500"
        delay={0}
      />
      <StatCard
        value={formatListeningTime(totalSeconds)}
        label="Listening Time"
        sublabel="Last 90 days"
        gradient="from-pink-500 to-rose-500"
        delay={0.1}
      />
      <StatCard
        value={playsLast7Days.toLocaleString()}
        label="This Week"
        sublabel="Last 7 days"
        gradient="from-emerald-500 to-teal-500"
        delay={0.2}
      />
    </div>
  );
}

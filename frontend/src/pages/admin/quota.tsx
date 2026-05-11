import { useEffect, useState } from "react";
import { getQuota, QuotaResponse } from "@/services/api";

function syncStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("fail") || s.includes("error")) {
    return "text-red-600 dark:text-red-400";
  }
  if (s.includes("partial")) {
    return "text-amber-600 dark:text-amber-400";
  }
  if (s.includes("success") || s === "ok" || s === "completed") {
    return "text-green-600 dark:text-green-400";
  }
  return "text-zinc-700 dark:text-zinc-300";
}

const statusColors: Record<string, string> = {
  normal: "text-green-500",
  warning: "text-amber-500",
  restricted: "text-orange-500",
  emergency: "text-red-500",
};

const statusDots: Record<string, string> = {
  normal: "bg-green-500",
  warning: "bg-amber-500",
  restricted: "bg-orange-500",
  emergency: "bg-red-500",
};

export default function QuotaPage() {
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function doFetch() {
      try {
        const data = await getQuota();
        if (!cancelled) {
          setQuota(data);
          setError(null);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch {
        if (!cancelled) setError("Failed to fetch quota data");
      }
    }
    doFetch();
    const interval = setInterval(doFetch, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const percentage = quota ? Math.round((quota.units / quota.max) * 100) : 0;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-white">
          /admin/quota
        </h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {quota && (
          <div className="space-y-6">
            <div className="rounded-lg border border-white/5 p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Today&apos;s Usage
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {quota.units.toLocaleString()}{" "}
                    <span className="text-lg font-normal text-zinc-400">
                      / {quota.max.toLocaleString()} units
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${statusDots[quota.status]}`}
                  />
                  <span
                    className={`text-sm font-semibold capitalize ${statusColors[quota.status]}`}
                  >
                    {quota.status}
                  </span>
                </div>
              </div>

              <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentage >= 98
                      ? "bg-red-500"
                      : percentage >= 90
                        ? "bg-orange-500"
                        : percentage >= 70
                          ? "bg-amber-500"
                          : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-zinc-400">
                {percentage}%
              </p>
            </div>

            <div className="rounded-lg border border-white/5 p-6 shadow">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Threshold Warnings
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {quota.thresholds.WARNING.toLocaleString()} — Warning
                  </span>
                  <span className="text-zinc-400">
                    Reduce non-essential calls
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {quota.thresholds.RESTRICTED.toLocaleString()} — Restricted
                  </span>
                  <span className="text-zinc-400">Search only</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {quota.thresholds.EMERGENCY.toLocaleString()} — Emergency
                  </span>
                  <span className="text-zinc-400">Cached results only</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/5 p-6 shadow">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Sync Operations Today
              </h2>
              {!quota.syncOps?.length ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No sync operations today
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        <th className="py-2 pr-3 font-medium">Time</th>
                        <th className="py-2 pr-3 font-medium">Operation</th>
                        <th className="py-2 pr-3 font-medium">Playlist</th>
                        <th className="py-2 pr-3 font-medium">User</th>
                        <th className="py-2 pr-3 font-medium tabular-nums">Tracks</th>
                        <th className="py-2 pr-3 font-medium tabular-nums">Quota</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quota.syncOps.map((op) => (
                        <tr
                          key={op.id}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                            {new Date(op.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">
                            {op.operation}
                          </td>
                          <td className="max-w-[140px] truncate py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                            {op.playlistName}
                          </td>
                          <td className="max-w-[160px] truncate py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                            {op.userEmail}
                          </td>
                          <td className="py-2 pr-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                            {op.trackCount}
                          </td>
                          <td className="py-2 pr-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                            {op.quotaUsed}
                          </td>
                          <td
                            className={`py-2 font-medium ${syncStatusClass(op.status)}`}
                          >
                            {op.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-white/5 p-6 shadow">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Top Quota Consumers
              </h2>
              {!quota.topConsumers?.length ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No consumer data for today yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {quota.topConsumers.map((c) => (
                    <li
                      key={c.userId}
                      className="flex justify-between gap-4 border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800"
                    >
                      <code className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                        {c.userId}
                      </code>
                      <span className="shrink-0 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                        {c.totalQuotaUsed.toLocaleString()} units
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-center text-xs text-zinc-400">
              Last updated: {lastUpdated} (auto-refreshes every 30s)
            </p>
          </div>
        )}

        {!quota && !error && (
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>
        )}
      </div>
    </div>
  );
}

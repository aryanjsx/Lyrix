import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { useLyrixStore, type Track } from "@/store";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ListeningStats } from "@/components/stats/ListeningStats";
import { GenreBreakdown } from "@/components/stats/GenreBreakdown";
import { TopArtistsList } from "@/components/stats/TopArtistsList";
import { LoginButton } from "@/components/auth/LoginButton";
import { TrackThumbnail } from "@/components/ui/TrackThumbnail";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StreakBadge } from "@/components/history/StreakBadge";
import { WeeklyRecap, type WeeklyRecapData } from "@/components/history/WeeklyRecap";
import { fetchWithAuth } from "@/services/fetchWithAuth";
import {
  fetchStats,
  type UserStats,
} from "@/services/recommendationApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface HistoryPlay {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  category: string;
  playedAt: string;
  secondsPlayed: number;
}

interface DayGroup {
  label: string;
  dateKey: string;
  plays: HistoryPlay[];
}

function groupByDay(plays: HistoryPlay[]): DayGroup[] {
  const groups = new Map<string, HistoryPlay[]>();

  for (const play of plays) {
    const d = new Date(play.playedAt);
    const dateKey = d.toISOString().slice(0, 10);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(play);
    } else {
      groups.set(dateKey, [play]);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return Array.from(groups.entries()).map(([dateKey, dayPlays]) => {
    let label: string;
    if (dateKey === today) {
      label = "Today";
    } else if (dateKey === yesterday) {
      label = "Yesterday";
    } else {
      label = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
    return { label, dateKey, plays: dayPlays };
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const isLoggedIn = useLyrixStore((s) => s.user.isLoggedIn);
  const playTrack = useLyrixStore((s) => s.playTrack);
  const currentVideoId = useLyrixStore((s) => s.queue.current?.videoId);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [historyPlays, setHistoryPlays] = useState<HistoryPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "stats">("history");
  const [showConfirm, setShowConfirm] = useState(false);
  const [streakData, setStreakData] = useState<{ currentStreak: number; longestStreak: number } | null>(null);
  const [weeklyRecap, setWeeklyRecap] = useState<WeeklyRecapData | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStats();
        if (!cancelled) {
          setStats(data);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load stats");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/history/tracks?limit=200`);
        if (res.ok) {
          const data = (await res.json()) as { plays: HistoryPlay[] };
          if (!cancelled) {
            setHistoryPlays(data.plays);
            setHistoryLoading(false);
          }
        } else {
          if (!cancelled) setHistoryLoading(false);
        }
      } catch {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const [streakRes, recapRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/history/streak`),
          fetchWithAuth(`${API_URL}/api/history/weekly-recap`),
        ]);
        if (streakRes.ok && !cancelled) {
          setStreakData(await streakRes.json());
        }
        if (recapRes.ok && !cancelled) {
          setWeeklyRecap(await recapRes.json());
        }
      } catch {
        // best-effort
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <div className="rounded-xl border border-white/10 p-8 text-center">
            <h1 className="mb-2 text-lg font-semibold text-zinc-100">Your History</h1>
            <p className="text-sm text-zinc-400">
              Sign in to see your listening history, genre breakdown, and top artists.
            </p>
            <div className="mt-4 flex justify-center">
              <LoginButton />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handlePlayFromHistory = (play: HistoryPlay) => {
    const track: Track = {
      videoId: play.videoId,
      title: play.title,
      channel: play.channel,
      duration: play.duration,
      thumbnail: play.thumbnail,
      category: play.category as "music" | "podcast",
    };
    playTrack(track);
  };

  const dayGroups = groupByDay(historyPlays);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 pb-28 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Listening History</h1>
          {historyPlays.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="text-xs text-white/30 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear history
            </button>
          )}
        </div>

        {showConfirm && (
          <ConfirmDialog
            title="Clear listening history?"
            description="This removes all your play history permanently. Your liked songs and playlists are not affected."
            confirmLabel="Clear history"
            confirmVariant="destructive"
            onConfirm={async () => {
              await fetchWithAuth(`${API_URL}/api/history`, { method: "DELETE" });
              setHistoryPlays([]);
              setShowConfirm(false);
            }}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-white text-black"
                : "bg-white/[0.07] text-white hover:bg-white/[0.12]"
            }`}
          >
            Recent Plays
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === "stats"
                ? "bg-white text-black"
                : "bg-white/[0.07] text-white hover:bg-white/[0.12]"
            }`}
          >
            Stats
          </button>
        </div>

        {activeTab === "history" ? (
          <>
          {streakData && streakData.currentStreak > 0 && (
            <div className="mb-4">
              <StreakBadge streak={streakData.currentStreak} longestStreak={streakData.longestStreak} />
            </div>
          )}
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <div className="h-10 w-10 animate-pulse rounded-md bg-zinc-800" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : historyPlays.length === 0 ? (
            <EmptyState
              icon="ti-clock-off"
              title="No listening history yet"
              description="Songs you play will appear here so you can find them again."
              action={{
                label: "Start listening",
                icon: "ti-player-play",
                onClick: () => router.push("/"),
              }}
              size="lg"
            />
          ) : (
            <div className="space-y-6">
              {dayGroups.map((group) => (
                <section key={group.dateKey}>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-400">{group.label}</h3>
                  <div className="space-y-1">
                    {group.plays.map((play, i) => {
                      const isActive = currentVideoId === play.videoId;
                      const time = new Date(play.playedAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      });
                      return (
                        <button
                          key={`${play.videoId}-${play.playedAt}`}
                          type="button"
                          onClick={() => handlePlayFromHistory(play)}
                          className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                            isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md">
                            {play.thumbnail ? (
                              <TrackThumbnail
                                src={play.thumbnail}
                                alt={play.title}
                                fill
                                sizes="40px"
                                style={{ objectFit: "cover" }}
                              />
                            ) : (
                              <div className="h-full w-full bg-zinc-800" />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                <polygon points="6,3 20,12 6,21" />
                              </svg>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium ${isActive ? "text-purple-400" : "text-white"}`}>
                              {play.title}
                            </p>
                            <p className="truncate text-xs text-zinc-400">{play.channel}</p>
                          </div>
                          <span className="flex-shrink-0 text-xs text-zinc-500">{time}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
          </>
        ) : loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-zinc-800"
                />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-xl bg-zinc-800" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : stats ? (
          stats.totalPlays < 5 ? (
            <EmptyState
              icon="ti-chart-bar-off"
              title="Not enough data yet"
              description="Listen to at least 5 songs to see your listening stats."
              secondaryAction={{
                label: "Go to Recent Plays",
                onClick: () => setActiveTab("history"),
              }}
              size="md"
            />
          ) : (
            <div className="space-y-8">
              {weeklyRecap && <WeeklyRecap recap={weeklyRecap} />}

              <ListeningStats
                totalPlays={stats.totalPlays}
                totalSeconds={stats.totalSeconds}
                playsLast7Days={stats.playsLast7Days}
              />

              <section>
                <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                  Genre Breakdown
                </h2>
                <GenreBreakdown genres={stats.genreBreakdown} />
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                  Top Artists
                </h2>
                <TopArtistsList artists={stats.artistBreakdown} />
              </section>

              {stats.topTracksThisMonth &&
                stats.topTracksThisMonth.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                      Top Tracks This Month
                    </h2>
                    <div className="space-y-1">
                      {stats.topTracksThisMonth.map((t, i) => (
                        <div
                          key={t.videoId}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800/50"
                        >
                          <span className="w-6 text-right text-sm font-bold text-zinc-500">
                            {i + 1}
                          </span>
                          {t.thumbnail ? (
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
                              <Image
                                src={t.thumbnail}
                                alt={`${t.title} by ${t.channel}`}
                                fill
                                sizes="40px"
                                placeholder="blur"
                                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                                style={{ objectFit: "cover" }}
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded bg-zinc-800" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-200">
                              {t.title}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {t.channel}
                            </p>
                          </div>
                          <span className="text-xs text-zinc-400">
                            {t.playCount}{" "}
                            {t.playCount === 1 ? "play" : "plays"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              <section>
                <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                  Listening Streak
                </h2>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
                  {stats.currentStreak > 0 ? (
                    <>
                      <p className="text-3xl font-bold text-amber-400">
                        {stats.currentStreak}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {stats.currentStreak === 1 ? "day" : "day streak"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No streak yet — listen today to start one!
                    </p>
                  )}
                </div>
              </section>
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}

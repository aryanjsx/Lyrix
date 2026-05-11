import { analytics, EVENTS } from "./analyticsService";
import * as Sentry from "@sentry/nextjs";

interface PendingPlay {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  category: string;
  filterScore: number;
  source: string;
  queuePosition: number;
  isPreloaded: boolean;
  clickedAt: number;
  loadStartAt: number;
}

interface ActiveBuffer {
  videoId: string;
  startedAt: number;
  networkType: string;
  positionSeconds: number;
}

let pending: PendingPlay | null = null;
let activeBuffer: ActiveBuffer | null = null;

const sessionStats = {
  totalPlays: 0,
  bufferEvents: 0,
  errorEvents: 0,
  sessionStart: Date.now(),
};

function getNetworkType(): string {
  try {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    return nav.connection?.effectiveType ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const playbackMetrics = {
  onTrackClicked(
    track: {
      videoId: string;
      title: string;
      channel: string;
      duration: number;
      category: string;
      filterScore: number;
    },
    context: {
      source: string;
      queuePosition: number;
      isPreloaded: boolean;
    }
  ) {
    try {
      pending = {
        ...track,
        ...context,
        clickedAt: performance.now(),
        loadStartAt: performance.now(),
      };
    } catch {
      // never throw
    }
  },

  onLoadVideoById(videoId: string) {
    try {
      if (pending?.videoId === videoId) {
        pending.loadStartAt = performance.now();
      }
    } catch {
      // never throw
    }
  },

  onFirstPlay(videoId: string) {
    try {
      if (!pending || pending.videoId !== videoId) return;

      const loadTimeMs = Math.round(performance.now() - pending.loadStartAt);
      const clickToPlayMs = Math.round(performance.now() - pending.clickedAt);

      sessionStats.totalPlays++;

      analytics.track(EVENTS.PLAYBACK_STARTED, {
        video_id: pending.videoId,
        title: pending.title,
        channel: pending.channel,
        duration_seconds: pending.duration,
        category: pending.category,
        filter_score: pending.filterScore,
        load_time_ms: loadTimeMs,
        click_to_play_ms: clickToPlayMs,
        source: pending.source,
        queue_position: pending.queuePosition,
        is_preloaded: pending.isPreloaded,
        network_type: getNetworkType(),
        meets_2s_target: loadTimeMs < 2000,
      });

      if (loadTimeMs > 5000) {
        Sentry.captureMessage("Playback start time exceeded 5s", {
          level: "warning",
          extra: {
            videoId,
            loadTimeMs,
            clickToPlayMs,
            networkType: getNetworkType(),
          },
          tags: { metric: "playback_start_time", kpi: "failed" },
        });
      }

      pending = null;
    } catch {
      // never throw
    }
  },

  onBufferingStart(videoId: string, positionSeconds: number) {
    try {
      if (sessionStats.totalPlays === 0) return;

      activeBuffer = {
        videoId,
        startedAt: performance.now(),
        networkType: getNetworkType(),
        positionSeconds,
      };

      analytics.track(EVENTS.PLAYBACK_BUFFERING, {
        video_id: videoId,
        buffer_start_position_s: positionSeconds,
        network_type: getNetworkType(),
      });
    } catch {
      // never throw
    }
  },

  onBufferingEnd(videoId: string) {
    try {
      if (!activeBuffer || activeBuffer.videoId !== videoId) return;

      const bufferDurationMs = Math.round(
        performance.now() - activeBuffer.startedAt
      );

      sessionStats.bufferEvents++;

      analytics.track(EVENTS.PLAYBACK_BUFFER_END, {
        video_id: videoId,
        buffer_duration_ms: bufferDurationMs,
        network_type: activeBuffer.networkType,
        position_seconds: activeBuffer.positionSeconds,
        exceeds_2s: bufferDurationMs > 2000,
        session_buffer_rate:
          sessionStats.totalPlays > 0
            ? sessionStats.bufferEvents / sessionStats.totalPlays
            : 0,
      });

      if (bufferDurationMs > 10000) {
        Sentry.captureMessage("Long buffer event: >10s", {
          level: "warning",
          extra: {
            videoId,
            bufferDurationMs,
            networkType: activeBuffer.networkType,
          },
          tags: { metric: "buffer_duration" },
        });
      }

      activeBuffer = null;
    } catch {
      // never throw
    }
  },

  onPlayerError(
    videoId: string,
    errorCode: number,
    retryCount: number,
    wasFatal: boolean
  ) {
    try {
      sessionStats.errorEvents++;

      const errorReasons: Record<number, string> = {
        2: "invalid_video_id",
        5: "html5_player_error",
        100: "video_not_found",
        101: "embedding_not_allowed",
        150: "embedding_not_allowed",
      };

      const errorRate =
        sessionStats.totalPlays > 0
          ? sessionStats.errorEvents / sessionStats.totalPlays
          : 0;

      analytics.track(EVENTS.PLAYER_ERROR, {
        video_id: videoId,
        error_code: errorCode,
        error_reason: errorReasons[errorCode] ?? "unknown",
        retry_count: retryCount,
        was_fatal: wasFatal,
        session_error_rate: errorRate,
        exceeds_1pct_target: errorRate > 0.01,
      });

      Sentry.captureEvent({
        message: `YouTube player error ${errorCode}`,
        level: wasFatal ? "error" : "warning",
        extra: { videoId, errorCode, retryCount, wasFatal, errorRate },
        tags: {
          metric: "player_error_rate",
          error_code: errorCode.toString(),
          was_fatal: wasFatal.toString(),
        },
      });
    } catch {
      // never throw
    }
  },

  onTrackCompleted(
    videoId: string,
    durationSeconds: number,
    playedSeconds: number
  ) {
    try {
      analytics.track(EVENTS.PLAYBACK_COMPLETED, {
        video_id: videoId,
        duration_seconds: durationSeconds,
        played_seconds: playedSeconds,
        completion_rate:
          durationSeconds > 0 ? playedSeconds / durationSeconds : 0,
      });
    } catch {
      // never throw
    }
  },

  getSessionStats() {
    return { ...sessionStats };
  },
};

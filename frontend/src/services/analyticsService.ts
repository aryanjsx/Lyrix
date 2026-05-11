import posthog from "posthog-js";

export const EVENTS = {
  PLAYBACK_STARTED: "playback_started",
  PLAYBACK_PAUSED: "playback_paused",
  PLAYBACK_RESUMED: "playback_resumed",
  PLAYBACK_COMPLETED: "playback_completed",
  PLAYBACK_SKIPPED: "playback_skipped",
  PLAYBACK_ERROR: "playback_error",
  PLAYBACK_BUFFERING: "playback_buffering",
  PLAYBACK_BUFFER_END: "playback_buffer_end",
  TRACK_CHANGED: "track_changed",

  SEARCH_PERFORMED: "search_performed",
  SEARCH_RESULT_CLICKED: "search_result_clicked",
  SEARCH_NO_RESULTS: "search_no_results",
  SEARCH_CACHE_HIT: "search_cache_hit",
  SEARCH_CACHE_MISS: "search_cache_miss",

  QUEUE_TRACK_ADDED: "queue_track_added",
  QUEUE_SHUFFLED: "queue_shuffled",
  QUEUE_EXHAUSTED: "queue_exhausted",
  RADIO_STARTED: "radio_started",

  LOGIN_INITIATED: "login_initiated",
  LOGIN_COMPLETED: "login_completed",
  LOGIN_FAILED: "login_failed",
  LOGOUT: "logout",
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_SKIPPED: "onboarding_skipped",

  TRACK_LIKED: "track_liked",
  TRACK_UNLIKED: "track_unliked",
  PLAYLIST_CREATED: "playlist_created",
  PLAYLIST_TRACK_ADDED: "playlist_track_added",
  PLAYLIST_REORDERED: "playlist_reordered",
  PLAYLIST_PLAY_ALL: "playlist_play_all",
  PLAYLIST_TRACK_REMOVED: "playlist_track_removed",

  PLAYER_ERROR: "player_error",
  API_ERROR: "api_error",
  QUOTA_WARNING: "quota_warning",
  QUOTA_EMERGENCY: "quota_emergency",

  NETWORK_OFFLINE: "network_offline",
  WEB_VITAL: "web_vital",

  PAGE_LOAD: "page_load",
  HOME_DATA_LOADED: "home_data_loaded",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

let _context: Record<string, unknown> = {};

export const analytics = {
  init(isAuthenticated: boolean) {
    if (typeof window === "undefined") return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage+cookie",
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.opt_out_capturing();
        }
      },
    });

    _context = {
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
      platform: "web",
      network_type: getNetworkType(),
      is_authenticated: isAuthenticated,
      session_id: getOrCreateSessionId(),
    };
  },

  identify(userId: string) {
    try {
      posthog.identify(userId);
    } catch {
      // never break the app
    }
  },

  reset() {
    try {
      posthog.reset();
      _context.is_authenticated = false;
    } catch {
      // never break the app
    }
  },

  track(event: EventName, props?: Record<string, unknown>) {
    if (typeof window === "undefined") return;
    try {
      posthog.capture(event, { ..._context, ...props });
    } catch (err) {
      console.warn("[analytics] capture failed:", err);
    }
  },

  updateNetworkType(type: string) {
    _context.network_type = type;
  },

  page(pageName: string, loadTimeMs?: number) {
    this.track(EVENTS.PAGE_LOAD, {
      page: pageName,
      load_time_ms: loadTimeMs,
    });
  },
};

function getNetworkType(): string {
  try {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    return nav.connection?.effectiveType ?? "unknown";
  } catch {
    return "unknown";
  }
}

function getOrCreateSessionId(): string {
  const key = "lyrix_analytics_session";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return "unknown";
  }
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimiter";
import { getRedisClient, isRedisAvailable, getCacheStats, cacheDel } from "./services/cacheService";
import { getTodayQuota, prisma } from "./services/quotaService";
import { initTelemetry, Sentry } from "./services/telemetry";
import { warmCache } from "./services/warmCache";
import searchRouter from "./routes/search";
import searchHistoryRouter from "./routes/searchHistory";
import trackRouter from "./routes/track";
import authRouter from "./routes/auth";
import historyRouter from "./routes/history";
import feedbackRouter from "./routes/feedback";
import playlistsRouter from "./routes/playlists";
import savedTracksRouter from "./routes/savedTracks";
import recommendationsRouter from "./routes/recommendations";
import statsRouter from "./routes/stats";
import lyricsRouter from "./routes/lyrics";
import preferencesRouter from "./routes/preferences";
import artistRouter from "./routes/artist";
import homepageRouter from "./routes/homepage";
import similarRouter from "./routes/similar";
import timeAwareRouter from "./routes/timeAware";
import dailyMixesRouter from "./routes/dailyMixes";
import radioRouter from "./routes/radio";
import onboardingRouter from "./routes/onboarding";
import collectionRouter from "./routes/collection";
import searchSuggestionsRouter from "./routes/searchSuggestions";
import { startCacheWarmer } from "./jobs/cacheWarmer";


initTelemetry();

const app = express();

const allowedOrigins = [
  config.frontendUrl,
  "https://elyrix.vercel.app",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://www.youtube.com",
          "https://s.ytimg.com",
          "https://app.posthog.com",
          "https://browser.sentry-cdn.com",
        ],
        frameSrc: [
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://img.youtube.com",
          "https://i.ytimg.com",
          "https://lh3.googleusercontent.com",
        ],
        connectSrc: [
          "'self'",
          "https://app.posthog.com",
          "https://*.ingest.sentry.io",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser(config.cookieSecret));
app.set("trust proxy", 1);
app.use(generalLimiter);

getRedisClient();

interface CheckResult {
  status: "ok" | "slow" | "down";
  latency_ms: number;
  error?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    return { status: latency > 500 ? "slow" : "ok", latency_ms: latency };
  } catch (err: unknown) {
    return { status: "down", latency_ms: -1, error: (err as Error).message };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    if (!client || !isRedisAvailable()) {
      return { status: "down", latency_ms: -1, error: "Not connected" };
    }
    await client.ping();
    const latency = Date.now() - start;
    return { status: latency > 100 ? "slow" : "ok", latency_ms: latency };
  } catch (err: unknown) {
    return { status: "down", latency_ms: -1, error: (err as Error).message };
  }
}

async function checkYouTubeQuota(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const quota = await getTodayQuota();
    const pct = quota.units / 10000;
    const result: CheckResult = {
      status: pct > 0.98 ? "down" : pct > 0.90 ? "slow" : "ok",
      latency_ms: Date.now() - start,
    };
    if (pct > 0.80) {
      result.error = `Quota at ${Math.round(pct * 100)}%`;
    }
    return result;
  } catch (err: unknown) {
    return { status: "slow", latency_ms: -1, error: (err as Error).message };
  }
}

async function healthCheck(_req: import("express").Request, res: import("express").Response) {
  const TIMEOUT_MS = 150;

  const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), TIMEOUT_MS)),
    ]);

  const downFallback: CheckResult = { status: "down", latency_ms: -1, error: "Timeout" };

  const [dbResult, redisResult, ytResult] = await Promise.all([
    withTimeout(checkDatabase(), downFallback),
    withTimeout(checkRedis(), downFallback),
    withTimeout(checkYouTubeQuota(), downFallback),
  ]);

  const isHealthy = dbResult.status !== "down" && redisResult.status !== "down";
  const isDegraded =
    dbResult.status === "slow" ||
    redisResult.status === "slow" ||
    ytResult.status === "down";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? (isDegraded ? "degraded" : "healthy") : "unhealthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
    checks: {
      database: dbResult.status,
      redis: redisResult.status,
      youtube: ytResult.status,
    },
  });
}

app.get("/", healthCheck);
app.get("/health", healthCheck);

app.post("/admin/quota/reset", async (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!config.adminApiKey || adminKey !== config.adminApiKey) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    await prisma.apiQuota.upsert({
      where: { date: today },
      create: { date: today, units: 0 },
      update: { units: 0 },
    });
    res.json({ success: true, message: "Quota reset to 0 for today" });
  } catch (err) {
    console.error("[Admin] Quota reset failed:", err);
    res.status(500).json({ error: "Failed to reset quota" });
  }
});

app.get("/admin/quota", async (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!config.adminApiKey || adminKey !== config.adminApiKey) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const quota = await getTodayQuota();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const syncOpsToday = await prisma.syncLog.findMany({
      where: { createdAt: { gte: todayStart } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { email: true, displayName: true } },
        playlist: { select: { name: true } },
      },
    });

    const topConsumers = await prisma.syncLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: todayStart }, userId: { not: null } },
      _sum: { quotaUsed: true },
      orderBy: { _sum: { quotaUsed: "desc" } },
      take: 5,
    });

    res.json({
      ...quota,
      syncOps: syncOpsToday.map((s) => ({
        id: s.id,
        operation: s.operation,
        playlistName: s.playlist?.name ?? "(deleted)",
        userEmail: s.user?.email ?? "(deleted)",
        trackCount: s.trackCount,
        quotaUsed: s.quotaUsed,
        status: s.status,
        error: s.error,
        createdAt: s.createdAt,
      })),
      topConsumers: topConsumers
        .filter((c) => c.userId != null)
        .map((c) => ({
          userId: c.userId as string,
          totalQuotaUsed: c._sum.quotaUsed ?? 0,
        })),
      cache: getCacheStats(),
    });
  } catch (err) {
    console.error("[Quota] Error:", err);
    res.status(500).json({ error: "Failed to fetch quota" });
  }
});

app.use("/api/search", searchHistoryRouter);
app.use("/api/search", searchRouter);
app.use("/api/track", trackRouter);
app.use("/api/auth", authRouter);
app.use("/api/history", historyRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/playlists", playlistsRouter);
app.use("/api/saved", savedTracksRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/lyrics", lyricsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/artist", artistRouter);
app.use("/api/homepage", homepageRouter);
app.use("/api/similar", similarRouter);
app.use("/api/recommendations/time-aware", timeAwareRouter);
app.use("/api/mixes/daily", dailyMixesRouter);
app.use("/api/radio", radioRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/search", searchSuggestionsRouter);


Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[Lyrix] Backend running on port ${config.port}`);
  console.log(`[Lyrix] Environment: ${config.nodeEnv}`);
  cacheDel("*reco:morelike:*").then(() => {
    console.log("[Lyrix] Cleared stale similar tracks cache");
  }).catch(() => {});
  warmCache().catch((err) => console.warn("[Cache Warm] Failed:", err));
  startCacheWarmer();
});

function gracefulShutdown(signal: string) {
  console.log(`[Lyrix] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    prisma.$disconnect().then(() => {
      console.log("[Lyrix] Database disconnected");
      process.exit(0);
    }).catch(() => process.exit(0));
  });
  setTimeout(() => {
    console.warn("[Lyrix] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

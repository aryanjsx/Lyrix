import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:4000/api/auth/callback",

  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  cookieSecret: process.env.COOKIE_SECRET ?? "",
  adminApiKey: process.env.ADMIN_API_KEY ?? "",
} as const;

if (!config.youtubeApiKey || config.youtubeApiKey === "your_new_key_here") {
  console.warn(
    "WARNING: YOUTUBE_API_KEY is not set. YouTube API calls will fail."
  );
}

if (!config.jwtSecret) {
  if (config.nodeEnv === "production") {
    throw new Error(
      "FATAL: JWT_SECRET is not set. Refusing to start in production without a signing secret."
    );
  }
  console.warn(
    "WARNING: JWT_SECRET is not set. Auth will not work."
  );
}

if (!config.adminApiKey && config.nodeEnv === "production") {
  console.warn(
    "WARNING: ADMIN_API_KEY is not set. Admin endpoints will be inaccessible."
  );
}

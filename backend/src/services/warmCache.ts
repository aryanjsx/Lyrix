import { getTrending } from "./trendingService";

export async function warmCache(): Promise<void> {
  console.info("[Cache Warm] Starting...");

  try {
    const trending = await getTrending();
    console.info(`[Cache Warm] Trending: ${trending.length} tracks cached`);
  } catch {
    console.warn("[Cache Warm] Trending failed — will load on first request");
  }

  console.info("[Cache Warm] Complete");
}

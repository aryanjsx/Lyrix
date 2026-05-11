import { prisma } from "../lib/prisma";

async function cleanupExpiredLyrics(): Promise<void> {
  const deleted = await prisma.trackLyrics.deleteMany({
    where: { source: "none", expiresAt: { lt: new Date() } },
  });
  console.info(`[Cleanup] Removed ${deleted.count} expired not-found lyrics entries`);
}

async function cleanupOldHistory(): Promise<void> {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.playHistory.deleteMany({
    where: { playedAt: { lt: cutoff } },
  });
  console.info(`[Cleanup] Removed ${deleted.count} old PlayHistory entries (>365 days)`);
}

async function cleanupProcessedFeedback(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.feedbackLog.deleteMany({
    where: { processed: true, createdAt: { lt: cutoff } },
  });
  console.info(`[Cleanup] Removed ${deleted.count} processed feedback entries (>30 days)`);
}

async function cleanupExpiredRecommendations(): Promise<void> {
  const deleted = await prisma.recommendationCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  console.info(`[Cleanup] Removed ${deleted.count} expired recommendation cache entries`);
}

async function cleanupExpiredMixes(): Promise<void> {
  const deleted = await prisma.smartMix.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  console.info(`[Cleanup] Removed ${deleted.count} expired smart mix entries`);
}

async function main() {
  console.info("[Cleanup] Starting daily cleanup...");
  const start = Date.now();

  await cleanupExpiredLyrics();
  await cleanupOldHistory();
  await cleanupProcessedFeedback();
  await cleanupExpiredRecommendations();
  await cleanupExpiredMixes();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.info(`[Cleanup] Complete in ${elapsed}s`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Cleanup] Fatal error:", err);
  process.exit(1);
});

import { prisma } from "../services/quotaService";
import { rebuildUserProfile } from "../services/analysisService";

async function main() {
  console.log("[rebuildProfiles] Starting batch profile rebuild...");

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const activeUserIds = await prisma.playHistory.findMany({
    where: { playedAt: { gte: ninetyDaysAgo } },
    distinct: ["userId"],
    select: { userId: true },
  });
  const users = activeUserIds.map((r) => ({ id: r.userId }));
  console.log(
    `[rebuildProfiles] Found ${users.length} active users (PlayHistory in last 90 days, matching analysis window; since ${ninetyDaysAgo.toISOString()})`
  );

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await rebuildUserProfile(user.id);
      success++;
      if (success % 10 === 0) {
        console.log(`[rebuildProfiles] Progress: ${success}/${users.length}`);
      }
    } catch (err) {
      failed++;
      console.error(`[rebuildProfiles] Failed for user ${user.id}:`, err);
    }
  }

  console.log(`[rebuildProfiles] Complete. Success: ${success}, Failed: ${failed}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[rebuildProfiles] Fatal error:", err);
  process.exit(1);
});

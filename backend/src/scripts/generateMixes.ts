import { prisma } from "../services/quotaService";
import { getUserMixes } from "../services/mixService";

async function main() {
  console.log("[generateMixes] Starting batch mix generation...");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeUserIds = await prisma.playHistory.findMany({
    where: { playedAt: { gte: sevenDaysAgo } },
    distinct: ["userId"],
    select: { userId: true },
  });
  const users = activeUserIds.map((r) => ({ id: r.userId }));
  console.log(
    `[generateMixes] Found ${users.length} active users (PlayHistory in last 7 days, since ${sevenDaysAgo.toISOString()})`
  );

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const mixes = await getUserMixes(user.id);
      success++;
      console.log(`[generateMixes] User ${user.id}: ${mixes.length} mixes generated`);
    } catch (err) {
      failed++;
      console.error(`[generateMixes] Failed for user ${user.id}:`, err);
    }
  }

  console.log(`[generateMixes] Complete. Success: ${success}, Failed: ${failed}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[generateMixes] Fatal error:", err);
  process.exit(1);
});

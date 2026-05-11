import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../lib/prisma";
import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const SCORE_TTL = 604800; // 7 days

interface GroupedFeedback {
  [videoId: string]: Array<{ id: string; feedback: string }>;
}

async function processFeedback(): Promise<void> {
  console.log("[processFeedback] Starting batch processing...");

  const logs = await prisma.feedbackLog.findMany({
    where: { processed: false },
    take: 500,
  });

  if (logs.length === 0) {
    console.log("[processFeedback] No unprocessed feedback found.");
    return;
  }

  console.log(`[processFeedback] Processing ${logs.length} entries...`);

  const grouped: GroupedFeedback = {};
  for (const log of logs) {
    if (!grouped[log.videoId]) {
      grouped[log.videoId] = [];
    }
    grouped[log.videoId].push({ id: log.id, feedback: log.feedback });
  }

  let overridden = 0;
  let processed = 0;

  for (const [videoId, entries] of Object.entries(grouped)) {
    try {
      const notMusicCount = entries.filter(
        (e) => e.feedback === "not_music"
      ).length;

      if (notMusicCount >= 3) {
        const overrideScore = JSON.stringify({
          videoId,
          score: -100,
          category: "discard",
        });

        await redis.setex(
          `score:${videoId}`,
          SCORE_TTL,
          overrideScore
        );

        await prisma.track.updateMany({
          where: { id: videoId },
          data: { filterScore: -100, category: "discard" },
        });

        overridden++;
        console.log(
          `[processFeedback] Overrode score for ${videoId} (${notMusicCount} reports)`
        );
      }

      await prisma.feedbackLog.updateMany({
        where: {
          videoId,
          processed: false,
        },
        data: { processed: true },
      });

      processed += entries.length;
    } catch (err) {
      console.error(
        `[processFeedback] Error processing ${videoId}:`,
        (err as Error).message
      );
    }
  }

  console.log(
    `[processFeedback] Done. Processed: ${processed}, Overridden: ${overridden}`
  );
}

processFeedback()
  .then(() => {
    console.log("[processFeedback] Complete.");
    return prisma.$disconnect();
  })
  .then(() => redis.disconnect())
  .catch((err) => {
    console.error("[processFeedback] Fatal error:", err);
    process.exit(1);
  });

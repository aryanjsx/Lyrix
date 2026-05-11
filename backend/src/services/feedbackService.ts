import { prisma } from "./quotaService";

const VALID_FEEDBACK = ["not_music", "wrong_category", "duplicate"] as const;
type FeedbackType = (typeof VALID_FEEDBACK)[number];

export function isValidFeedback(value: string): value is FeedbackType {
  return (VALID_FEEDBACK as readonly string[]).includes(value);
}

export async function logFeedback(
  videoId: string,
  feedback: string,
  userId?: string
): Promise<void> {
  await prisma.feedbackLog.create({
    data: {
      videoId,
      feedback,
      userId: userId ?? null,
      processed: false,
    },
  });
}

import { Request, Response } from "express";
import { logFeedback, isValidFeedback } from "../services/feedbackService";
import { captureError } from "../services/telemetry";

export async function handleFeedback(
  req: Request,
  res: Response
): Promise<void> {
  const { videoId, feedback } = req.body as {
    videoId?: string;
    feedback?: string;
  };

  if (!videoId || typeof videoId !== "string") {
    res.status(400).json({ error: "videoId is required" });
    return;
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  if (!feedback || !isValidFeedback(feedback)) {
    res
      .status(400)
      .json({ error: "feedback must be: not_music, wrong_category, or duplicate" });
    return;
  }

  try {
    await logFeedback(videoId, feedback, req.userId);
    res.json({ success: true });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to log feedback" });
  }
}

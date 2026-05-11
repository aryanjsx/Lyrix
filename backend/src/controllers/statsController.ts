import { Request, Response } from "express";
import { getUserStats, rebuildUserProfile } from "../services/analysisService";
import { captureError } from "../services/telemetry";

const rebuildCooldowns = new Map<string, number>();
const REBUILD_INTERVAL_MS = 5 * 60 * 1000;

export async function handleGetStats(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const lastRebuilt = rebuildCooldowns.get(req.userId) ?? 0;
    if (Date.now() - lastRebuilt > REBUILD_INTERVAL_MS) {
      await rebuildUserProfile(req.userId);
      rebuildCooldowns.set(req.userId, Date.now());
    }
    const stats = await getUserStats(req.userId);
    res.json(stats);
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}

export async function handleRebuildProfile(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    await rebuildUserProfile(req.userId);
    res.json({ success: true });
  } catch (err) {
    captureError(err as Error);
    res.status(500).json({ error: "Failed to rebuild profile" });
  }
}

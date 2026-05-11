import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { generalLimiter, rebuildLimiter } from "../middleware/rateLimiter";
import { handleGetStats, handleRebuildProfile } from "../controllers/statsController";

const router = Router();

router.get("/", requireAuth, generalLimiter, handleGetStats);
router.post("/rebuild", requireAuth, rebuildLimiter, handleRebuildProfile);

export default router;

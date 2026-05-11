import { Router } from "express";
import {
  handleListSaved,
  handleSaveTrack,
  handleUnsaveTrack,
  handleGetSaveStatus,
} from "../controllers/savedTrackController";
import { requireAuth } from "../middleware/requireAuth";
import { generalLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(generalLimiter);

router.get("/", requireAuth, handleListSaved);
router.post("/", requireAuth, handleSaveTrack);
router.get("/:videoId/status", requireAuth, handleGetSaveStatus);
router.delete("/:videoId", requireAuth, handleUnsaveTrack);

export default router;

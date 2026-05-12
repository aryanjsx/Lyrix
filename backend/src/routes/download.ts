import { Router } from "express";
import { handleDownload } from "../controllers/downloadController";
import { requireAuth } from "../middleware/requireAuth";
import { downloadLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/:videoId", requireAuth, downloadLimiter, handleDownload);

export default router;

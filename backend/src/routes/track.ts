import { Router } from "express";
import { handleGetTrack } from "../controllers/trackController";
import { generalLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/:videoId", generalLimiter, handleGetTrack);

export default router;

import { Router } from "express";
import { handleGetLyrics } from "../controllers/lyricsController";
import { generalLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/:videoId", generalLimiter, handleGetLyrics);

export default router;

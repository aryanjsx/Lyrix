import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/requireAuth";
import { generalLimiter } from "../middleware/rateLimiter";
import {
  handleGetForYou,
  handleGetTrending,
  handleGetMoreLikeThis,
  handleGetMixes,
  handleGetRecentlyPlayed,
  handleGetDiscover,
  handleLogRecommendationFeedback,
} from "../controllers/recommendationController";

const router = Router();

router.get("/for-you", requireAuth, generalLimiter, handleGetForYou);
router.get("/trending", optionalAuth, generalLimiter, handleGetTrending);
router.get("/discover", optionalAuth, generalLimiter, handleGetDiscover);
router.get("/more-like/:videoId", optionalAuth, generalLimiter, handleGetMoreLikeThis);
router.get("/mixes", requireAuth, generalLimiter, handleGetMixes);
router.get("/recently-played", requireAuth, generalLimiter, handleGetRecentlyPlayed);
router.post("/feedback", requireAuth, generalLimiter, handleLogRecommendationFeedback);

export default router;

import { Router } from "express";
import { handleFeedback } from "../controllers/feedbackController";
import { optionalAuth } from "../middleware/requireAuth";
import { feedbackLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/", feedbackLimiter, optionalAuth, handleFeedback);

export default router;

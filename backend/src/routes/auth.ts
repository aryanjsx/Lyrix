import { Router } from "express";
import {
  handleGoogleAuth,
  handleGoogleCallback,
  handleGetMe,
  handleLogout,
  handleYouTubeSyncAuth,
} from "../controllers/authController";
import { optionalAuth, requireAuth } from "../middleware/requireAuth";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/google", authLimiter, handleGoogleAuth);
router.get("/callback", authLimiter, handleGoogleCallback);
router.get("/youtube-sync", authLimiter, requireAuth, handleYouTubeSyncAuth);
router.get("/me", optionalAuth, handleGetMe);
router.get("/logout", handleLogout);

export default router;

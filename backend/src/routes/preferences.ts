import { Router } from "express";
import {
  handleGetPreferences,
  handleUpdatePreferences,
} from "../controllers/preferencesController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, handleGetPreferences);
router.put("/", requireAuth, handleUpdatePreferences);

export default router;

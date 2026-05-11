import { Router } from "express";
import { handleSearch } from "../controllers/searchController";
import { searchLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/", searchLimiter, handleSearch);

export default router;

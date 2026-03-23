import { Router } from "express";
import { discoveryController } from "./discovery.controller";

const router = Router();

// GET /v1/discovery/trending
router.get("/trending", discoveryController.getTrendingContent);

export const discoveryRoutes = router;

import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { diyController } from "./diy.controller";

const router = Router();

// Apply Auth Middleware to all DIY routes
router.use(authMiddleware);

// 1. Get DIY Guides
router.get("/guides", diyController.getGuides);

export const diyRoutes = router;

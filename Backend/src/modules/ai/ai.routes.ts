import { Router } from "express";
import { aiController } from "./ai.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

// Protect all AI routes
router.use(authMiddleware);

router.post("/coach", aiController.coach);

export const aiRoutes = router;

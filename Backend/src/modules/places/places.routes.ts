import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { placesController } from "./places.controller";

const router = Router();
router.use(authMiddleware);

router.get("/nearby", placesController.getNearby);

export const placesRoutes = router;

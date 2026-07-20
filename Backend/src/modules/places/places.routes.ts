import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { placesController } from "./places.controller";

const router = Router();
router.use(authMiddleware);

router.get("/nearby", placesController.getNearby);
router.get("/search", placesController.search);
router.get("/details/:placeId", placesController.details);

export const placesRoutes = router;

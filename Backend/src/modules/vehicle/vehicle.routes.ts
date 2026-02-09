import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { vehicleController } from "./vehicle.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", vehicleController.add);
router.get("/", vehicleController.list);
router.get("/:id", vehicleController.getById);
router.put("/:id", vehicleController.update);
router.delete("/:id", vehicleController.delete);

router.put("/:id/primary", vehicleController.setPrimary);
router.post("/:id/health/recalculate", vehicleController.recalculateHealth);

export const vehicleRoutes = router;

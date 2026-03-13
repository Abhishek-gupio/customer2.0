import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { vehicleController } from "./vehicle.controller";
import { challanController } from "./challan.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

router.post("/", vehicleController.add);
router.get("/", vehicleController.list);
router.get("/:id", vehicleController.getById);
router.put("/:id", vehicleController.update);
router.delete("/:id", vehicleController.delete);

router.put("/:id/primary", vehicleController.setPrimary);
router.post("/:id/health/recalculate", vehicleController.recalculateHealth);
router.post("/:id/odometer", vehicleController.addOdometer);
router.post(
  "/:id/odometer-ai",
  upload.single("photo"),
  vehicleController.addOdometerViaAI,
);

// ── AI Lookup Route (Gemini proxied server-side — API key is NEVER sent to client) ──
router.get("/lookup/:plate", vehicleController.lookupPlate);

// Challan Routes
router.get("/:vehicleId/challans", challanController.listByVehicle);
router.post("/:vehicleId/challans/sync", challanController.sync);
router.patch("/challans/:id/pay", challanController.markAsPaid);

export const vehicleRoutes = router;

import { Router } from "express";
import { telematicsController } from "./telematics.controller";

const router = Router();

// Webhook from Damoov (Unauthenticated or specific signature check)
router.post("/webhook", telematicsController.webhook);

// Link device (Ideally Authenticated, public for now)
router.post("/link/:vehicleId", telematicsController.linkDevice);

// Get Trip History
router.get("/:vehicleId/trips", telematicsController.getTrips);

export { router as telematicsRoutes };

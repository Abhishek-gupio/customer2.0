import { Router } from "express";
import { telematicsController } from "./telematics.controller";

const router = Router();

// Register User to Damoov
router.post("/register", telematicsController.register);

// Webhook from Damoov (Unauthenticated or specific signature check)
router.post("/webhook", telematicsController.webhook);

// Link device (Ideally Authenticated, public for now)
router.post("/link/:vehicleId", telematicsController.linkDevice);

// Get Trip History
router.get("/:vehicleId/trips", telematicsController.getTrips);

// Get GPS path for a specific trip
router.get("/trips/:tripId/path", telematicsController.getTripPath);

export { router as telematicsRoutes };

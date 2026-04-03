import { Router } from "express";
import { telematicsController } from "./telematics.controller";

const router = Router();

// Register User to Damoov
router.post("/register", telematicsController.register);

// Webhook from Damoov (Unauthenticated or specific signature check)
router.post("/webhook", telematicsController.webhook);

// In-house telematics trip ingestion
router.post("/inhouse/trips", telematicsController.ingestInHouseTrip);
router.post("/inhouse/live/start", telematicsController.startInHouseLiveSession);
router.post("/inhouse/live/:sessionId/points", telematicsController.pushInHouseLivePoints);
router.get("/inhouse/live/:sessionId", telematicsController.getInHouseLiveSession);
router.get("/inhouse/live/vehicle/:vehicleId", telematicsController.getActiveInHouseLiveSessionForVehicle);
router.post("/inhouse/live/:sessionId/stop", telematicsController.stopInHouseLiveSession);

// Link device (Ideally Authenticated, public for now)
router.post("/link/:vehicleId", telematicsController.linkDevice);

// Get Trip History
router.get("/:vehicleId/trips", telematicsController.getTrips);

// Get GPS path for a specific trip
router.get("/trips/:tripId/path", telematicsController.getTripPath);

// A5: End-trip summary with score + money tip + safety tip
router.get("/trips/:tripId/summary", telematicsController.getTripSummary);

// Manual sync
router.post("/sync", telematicsController.sync);

export { router as telematicsRoutes };

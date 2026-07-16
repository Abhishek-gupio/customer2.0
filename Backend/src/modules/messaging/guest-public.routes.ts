import { Router } from "express";
import multer from "multer";
import { guestMessageLimiter } from "../../middlewares/messaging-rate-limit.middleware";
import { guestController } from "./guest.controller";

/**
 * No authMiddleware anywhere in this router — this is the whole point.
 * Someone who scanned a vehicle's QR without the Gupio app lands here with
 * no account at all. Mirrors the existing precedent of a couple of
 * deliberately-unauthenticated, vehicle-identifier-keyed routes in
 * modules/customer/customer.routes.ts (used for valet location).
 */
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/vehicle/:token", guestController.resolveVehicle);
router.post("/vehicle/:token/messages", guestMessageLimiter, upload.array("photos", 5), guestController.submitMessage);
router.get("/conversations/:guestToken", guestController.getByGuestToken);

export const guestPublicRoutes = router;

import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { customerController } from "./customer.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for profile pic
});

router.use(authMiddleware);

/**
 * Valet tracking. These were mounted ABOVE `authMiddleware` and keyed only on a vehicle number —
 * i.e. a licence plate, which is public information physically visible on the car. Anyone could
 * `GET /valet-location/<any plate>` and receive that vehicle's parked coordinates plus the
 * owner's last reported live location, or POST a forged location for a car they don't own.
 * Both are now authenticated and owner-scoped in the service.
 */
router.get("/valet-location/:vehicleNumber", customerController.getValetLocation);
router.post("/customer-location/:vehicleNumber", customerController.postCustomerLocation);

router.get("/profile", customerController.getProfile);
router.get("/profile/stats", customerController.getProfileStats);
router.put("/profile", customerController.updateProfile);
router.post("/profile/picture", upload.single("file"), customerController.uploadProfilePicture);
router.post("/device", customerController.registerDevice);
router.post("/request-drop", customerController.requestDrop);
router.get("/request-status", customerController.getRequestStatus);
router.get("/vehicle-request-data", customerController.getVehicleRequestData);
router.post("/cancel-drop-request", customerController.cancelDropRequest);
router.post("/resend-drop-request", customerController.resendDropRequest);

export const customerRoutes = router;

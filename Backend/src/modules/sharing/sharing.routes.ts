import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { sharingController } from "./sharing.controller";

const router = Router();

router.use(authMiddleware);

// Invite/Share a vehicle
router.post("/share", sharingController.share);

// List vehicles shared WITH me
router.get("/shared-with-me", sharingController.listIncoming);

// List people I have shared a specific vehicle WITH
router.get("/vehicle/:vehicleId/access", sharingController.listOutgoing);

// Revoke access
router.delete(
  "/vehicle/:vehicleId/access/:targetCustomerId",
  sharingController.revoke,
);

export const sharingRoutes = router;

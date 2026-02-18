import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { customerController } from "./customer.controller";

const router = Router();

router.use(authMiddleware);

router.get("/profile", customerController.getProfile);
router.put("/profile", customerController.updateProfile);
router.post("/device", customerController.registerDevice);

export const customerRoutes = router;

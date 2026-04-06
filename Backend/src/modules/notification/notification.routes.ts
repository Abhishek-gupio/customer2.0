import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { notificationController } from "./notification.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", notificationController.list);
router.patch("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.remove);

export const notificationRoutes = router;

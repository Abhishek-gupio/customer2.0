import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes";
import { customerRoutes } from "./modules/customer/customer.routes";
import { documentRoutes } from "./modules/document/document.routes";
import { vehicleRoutes } from "./modules/vehicle/vehicle.routes";
import { sharingRoutes } from "./modules/sharing/sharing.routes";
import { notificationRoutes } from "./modules/notification/notification.routes";
import { expenseRoutes } from "./modules/expense/expense.routes";
import { chatRoutes } from "./modules/chat/chat.routes";
import { telematicsRoutes } from "./modules/telematics/telematics.routes";

import { aiRoutes } from "./modules/ai/ai.routes";

const router = Router();

router.use("/v1/auth", authRoutes);
router.use("/v1/customer", customerRoutes);
router.use("/v1/documents", documentRoutes);
router.use("/v1/vehicles", vehicleRoutes);
router.use("/v1/sharing", sharingRoutes);
router.use("/v1/notifications", notificationRoutes);
router.use("/v1/expenses", expenseRoutes);
router.use("/v1/chat", chatRoutes);
router.use("/v1/telematics", telematicsRoutes);
router.use("/v1/ai", aiRoutes);

export const apiRoutes = router;

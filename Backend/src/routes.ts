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

import { sosRoutes } from "./modules/sos/sos.routes";
import { placesRoutes } from "./modules/places/places.routes";
import { fuelRoutes } from "./modules/fuel/fuel.routes";
import { discoveryRoutes } from "./modules/discovery/discovery.routes";
import { supportRoutes } from "./modules/support/support.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { tripExpenseRoutes } from "./modules/trip-expense/trip-expense.routes";

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
router.use("/v1/sos", sosRoutes);
router.use("/v1/places", placesRoutes);
router.use("/v1/fuel", fuelRoutes);
router.use("/v1/discovery", discoveryRoutes);
router.use("/v1/support", supportRoutes);
router.use("/v1/admin", adminRoutes);
router.use("/v1/trip-expense", tripExpenseRoutes);

export const apiRoutes = router;

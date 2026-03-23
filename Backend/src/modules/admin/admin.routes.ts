import { Router } from "express";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { adminController } from "./admin.controller";

const router = Router();

router.post("/auth/login", adminController.login);

router.use(adminAuthMiddleware);

router.get("/me", adminController.me);
router.get("/stats", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), adminController.getOverviewStats);
router.get("/customers", adminController.listCustomers);
router.get("/customers/:id", adminController.getCustomerDetail);

export const adminRoutes = router;

import { Router } from "express";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { adminController } from "./admin.controller";

const router = Router();

router.post("/auth/login", adminController.login);
router.post("/auth/signup", adminController.signup);

// Public forgot-password routes (no auth required)
router.post("/auth/forgot-password", adminController.forgotPassword);
router.post("/auth/verify-reset-otp", adminController.verifyResetOtp);
router.post("/auth/reset-password", adminController.resetPassword);

router.use(adminAuthMiddleware);

router.get("/me", adminController.me);
router.get("/stats", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), adminController.getOverviewStats);
router.get("/customers", adminController.listCustomers);
router.get("/tickets", adminController.listTickets);
router.get("/vehicles", adminController.listVehicles);
router.get("/customers/:id", adminController.getCustomerDetail);

// Support Panel Routes
router.get("/tickets/:id/messages", adminController.getTicketMessages);
router.post("/tickets/:id/messages", requireAdminRole(["SUPPORT", "ADMIN", "SUPER_ADMIN"]), adminController.addTicketMessage);
router.patch("/tickets/:id/status", requireAdminRole(["SUPPORT", "ADMIN", "SUPER_ADMIN"]), adminController.updateTicketStatus);
router.get("/documents/:id/download", adminController.downloadDocument);

export const adminRoutes = router;

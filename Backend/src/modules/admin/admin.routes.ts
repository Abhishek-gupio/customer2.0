import { Router } from "express";
import multer from "multer";
import { adminAuthMiddleware, requireAdminRole } from "../../middlewares/admin.middleware";
import { adminController } from "./admin.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

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
router.patch("/customers/:id", requireAdminRole(["SUPER_ADMIN"]), adminController.updateCustomer);
router.delete("/customers", requireAdminRole(["SUPER_ADMIN"]), adminController.deleteCustomers);

// Support Panel Routes
router.get("/tickets/:id/messages", adminController.getTicketMessages);
router.post("/tickets/:id/messages", requireAdminRole(["SUPPORT", "ADMIN", "SUPER_ADMIN"]), adminController.addTicketMessage);
router.patch("/tickets/:id/status", requireAdminRole(["SUPPORT", "ADMIN", "SUPER_ADMIN"]), adminController.updateTicketStatus);
router.get("/documents/:id/download", adminController.downloadDocument);

// Vehicle Catalog routes (VehicleCatalog + VehicleAsset — S3 images by make/model)
router.get("/catalog/vehicles", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), adminController.catalogVehicles);
router.patch("/catalog/vehicles/:id/assets/:assetId", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), upload.single("file"), adminController.updateCatalogVehicleAsset);

export const adminRoutes = router;

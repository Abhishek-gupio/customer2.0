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
router.get("/expenses", adminController.listExpenses);
router.get("/expenses/:id", adminController.getExpenseDetail);
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
router.post("/catalog/vehicles", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), upload.array("images", 10), adminController.createCatalogVehicle);
router.post("/catalog/vehicles/:id/assets", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), upload.single("file"), adminController.createCatalogVehicleAsset);
router.patch("/catalog/vehicles/:id/assets/:assetId", requireAdminRole(["SUPER_ADMIN", "ADMIN"]), upload.single("file"), adminController.updateCatalogVehicleAsset);

// Admin Management (Super Admin only)
router.get("/manage/admins", requireAdminRole(["SUPER_ADMIN"]), adminController.listAdmins);
router.delete("/manage/admins", requireAdminRole(["SUPER_ADMIN"]), adminController.deleteAdmins);
router.patch("/manage/admins/:id/toggle-support-customers", requireAdminRole(["SUPER_ADMIN"]), adminController.toggleSupportCustomerAccess);
router.post("/manage/admins/:id/toggle-support-customers", requireAdminRole(["SUPER_ADMIN"]), adminController.toggleSupportCustomerAccess);
router.patch("/manage/admins/:id/toggle-status", requireAdminRole(["SUPER_ADMIN"]), adminController.toggleAdminStatus);




export const adminRoutes = router;

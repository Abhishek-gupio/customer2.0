import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { expenseController } from "./expense.controller";
import {
  fuelPriceController,
  warrantyController,
  expenseAnalysisController,
} from "./expense-features.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(authMiddleware);

// ============================================================
// 1. CORE CRUD
// ============================================================
router.post("/", upload.single("receipt"), expenseController.create); // Manual + File
router.get("/", expenseController.list);

// ============================================================
// 2. PARSER METHODS (4 Ways to Add Expenses)
// ============================================================
router.post("/parse/text", expenseController.parse); // SMS/Notification text
router.post(
  "/parse/receipt",
  upload.single("file"),
  expenseController.parseReceipt,
); // Receipt Image (OCR)
router.post(
  "/parse/voice",
  upload.single("audio"),
  expenseController.parseVoice,
); // Voice Command (Audio → AI)
router.post("/parse/voice/text", expenseController.parseVoiceText); // Voice Command (transcribed text → AI)

// ============================================================
// 3. ANALYTICS & BUDGETS
// ============================================================
router.get("/summary", expenseController.getSummary);
router.post("/budgets", expenseController.setBudget);

// ============================================================
// 4. FUEL PRICE INTELLIGENCE
// ============================================================
router.get("/fuel-prices", fuelPriceController.getPrice); // Get price for a city
router.get("/fuel-prices/compare", fuelPriceController.comparePrices); // Compare with nearby cities
router.get("/fuel-prices/all", fuelPriceController.getAllPrices); // All cities
router.post(
  "/fuel-prices/calculate-liters",
  fuelPriceController.calculateLiters,
); // Amount → Liters

// ============================================================
// 5. WARRANTY & PARTS TRACKER
// ============================================================
router.post("/warranty/primary/refresh-oem", warrantyController.refreshOemForPrimary); // Refresh OEM intervals for primary vehicle
router.get("/warranty/providers", warrantyController.getServiceProviders); // Provider Database (Garages)
router.post(
  "/warranty/service-records",
  warrantyController.createServiceRecord,
); // Log a service
router.get(
  "/warranty/vehicles/:vehicleId/history",
  warrantyController.getServiceHistory,
); // Full history
router.get(
  "/warranty/vehicles/:vehicleId/status",
  warrantyController.getWarrantyStatus,
); // Warranty status
router.get(
  "/warranty/vehicles/:vehicleId/upcoming",
  warrantyController.getUpcomingReplacements,
); // Parts due
router.get("/warranty/part-info", warrantyController.getPartLifecycleInfo); // Reference data
router.post(
  "/warranty/vehicles/:vehicleId/check-alerts",
  warrantyController.checkAlerts,
); // Trigger alerts

// ============================================================
// 6. INTELLIGENCE & ANALYTICS
// ============================================================
router.get("/insights", expenseAnalysisController.getInsights); // Weekly Digest + Tips
router.get(
  "/vehicles/:vehicleId/cost-per-km",
  expenseAnalysisController.getCostPerKm,
); // Cost Efficiency
router.post("/anomalies/check", expenseAnalysisController.checkAnomalies); // Smart Anomaly Check

export const expenseRoutes = router;

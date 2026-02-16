import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { fuelPriceService } from "../../services/fuel-price.service";
import { warrantyService, CreateServiceRecordInput } from "../../services/warranty.service";
import { expenseIntelligenceService } from "../../services/expense-intelligence.service";
import { z } from "zod";

// ============================================================
// FUEL PRICE CONTROLLER
// ============================================================
export const fuelPriceController = {
    // GET /fuel-prices?city=Delhi&fuelType=PETROL
    getPrice: asyncHandler(async (req: Request, res: Response) => {
        const city = (req.query.city as string) || "Delhi";
        const fuelType = (req.query.fuelType as string) || "PETROL";

        const price = await fuelPriceService.getPrice(city, fuelType);
        success(res, { city, fuelType, pricePerLiter: price });
    }),

    // GET /fuel-prices/compare?city=Delhi&fuelType=PETROL
    comparePrices: asyncHandler(async (req: Request, res: Response) => {
        const city = (req.query.city as string) || "Delhi";
        const fuelType = (req.query.fuelType as string) || "PETROL";

        const result = await fuelPriceService.comparePrices(city, fuelType);
        success(res, result);
    }),

    // GET /fuel-prices/all?fuelType=PETROL
    getAllPrices: asyncHandler(async (req: Request, res: Response) => {
        const fuelType = (req.query.fuelType as string) || "PETROL";
        const prices = await fuelPriceService.getAllPrices(fuelType);
        success(res, { fuelType, prices });
    }),

    // POST /fuel-prices/calculate-liters
    calculateLiters: asyncHandler(async (req: Request, res: Response) => {
        const { amount, city, fuelType } = req.body;
        if (!amount) throw AppError.badRequest("Amount is required");

        const result = await fuelPriceService.calculateLiters(
            parseFloat(amount),
            city || "Delhi",
            fuelType || "PETROL"
        );
        success(res, result);
    }),
};

// ============================================================
// WARRANTY & SERVICE CONTROLLER
// ============================================================
const createServiceRecordSchema = z.object({
    vehicleId: z.string().min(1),
    expenseId: z.string().optional(),
    serviceType: z.enum(["REGULAR_SERVICE", "REPAIR", "ACCIDENT", "MODIFICATION"]),
    garageName: z.string().optional(),
    odometerAtService: z.number().optional(),
    serviceDate: z.string().datetime().optional(),
    nextServiceKm: z.number().optional(),
    notes: z.string().optional(),
    parts: z.array(z.object({
        partType: z.string().min(1),
        partName: z.string().optional(),
        brand: z.string().optional(),
        cost: z.number().optional(),
        warrantyMonths: z.number().optional(),
        warrantyKm: z.number().optional(),
    })).min(1, "At least one part is required"),
});

export const warrantyController = {
    // POST /warranty/service-records — Create service record with parts
    createServiceRecord: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();

        const parsed = createServiceRecordSchema.safeParse(req.body);
        if (!parsed.success) {
            throw AppError.badRequest(parsed.error.issues[0]?.message || "Validation failed");
        }

        const result = await warrantyService.createServiceRecord(parsed.data as CreateServiceRecordInput);
        success(res, result, 201);
    }),

    // GET /warranty/vehicles/:vehicleId/history — Service history
    getServiceHistory: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicleId = req.params.vehicleId as string;
        if (!vehicleId) throw AppError.badRequest("Vehicle ID is required");

        const history = await warrantyService.getServiceHistory(vehicleId);
        success(res, history);
    }),

    // GET /warranty/vehicles/:vehicleId/status — Warranty status (active/expiring/expired)
    getWarrantyStatus: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicleId = req.params.vehicleId as string;

        const status = await warrantyService.getWarrantyStatus(vehicleId);
        success(res, status);
    }),

    // GET /warranty/vehicles/:vehicleId/upcoming — Parts due for replacement
    getUpcomingReplacements: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicleId = req.params.vehicleId as string;

        const upcoming = await warrantyService.getUpcomingReplacements(vehicleId);
        success(res, upcoming);
    }),

    // GET /warranty/part-info — Get all part lifecycle info (for frontend reference)
    getPartLifecycleInfo: asyncHandler(async (_req: Request, res: Response) => {
        const info = warrantyService.getPartLifecycleInfo();
        success(res, info);
    }),

    // POST /warranty/vehicles/:vehicleId/check-alerts — Trigger alert check
    checkAlerts: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicleId = req.params.vehicleId as string;

        const alerts = await warrantyService.checkAlerts(vehicleId, req.customer.id);
        success(res, { alerts, count: alerts.length });
    }),

    // GET /warranty/providers — Get list of service providers
    getServiceProviders: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();

        const providers = await warrantyService.getServiceProviders(req.customer.id);
        success(res, providers);
    }),
};

// ============================================================
// EXPENSE INTELLIGENCE & ANALYTICS CONTROLLER
// ============================================================
export const expenseAnalysisController = {
    // GET /expenses/insights — Weekly digest, anomalies, and smart tips
    getInsights: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();

        // Parallel execution for speed
        const [digest, recurring] = await Promise.all([
            expenseIntelligenceService.generateWeeklyDigest(req.customer.id),
            expenseIntelligenceService.detectRecurringExpenses(req.customer.id)
        ]);

        success(res, {
            weeklyDigest: digest,
            recurringExpenses: recurring.patterns,
            smartTips: digest.tips
        });
    }),

    // GET /expenses/vehicles/:vehicleId/cost-per-km
    getCostPerKm: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicleId = req.params.vehicleId as string;

        const result = await expenseIntelligenceService.costPerKm(vehicleId, req.customer.id);
        success(res, result);
    }),

    // POST /expenses/anomalies/check — Manual anomaly check (e.g. before adding expense)
    checkAnomalies: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        // Body: amount, category, vehicleId, merchantName
        const { amount, category, merchantName, vehicleId } = req.body;

        const result = await expenseIntelligenceService.detectAnomalies(
            req.customer.id,
            parseFloat(amount),
            category,
            merchantName,
            vehicleId
        );
        success(res, result);
    }),
};

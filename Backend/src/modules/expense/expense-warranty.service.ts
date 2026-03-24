import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/AppError";
import { isGeminiRateLimitError } from "../../utils/geminiRateLimit";
import { storageService } from "../../services/storage.service";
import { ocrService } from "../../services/ocr.service";
import { warrantyService } from "../../services/warranty.service";
import { vehicleService } from "../vehicle/vehicle.service";

const db = dbInstances;

export const expenseWarrantyService = {
  /**
   * AUTO SERVICE RECORD CREATOR
   * ============================
   * When a SERVICE/REPAIR expense is detected, AI predicts parts and
   * auto-creates a ServiceRecord + ServiceParts with warranty tracking.
   */
  async autoCreateServiceRecord(
    expenseId: string,
    vehicleId: string | null,
    rawText: string,
    amount: number,
    merchantName: string | null,
    customerId: string,
  ): Promise<void> {
    if (!vehicleId) {
      const vehicles = await dbInstances.customerVehicle.findMany({
        where: { customerId },
        select: { id: true },
        take: 1,
      });
      if (vehicles.length === 0) return;
      vehicleId = vehicles[0].id;
    }

    try {
      const serviceDetails = await ocrService.parseServiceDetails(rawText, amount, merchantName);
      
      const vehicle = await dbInstances.customerVehicle.findUnique({
        where: { id: vehicleId! },
        select: { currentOdometer: true },
      });

      await warrantyService.createServiceRecord({
        vehicleId: vehicleId!,
        expenseId,
        serviceType: serviceDetails.serviceType as any,
        garageName: merchantName || undefined,
        odometerAtService: vehicle?.currentOdometer || undefined,
        nextServiceKm: serviceDetails.nextServiceKm,
        notes: `🤖 Auto-created from expense. AI Confidence: ${serviceDetails.confidence}. ${serviceDetails.notes || ""}`,
        parts: serviceDetails.predictedParts.map((p) => ({
          partType: p.partType,
          partName: p.partName,
          cost: p.estimatedCost,
          warrantyMonths: p.warrantyMonths,
        })),
      });

      void vehicleService.calculateHealthScore(vehicleId!).catch(e =>
        logger.error({ e, vehicleId }, "Background health recalculation failed")
      );

      await db.inAppNotification.create({
        data: {
          customerId,
          title: "🔧 Service Record Auto-Created",
          body: `We detected a service expense of ₹${amount}${merchantName ? ` at ${merchantName}` : ""}. Parts and warranty have been auto-tracked.`,
          type: "INFO",
          link: "/expenses/warranty",
          metadata: { expenseId, serviceType: serviceDetails.serviceType },
        },
      });
    } catch (err) {
      logger.error({ err, expenseId }, "Auto service record creation failed");
    }
  },

  /**
   * PARSE SERVICE BILL
   * ==================
   * Exact data extraction from uploaded bill photo.
   */
  async parseServiceBill(
    customerId: string,
    expenseId: string,
    file: any, // Express.Multer.File
  ) {
    const expense = await db.expense.findFirst({
      where: { id: expenseId, customerId },
    });

    if (!expense) throw AppError.notFound("Expense not found");
    if (expense.category !== "SERVICE" && expense.category !== "REPAIR") {
      throw AppError.badRequest("This expense is not a service/repair expense");
    }

    const uploaded = await storageService.uploadFile(file, `service-bills/${customerId}`);

    const genAI = (await import("@google/generative-ai")).GoogleGenerativeAI;
    const env = (await import("../../config/env")).env;

    if (!env.GEMINI_API_KEY) throw AppError.badRequest("AI not configured");

    const ai = new genAI(env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Extract ALL line items from this service bill image. Return JSON. Items should include description, partType, amount, isLabor.`;

    const imagePart = {
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype,
      },
    };

    let billData: any;
    try {
      const result = await model.generateContent([prompt, imagePart]);
      const responseText = (await result.response).text();
      const jsonStr = responseText.replace(/```json|```/g, "").trim();
      billData = JSON.parse(jsonStr);
    } catch (err) {
      if (isGeminiRateLimitError(err)) throw AppError.tooManyRequests("AI is busy.");
      throw err;
    }

    await db.expense.update({
      where: { id: expenseId },
      data: {
        receiptUrl: uploaded.url,
        mimeType: file.mimetype,
        merchantName: billData.garageName || expense.merchantName,
      },
    });

    const parts = (billData.items || [])
      .filter((item: any) => !item.isLabor)
      .map((item: any) => ({
        partType: item.partType || "OTHER",
        partName: item.description,
        cost: item.amount,
        brand: item.brand,
      }));

    return warrantyService.createServiceRecord({
      vehicleId: expense.vehicleId!,
      expenseId: expense.id,
      serviceType: "REGULAR_SERVICE",
      garageName: billData.garageName || undefined,
      serviceDate: billData.serviceDate || expense.date.toISOString(),
      odometerAtService: billData.odometerReading ? Number(billData.odometerReading) : undefined,
      nextServiceKm: billData.nextServiceKm ? Number(billData.nextServiceKm) : undefined,
      notes: billData.notes || "Parsed from uploaded bill",
      parts,
    });
  },

  /**
   * Sync manual parts from expense to warranty service record
   */
  async syncExpenseToWarranty(expense: any, vehicleId: string, parts: any[], odometerReading?: number) {
    try {
      const finalOdo = odometerReading ??
        (await db.customerVehicle.findUnique({
          where: { id: vehicleId },
          select: { currentOdometer: true }
        }))?.currentOdometer;

      const serviceRecord = await warrantyService.createServiceRecord({
        vehicleId,
        expenseId: expense.id,
        serviceType: "REGULAR_SERVICE",
        garageName: expense.merchantName || undefined,
        serviceDate: expense.date.toISOString(),
        odometerAtService: (finalOdo !== null && finalOdo !== undefined) ? Number(finalOdo) : undefined,
        notes: expense.notes || undefined,
        parts: parts as any,
      });

      void vehicleService.calculateHealthScore(vehicleId).catch(e =>
        logger.error({ e, vehicleId }, "Targeted health recalculation failed")
      );
      return serviceRecord;
    } catch (err) {
      await db.expense.delete({
        where: { id: expense.id },
      }).catch((deleteErr: unknown) => {
        logger.error({ err: deleteErr, expenseId: expense.id }, "Failed to roll back expense after warranty sync failure");
      });
      
      throw AppError.badRequest(
        `Failed to update warranty status for selected parts: ${err instanceof Error ? err.message : "Unknown error"}`,
        "WARRANTY_SYNC_FAILED",
      );
    }
  },
};

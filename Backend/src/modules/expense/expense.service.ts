import { dbInstances } from "@repo/db-customer";
import {
  CreateExpenseInput,
  ParseExpenseInput,
  ExpenseBudgetInput,
  ExpenseCategory,
  ExpenseSource,
} from "./expense.validators";
import { AppError } from "../../utils/AppError";
import { isGeminiRateLimitError } from "../../utils/geminiRateLimit";
import { logger } from "../../config/logger";
import { storageService } from "../../services/storage.service";
import { vehicleService } from "../vehicle/vehicle.service";
import { ocrService } from "../../services/ocr.service";
import { upiParserService } from "../../services/upi-parser.service";
import { fuelPriceService } from "../../services/fuel-price.service";
import { expenseIntelligenceService } from "../../services/expense-intelligence.service";
import { warrantyService } from "../../services/warranty.service";

interface UploadedFile extends Express.Multer.File { }

// Cast for new models until TS picks up regenerated Prisma types
const db = dbInstances as any;

import { ingestionService } from "../../services/ingestion.service";

const ALLOWED_NOTIFICATION_CATEGORIES: ExpenseCategory[] = [
  "FUEL",
  "SERVICE",
  "TOLL",
  "INSURANCE",
  "PARKING",
  "CHALLAN",
];
const MAX_RECEIPT_IMAGES_PER_CUSTOMER = 15;

export const expenseService = {
  /**
   * Core: Add Manual Expense
   */
  async createExpense(
    customerId: string,
    input: CreateExpenseInput,
    file?: UploadedFile,
  ) {
    // Handle receipt upload if present
    let receiptUrl = input.receiptUrl || null;
    let mimeType = input.mimeType || null;
    if (file) {
      const uploaded = await storageService.uploadFile(
        file,
        `expenses/${customerId}`,
      );
      receiptUrl = uploaded.url;
      mimeType = file.mimetype;
    }

    // Always resolve to a vehicle owned by this customer (or where they have access):
    // prefer primary, never leave unlinked when customer has vehicles
    let targetVehicleId = (input.vehicleId && String(input.vehicleId).trim()) || null;
    if (targetVehicleId) {
      const owned = await dbInstances.customerVehicle.findFirst({
        where: { id: targetVehicleId, customerId, isActive: true },
        select: { id: true },
      });
      if (!owned) targetVehicleId = null; // invalid or wrong customer – resolve to primary below
    }
    if (!targetVehicleId) {
      const primaryVehicle = await dbInstances.customerVehicle.findFirst({
        where: { customerId, isPrimary: true, isActive: true },
        select: { id: true },
      });
      if (primaryVehicle) {
        targetVehicleId = primaryVehicle.id;
      } else {
        const firstVehicle = await dbInstances.customerVehicle.findFirst({
          where: { customerId, isActive: true },
          select: { id: true },
        });
        if (firstVehicle) targetVehicleId = firstVehicle.id;
      }
    }

    // If expense is linked to a vehicle, enforce role-based permissions:
    // - OWNER / EDITOR / DRIVER can write
    // - VIEWER can only read and must not create expenses against that vehicle
    if (targetVehicleId) {
      const vehicle = await dbInstances.customerVehicle.findUnique({
        where: { id: targetVehicleId },
        include: {
          accessList: {
            where: { customerId },
          },
        },
      });

      if (!vehicle) {
        throw AppError.notFound("Vehicle not found for expense");
      }

      const isOwner = vehicle.customerId === customerId;
      const hasWriteAccess =
        vehicle.accessList?.some(
          (a: any) => a.role === "EDITOR" || a.role === "DRIVER",
        ) ?? false;

      if (!isOwner && !hasWriteAccess) {
        throw AppError.forbidden(
          "You have view-only access to this vehicle and cannot add expenses to it",
        );
      }
    }

    // Logic: If user provided 'odometerReading' and 'vehicleId', update vehicle log
    if (targetVehicleId && input.odometerReading) {
      await vehicleService.addOdometerLog(customerId, targetVehicleId, {
        reading: input.odometerReading,
        date: new Date(),
      });
    }

    // If this user is acting as a DRIVER on the selected vehicle, capture it
    let driverId: string | null = null;
    if (targetVehicleId) {
      const access = await dbInstances.vehicleAccess.findFirst({
        where: {
          vehicleId: targetVehicleId,
          customerId,
          // Cast because the published enum type in @repo/db-customer
          // may not yet include DRIVER even though the DB enum does.
          role: "DRIVER" as any,
        },
        select: { id: true },
      });
      if (access) {
        driverId = customerId;
      }
    }

    // Create DB Record
    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: targetVehicleId,
        driverId,
        amount: input.amount,
        category: input.category, // e.g. FUEL
        date: input.date ? new Date(input.date) : new Date(),
        merchantName: input.merchantName,
        location: input.location,
        placeId: input.placeId,
        placeName: input.placeName,
        placeAddress: input.placeAddress,
        placeLat: input.placeLat,
        placeLng: input.placeLng,
        notes: input.notes,
        source: input.source || "MANUAL",
        receiptUrl,
        mimeType,
      },
    });

    // Trigger Budget Check (Async, don't block response)
    this.checkBudget(customerId, expense.category, expense.amount).catch(
      (err) => logger.error({ err }, "Budget check failed"),
    );

    // Fuel Price Intelligence: If it's a FUEL expense, enrich with liters + price comparison
    let fuelIntelligence = null;
    if (expense.category === "FUEL") {
      try {
        // Use location or default city
        const city = input.location || "Delhi";
        // Determine fuel type from vehicle or default to PETROL
        const fuelType = "PETROL"; // TODO: Fetch from linked vehicle's fuelType
        fuelIntelligence = await fuelPriceService.enrichFuelExpense(
          expense.amount,
          city,
          fuelType,
        );
      } catch (err) {
        logger.debug({ err }, "Fuel price enrichment failed (non-critical)");
      }
    }

    // Ingest into AI Memory
    ingestionService
      .ingestExpense(expense.id)
      .catch((err) => logger.error({ err }, "Expense ingestion failed"));

    // Warranty Integration: If it's a SERVICE/OTHER and has parts (or we can detect them), create a ServiceRecord
    const isPartRelatored = expense.category === "SERVICE" || expense.category === "OTHER";

    if (isPartRelatored && targetVehicleId) {
      if (input.parts && input.parts.length > 0) {
        try {
          // Fallback: if no odometer provided in input, use current vehicle odo
          const finalOdo = input.odometerReading ??
            (await dbInstances.customerVehicle.findUnique({
              where: { id: targetVehicleId },
              select: { currentOdometer: true }
            }))?.currentOdometer;

          await warrantyService.createServiceRecord({
            vehicleId: targetVehicleId,
            expenseId: expense.id,
            serviceType: "REGULAR_SERVICE",
            garageName: expense.merchantName || undefined,
            serviceDate: expense.date.toISOString(),
            odometerAtService: (finalOdo !== null && finalOdo !== undefined) ? Number(finalOdo) : undefined,
            notes: expense.notes || undefined,
            parts: input.parts as any,
          });

          // Recalculate health score to reflect new part health on home screen
          void vehicleService.calculateHealthScore(targetVehicleId).catch(e =>
            logger.error({ e, vehicleId: targetVehicleId }, "Targeted health recalculation failed")
          );
        } catch (err) {
          logger.error({ err, expenseId: expense.id }, "Failed to create service record for manual expense");
        }
      } else if (expense.notes && expense.notes.length > 3) {
        // AI detection from notes if no parts provided but category is relevant
        this.autoCreateServiceRecord(
          expense.id,
          targetVehicleId,
          expense.notes,
          expense.amount,
          expense.merchantName,
          customerId
        ).catch(err => logger.error({ err }, "Background part detection failed"));
      }
    }

    if (expense.receiptUrl) {
      this.pruneOldReceiptImages(customerId).catch((err) =>
        logger.error({ err, customerId }, "Failed to prune old receipt images"),
      );
    }

    return { expense, fuelIntelligence };
  },
  /**
   * SMART EXPENSE PARSER
   * Priority: Dedup Check → Gemini AI (primary) → UPI Regex (fallback) → Basic Regex (last resort)
   */
  async parseExpenseText(
    customerId: string,
    input: ParseExpenseInput,
    opts?: { returnOnNoAmount?: boolean; dryRun?: boolean },
  ) {
    const text = input.text;

    // ===== STEP 0: DEDUPLICATION CHECK =====
    if (await expenseIntelligenceService.isRawTextDuplicate(customerId, text)) {
      return {
        success: false,
        skipped: true,
        reason: "Duplicate notification — expense already recorded.",
      };
    }

    // ===== STEP 1: GEMINI AI (Primary — highest accuracy) =====
    try {
      const aiResult = await ocrService.parseExpenseNotification(text);

      if (aiResult.amount > 0 && !aiResult.error) {
        // DRY RUN: return preview without creating expense
        if (opts?.dryRun) {
          return {
            success: true,
            dryRun: true,
            expense: {
              amount: aiResult.amount,
              category: aiResult.category,
              merchantName: aiResult.merchantName || null,
              date: aiResult.date ? new Date(aiResult.date) : new Date(),
              notes: aiResult.notes || null,
            },
            parserMeta: { method: 'GEMINI_AI', confidence: aiResult.confidence },
          };
        }

        // AI succeeded — dedup check on amount+category
        const dupCheck = await expenseIntelligenceService.isDuplicate(
          customerId,
          aiResult.amount,
          aiResult.category,
          new Date(),
        );
        if (dupCheck.isDuplicate) {
          return {
            success: false,
            skipped: true,
            reason: dupCheck.reason,
            existingExpenseId: dupCheck.existingExpenseId,
          };
        }

        // Filter Notification sources
        // if (
        //   input.source === "NOTIFICATION" &&
        //   !ALLOWED_NOTIFICATION_CATEGORIES.includes(
        //     aiResult.category as ExpenseCategory,
        //   )
        // ) 
        // {
        //   return {
        //     success: false,
        //     skipped: true,
        //     reason: `Category '${aiResult.category}' is not allowed for auto-notification parsing.`,
        //   };
        // }

        // Skip credit/refund transactions
        if (aiResult.notes?.includes("CREDIT_TXN")) {
          return {
            success: false,
            skipped: true,
            reason: "This is a credit/refund, not an expense.",
          };
        }

        const expense = await db.expense.create({
          data: {
            customerId,
            amount: aiResult.amount,
            category: aiResult.category as ExpenseCategory,
            merchantName: aiResult.merchantName || null,
            date: aiResult.date
              ? new Date(aiResult.date)
              : input.timestamp
                ? new Date(input.timestamp)
                : new Date(),
            source: input.source as ExpenseSource,
            rawText: text,
            isAutomated: true,
            notes: `AI-parsed (Confidence: ${aiResult.confidence})${aiResult.notes ? ` | ${aiResult.notes}` : ""}`,
          },
        });

        this.checkBudget(
          customerId,
          aiResult.category as ExpenseCategory,
          aiResult.amount,
        ).catch(console.error);

        // Fuel enrichment
        let fuelIntelligence = null;
        if (aiResult.category === "FUEL") {
          try {
            fuelIntelligence = await fuelPriceService.enrichFuelExpense(
              aiResult.amount,
              "Delhi",
              "PETROL",
            );
          } catch (_) {
            /* non-critical */
          }
        }

        // 🔧 SERVICE EXPENSE: Prompt user to upload bill for exact part tracking
        let serviceRecord = null;
        if (aiResult.category === "SERVICE" || aiResult.category === "REPAIR") {
          // Don't predict — ask for the actual bill
          await db.inAppNotification.create({
            data: {
              customerId,
              title: "📸 Upload your service bill",
              body: `We detected ₹${aiResult.amount} at ${aiResult.merchantName || "a service center"}. Upload the bill to auto-track parts, warranty & next service date.`,
              type: "ACTION",
              link: `/expenses/${expense.id}/upload-bill`,
              metadata: {
                expenseId: expense.id,
                action: "UPLOAD_SERVICE_BILL",
              },
            },
          });

          serviceRecord = {
            status: "AWAITING_BILL",
            message:
              "Upload your service bill for exact part & warranty tracking.",
            uploadUrl: `/expenses/${expense.id}/upload-bill`,
          };
        }

        return {
          success: true,
          expense,
          fuelIntelligence,
          serviceRecord,
          parserMeta: {
            method: "GEMINI_AI",
            confidence: aiResult.confidence,
            category: aiResult.category,
            amount: aiResult.amount,
            merchantName: aiResult.merchantName,
          },
        };
      }
    } catch (err) {
      logger.warn({ err }, "Gemini AI parser failed, falling back to regex");
    }

    // ===== STEP 2: UPI REGEX PARSER (Fallback — for UPI notifications) =====
    if (upiParserService.isTransactionNotification(text)) {
      const upiResult = upiParserService.parse(text);
      if (upiResult && upiResult.amount > 0) {
        // DRY RUN: return preview without creating expense
        if (opts?.dryRun) {
          return {
            success: true,
            dryRun: true,
            expense: {
              amount: upiResult.amount,
              category: upiResult.category,
              merchantName: upiResult.merchantName || 'Unknown Merchant',
              date: upiResult.date,
              notes: null,
            },
            parserMeta: { method: 'UPI_REGEX_FALLBACK', confidence: upiResult.confidence },
          };
        }

        const dupCheck = await expenseIntelligenceService.isDuplicate(
          customerId,
          upiResult.amount,
          upiResult.category,
          new Date(),
        );
        if (dupCheck.isDuplicate) {
          return {
            success: false,
            skipped: true,
            reason: dupCheck.reason,
            existingExpenseId: dupCheck.existingExpenseId,
          };
        }

        // Filter Notification sources
        // if (
        //   input.source === "NOTIFICATION" &&
        //   !ALLOWED_NOTIFICATION_CATEGORIES.includes(
        //     upiResult.category as ExpenseCategory,
        //   )
        // )
        //  {
        //   return {
        //     success: false,
        //     skipped: true,
        //     reason: `Category '${upiResult.category}' is not allowed for auto-notification parsing.`,
        //   };
        // }

        const expense = await db.expense.create({
          data: {
            customerId,
            amount: upiResult.amount,
            category: upiResult.category as ExpenseCategory,
            merchantName: upiResult.merchantName || "Unknown Merchant",
            date: upiResult.date,
            source: input.source as ExpenseSource,
            rawText: text,
            isAutomated: true,
            notes: `Regex-parsed via UPI (${upiResult.source}, Confidence: ${upiResult.confidence})`,
          },
        });

        this.checkBudget(
          customerId,
          upiResult.category as ExpenseCategory,
          upiResult.amount,
        ).catch(console.error);

        let fuelIntelligence = null;
        if (upiResult.category === "FUEL") {
          try {
            fuelIntelligence = await fuelPriceService.enrichFuelExpense(
              upiResult.amount,
              "Delhi",
              "PETROL",
            );
          } catch (_) { }
        }

        return {
          success: true,
          expense,
          fuelIntelligence,
          parserMeta: {
            method: "UPI_REGEX_FALLBACK",
            confidence: upiResult.confidence,
            category: upiResult.category,
            amount: upiResult.amount,
          },
        };
      }
    }

    // ===== STEP 3: BASIC REGEX (Last resort — no AI, no UPI pattern) =====
    const normalized = text.toLowerCase();
    const amountRegex = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{2})?)/i;
    const amountMatch = text.match(amountRegex);

    let amount = 0;
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    } else {
      if (
        normalized.includes("spent") ||
        normalized.includes("paid") ||
        normalized.includes("debit")
      ) {
        const match = text.match(/(\d+(?:\.\d{2})?)/);
        if (match) amount = parseFloat(match[1]);
      }
    }

    if (!amount) {
      if (opts?.returnOnNoAmount) {
        return { success: false, parseFailed: true };
      }
      throw AppError.badRequest(
        "Could not detect expense amount in text. Try voice command instead.",
      );
    }

    let category: ExpenseCategory = "OTHER";
    let confidence = "LOW";

    if (
      this.containsAny(normalized, [
        "petrol",
        "fuel",
        "diesel",
        "cng",
        "pump",
        "iocl",
        "hpcl",
        "bpcl",
        "shell",
      ])
    ) {
      category = "FUEL";
      confidence = "HIGH";
    } else if (
      this.containsAny(normalized, ["toll", "fastag", "nhai", "plaza"])
    ) {
      category = "TOLL";
      confidence = "HIGH";
    } else if (
      this.containsAny(normalized, [
        "service",
        "repair",
        "garage",
        "workshop",
        "mechanic",
      ])
    ) {
      category = "SERVICE";
      confidence = "MEDIUM";
    } else if (this.containsAny(normalized, ["parking"])) {
      category = "PARKING";
      confidence = "HIGH";
    } else if (this.containsAny(normalized, ["challan", "fine", "traffic"])) {
      category = "CHALLAN";
      confidence = "HIGH";
    } else if (
      this.containsAny(normalized, ["insurance", "policy", "premium"])
    ) {
      category = "INSURANCE";
      confidence = "HIGH";
    }

    let merchantName = "Unknown Merchant";
    const mMatch = text.match(/(?:at|to|via)\s+([a-zA-Z0-9\s]+)/i);
    if (mMatch && mMatch[1]) merchantName = mMatch[1].trim().substring(0, 30);

    // Filter Notification sources
    // if (
    //   input.source === "NOTIFICATION" &&
    //   !ALLOWED_NOTIFICATION_CATEGORIES.includes(category)
    // ) {
    //   return {
    //     success: false,
    //     skipped: true,
    //     reason: `Category '${category}' is not allowed for auto-notification parsing.`,
    //   };
    // }

    // DRY RUN: return preview without creating expense
    if (opts?.dryRun) {
      return {
        success: true,
        dryRun: true,
        expense: {
          amount,
          category,
          merchantName,
          date: input.timestamp ? new Date(input.timestamp) : new Date(),
          notes: null,
        },
        parserMeta: { method: 'BASIC_REGEX_LAST_RESORT', confidence },
      };
    }

    const expense = await db.expense.create({
      data: {
        customerId,
        amount,
        category,
        merchantName,
        date: input.timestamp ? new Date(input.timestamp) : new Date(),
        source: input.source as ExpenseSource,
        rawText: text,
        isAutomated: true,
        notes: `Regex last-resort (Confidence: ${confidence}) — AI was unavailable`,
      },
    });

    this.checkBudget(customerId, category, amount).catch(console.error);

    let fuelIntelligence = null;
    if (category === "FUEL") {
      try {
        fuelIntelligence = await fuelPriceService.enrichFuelExpense(
          amount,
          "Delhi",
          "PETROL",
        );
      } catch (_) { }
    }

    return {
      success: true,
      expense,
      fuelIntelligence,
      parserMeta: {
        method: "BASIC_REGEX_LAST_RESORT",
        confidence,
        category,
        amount,
      },
    };
  },

  /**
   * AUTO SERVICE RECORD CREATOR
   * ============================
   * When a SERVICE/REPAIR expense is detected, AI predicts parts and
   * auto-creates a ServiceRecord + ServiceParts with warranty tracking.
   * Runs async — does not block the expense response.
   */
  async autoCreateServiceRecord(
    expenseId: string,
    vehicleId: string | null,
    rawText: string,
    amount: number,
    merchantName: string | null,
    customerId: string,
  ): Promise<void> {
    // Need a vehicleId to link the service record
    if (!vehicleId) {
      // Try to find user's default/only vehicle
      const vehicles = await dbInstances.customerVehicle.findMany({
        where: { customerId },
        select: { id: true },
        take: 1,
      });
      if (vehicles.length === 0) {
        logger.info("No vehicle found for auto service record — skipping");
        return;
      }
      vehicleId = vehicles[0].id;
    }

    try {
      // AI predicts what was serviced
      const serviceDetails = await ocrService.parseServiceDetails(
        rawText,
        amount,
        merchantName,
      );

      // Fetch current odometer for fallback
      const vehicle = await dbInstances.customerVehicle.findUnique({
        where: { id: vehicleId! },
        select: { currentOdometer: true },
      });

      // Auto-create the service record
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

      // Recalculate health score for AI detection
      void vehicleService.calculateHealthScore(vehicleId!).catch(e =>
        logger.error({ e, vehicleId }, "Background health recalculation failed")
      );

      // Notify user about auto-created service record
      await db.inAppNotification.create({
        data: {
          customerId,
          title: "🔧 Service Record Auto-Created",
          body: `We detected a service expense of ₹${amount}${merchantName ? ` at ${merchantName}` : ""}. Parts and warranty have been auto-tracked. Tap to review.`,
          type: "INFO",
          link: "/expenses/warranty",
          metadata: {
            expenseId,
            serviceType: serviceDetails.serviceType,
            partsCount: serviceDetails.predictedParts.length,
            confidence: serviceDetails.confidence,
          },
        },
      });

      logger.info(
        {
          expenseId,
          vehicleId,
          partsCount: serviceDetails.predictedParts.length,
        },
        "Auto-created service record from expense",
      );
    } catch (err) {
      logger.error(
        { err, expenseId },
        "Auto service record creation failed (non-critical)",
      );
    }
  },
  /**
   * PARSE SERVICE BILL (Exact — from uploaded bill image)
   * =====================================================
   * User uploads the garage bill photo → AI OCR reads exact line items
   * → Creates accurate ServiceRecord + ServiceParts
   * No predictions, only exact data from the bill.
   */
  async parseServiceBill(
    customerId: string,
    expenseId: string,
    file: UploadedFile,
  ) {
    // 1. Find the expense
    const expense = await db.expense.findFirst({
      where: { id: expenseId, customerId },
    });

    if (!expense) throw AppError.notFound("Expense not found");
    if (expense.category !== "SERVICE" && expense.category !== "REPAIR") {
      throw AppError.badRequest("This expense is not a service/repair expense");
    }

    // 2. Upload the bill image
    const uploaded = await storageService.uploadFile(
      file,
      `service-bills/${customerId}`,
    );

    // 3. AI OCR: Extract exact line items from the bill
    const genAI = (await import("@google/generative-ai")).GoogleGenerativeAI;
    const env = (await import("../../config/env")).env;

    if (!env.GEMINI_API_KEY) {
      throw AppError.badRequest(
        "AI not configured — please add parts manually",
      );
    }

    const ai = new genAI(env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
            You are an expert at reading Indian vehicle service bills/invoices.
            Extract ALL line items from this service bill image.

            Return a JSON object with:
            - garageName: Name of the garage/service center
            - serviceDate: Date on the bill (YYYY-MM-DD format)
            - vehicleNumber: Vehicle registration number if visible (e.g., "DL01AB1234")
            - odometerReading: Odometer reading if visible on the bill
            - items: Array of line items, each with:
                - description: The item/service description as written on bill
                - partType: Map to one of: "ENGINE_OIL", "OIL_FILTER", "AIR_FILTER", "BRAKE_PADS", "BRAKE_DISCS", "BATTERY", "TYRES", "CLUTCH_PLATES", "SPARK_PLUGS", "COOLANT", "TIMING_BELT", "AC_FILTER", "WIPER_BLADES", "HEADLIGHT_BULB", "OTHER"
                  (Use "OTHER" for labor charges, washing, inspection, etc.)
                - brand: Brand name if visible (e.g., "Castrol", "Bosch")
                - quantity: Number of units
                - rate: Price per unit
                - amount: Total amount for this line item
                - isLabor: true if this is a labor/service charge, false if it's a part/material
            - totalAmount: Grand total on the bill
            - nextServiceKm: If mentioned on bill (e.g., "Next service at 55,000 km")
            - nextServiceDate: If mentioned on bill
            - notes: Any additional observations (warranty text, special instructions)

            Rules:
            1. Return ONLY valid JSON. No markdown.
            2. Read EVERY line item — don't skip any.
            3. Amounts should be numbers, not strings.
            4. If a field is not visible, use null.
            5. Be precise with amounts — read exact numbers from the bill.
        `;

    const imagePart = {
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype,
      },
    };

    let billData: any;
    try {
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const responseText = response.text();
      const jsonStr = responseText.replace(/```json|```/g, "").trim();
      billData = JSON.parse(jsonStr);
    } catch (err) {
      if (isGeminiRateLimitError(err)) {
        throw AppError.tooManyRequests(
          "AI is busy. Please try again in a moment.",
          "GEMINI_RATE_LIMIT"
        );
      }
      throw err;
    }

    // 4. Update expense with bill image
    await db.expense.update({
      where: { id: expenseId },
      data: {
        receiptUrl: uploaded.url,
        mimeType: file.mimetype,
        merchantName: billData.garageName || expense.merchantName,
      },
    });

    // 5. Find or determine vehicleId
    let vehicleId = expense.vehicleId;
    if (!vehicleId) {
      // Try to match by vehicle number from bill
      if (billData.vehicleNumber) {
        const vehicle = await dbInstances.customerVehicle.findFirst({
          where: {
            customerId,
            registrationNumber: {
              contains: billData.vehicleNumber,
              mode: "insensitive",
            },
          },
          select: { id: true },
        });
        if (vehicle) vehicleId = vehicle.id;
      }

      // Fallback: use first vehicle
      if (!vehicleId) {
        const vehicles = await dbInstances.customerVehicle.findMany({
          where: { customerId },
          select: { id: true },
          take: 1,
        });
        if (vehicles.length > 0) vehicleId = vehicles[0].id;
      }
    }

    if (!vehicleId) {
      return {
        success: true,
        billData,
        serviceRecord: null,
        message: "Bill parsed but no vehicle found. Add a vehicle first.",
      };
    }

    // 6. Create ACCURATE service record from exact bill data
    const partsFromBill = (billData.items || [])
      .filter((item: any) => !item.isLabor && item.partType !== "OTHER")
      .map((item: any) => ({
        partType: item.partType,
        partName: item.description,
        brand: item.brand || undefined,
        cost: item.amount,
        warrantyMonths: this.getDefaultWarranty(item.partType),
      }));

    if (partsFromBill.length === 0) {
      // Bill had only labor charges — still create record but with generic entry
      partsFromBill.push({
        partType: "OTHER",
        partName: "General Service",
        cost: billData.totalAmount || expense.amount,
        warrantyMonths: 3,
      });
    }

    // Fallback odometer from vehicle if bill parsing missed it
    let odometerAtService = billData.odometerReading;
    if (odometerAtService === null || odometerAtService === undefined) {
      const vehicle = await dbInstances.customerVehicle.findUnique({
        where: { id: vehicleId },
        select: { currentOdometer: true },
      });
      odometerAtService = vehicle?.currentOdometer || undefined;
    }

    const serviceRecord = await warrantyService.createServiceRecord({
      vehicleId,
      expenseId,
      serviceType: "REGULAR_SERVICE",
      garageName: billData.garageName || undefined,
      odometerAtService: (odometerAtService !== null && odometerAtService !== undefined) ? Number(odometerAtService) : undefined,
      serviceDate: billData.serviceDate || undefined,
      nextServiceKm: billData.nextServiceKm || undefined,
      notes: `📸 Extracted from uploaded bill. ${billData.notes || ""}`,
      parts: partsFromBill,
    });

    // 7. Notify user
    await db.inAppNotification.create({
      data: {
        customerId,
        title: "✅ Bill Processed — Parts & Warranty Tracked",
        body: `${partsFromBill.length} parts extracted from your ${billData.garageName || "service"} bill. Warranty dates auto-set.`,
        type: "SUCCESS",
        link: "/expenses/warranty",
        metadata: { expenseId, partsCount: partsFromBill.length },
      },
    });

    return {
      success: true,
      billData,
      serviceRecord,
      partsTracked: partsFromBill.length,
    };
  },

  /**
   * Default warranty months by part type (used when bill doesn't specify warranty)
   */
  getDefaultWarranty(partType: string): number {
    const defaults: Record<string, number> = {
      ENGINE_OIL: 6,
      OIL_FILTER: 6,
      AIR_FILTER: 12,
      BRAKE_PADS: 12,
      BRAKE_DISCS: 18,
      BATTERY: 24,
      TYRES: 36,
      CLUTCH_PLATES: 12,
      SPARK_PLUGS: 12,
      COOLANT: 12,
      TIMING_BELT: 24,
      AC_FILTER: 12,
      WIPER_BLADES: 6,
      HEADLIGHT_BULB: 6,
      OTHER: 3,
    };
    return defaults[partType] || 3;
  },

  /**
   * OCR Method for Files (if user uploads a bill)
   */
  async parseReceiptImage(
    customerId: string,
    file: UploadedFile,
    dryRun = false,
  ) {
    // 1. Upload
    const uploaded = await storageService.uploadFile(
      file,
      `expenses/${customerId}`,
    );

    // 2. Perform OCR & Parsing using dedicated receipt parser
    let aiResult: any = {};
    try {
      aiResult = await ocrService.parseReceipt(file.buffer, file.mimetype);
    } catch (e) {
      // Fallback
      aiResult = { rawText: await ocrService.extractText(file.buffer) };
    }

    // 2b. Reject if the image is not a receipt/bill/invoice
    if (aiResult.isReceipt === false && aiResult.error) {
      throw AppError.badRequest(
        aiResult.error || "Please scan a receipt or bill. This image does not look like a receipt.",
      );
    }

    // 3. If AI found structured data (amount is key), use it directly
    if (aiResult.amount) {
      // DRY RUN: Return data without creating expense
      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          expense: {
            amount: aiResult.amount,
            category: aiResult.category || "OTHER",
            merchantName: aiResult.merchantName || "Unknown Merchant",
            date: aiResult.date ? new Date(aiResult.date) : new Date(),
            notes: aiResult.notes,
            receiptUrl: uploaded.url,
            mimeType: file.mimetype,
          },
        };
      }

      // Deduplication Check
      const dupCheck = await expenseIntelligenceService.isDuplicate(
        customerId,
        aiResult.amount,
        aiResult.category || "OTHER",
        aiResult.date ? new Date(aiResult.date) : new Date(),
      );

      if (dupCheck.isDuplicate) {
        return {
          success: false,
          skipped: true,
          reason: dupCheck.reason,
          existingExpenseId: dupCheck.existingExpenseId,
        };
      }

      // Find vehicle: Try to match by reg number from receipt, else default to primary
      let vehicleId = null;
      if (aiResult.vehicleNumber) {
        const matchedVehicle = await dbInstances.customerVehicle.findFirst({
          where: {
            customerId,
            registrationNumber: {
              contains: aiResult.vehicleNumber,
              mode: "insensitive",
            },
          },
          select: { id: true },
        });
        if (matchedVehicle) vehicleId = matchedVehicle.id;
      }

      // Fallback: Use primary vehicle if not found by reg number
      if (!vehicleId) {
        const primaryVehicle = await dbInstances.customerVehicle.findFirst({
          where: { customerId, isPrimary: true },
          select: { id: true },
        });
        if (primaryVehicle) {
          vehicleId = primaryVehicle.id;
        } else {
          // Fallback to any first vehicle
          const anyVehicle = await dbInstances.customerVehicle.findFirst({
            where: { customerId },
            select: { id: true },
          });
          if (anyVehicle) vehicleId = anyVehicle.id;
        }
      }

      const expense = await db.expense.create({
        data: {
          customerId,
          vehicleId,
          amount: aiResult.amount,
          category: aiResult.category || "OTHER",
          merchantName: aiResult.merchantName || "Unknown Merchant",
          date: aiResult.date ? new Date(aiResult.date) : new Date(),
          source: "RECEIPT",
          rawText: aiResult.rawText || aiResult.notes || "Receipt Upload",
          isAutomated: true,
          receiptUrl: uploaded.url,
          mimeType: file.mimetype,
          notes: aiResult.notes,
        },
      });

      this.pruneOldReceiptImages(customerId).catch((err) =>
        logger.error({ err, customerId }, "Failed to prune old receipt images"),
      );

      return { success: true, expense };
    }

    // 4. Fallback: Feed raw text into Parser if AI failed structured parse
    let parsed: Awaited<ReturnType<typeof this.parseExpenseText>>;
    try {
      parsed = await this.parseExpenseText(
        customerId,
        {
          text: aiResult.rawText || "",
          source: "RECEIPT",
          timestamp: new Date().toISOString(),
        },
        { returnOnNoAmount: true },
      );
    } catch {
      // parseExpenseText threw (e.g. old code path) — return receipt URL so user can enter manually
      return {
        success: false,
        receiptUrl: uploaded.url,
        mimeType: file.mimetype,
        error: {
          message:
            "Could not detect expense amount in text. You can enter it manually.",
          code: "PARSE_FAILED",
        },
      };
    }

    if (parsed.parseFailed) {
      return {
        success: false,
        receiptUrl: uploaded.url,
        mimeType: file.mimetype,
        error: {
          message:
            "Could not detect expense amount in text. You can enter it manually.",
          code: "PARSE_FAILED",
        },
      };
    }

    // Update the receipt URL on the created expense
    if (parsed.expense) {
      await db.expense.update({
        where: { id: parsed.expense.id },
        data: {
          receiptUrl: uploaded.url,
          mimeType: file.mimetype,
        },
      });

      this.pruneOldReceiptImages(customerId).catch((err) =>
        logger.error({ err, customerId }, "Failed to prune old receipt images"),
      );
    }

    return parsed;
  },

  /**
   * Voice Command: User speaks the expense, Gemini transcribes + extracts.
   * Example: "Kal Indian Oil mein 2000 ka petrol dalwaya"
   * Result: { amount: 2000, category: FUEL, merchant: "Indian Oil", date: yesterday }
   */
  async createExpenseFromVoice(customerId: string, file: UploadedFile) {
    // 1. Send audio to Gemini for transcription + extraction
    const aiResult = await ocrService.parseVoiceExpense(
      file.buffer,
      file.mimetype,
    );

    if (aiResult.error || !aiResult.amount) {
      throw AppError.badRequest(
        aiResult.error ||
        "Could not understand the voice command. Please try again clearly.",
      );
    }

    // 2. Validate the category (fallback to OTHER if AI returns garbage)
    const validCategories = [
      "FUEL",
      "TOLL",
      "PARKING",
      "SERVICE",
      "INSURANCE",
      "CHALLAN",
      "EMI",
      "OTHER",
    ];
    const category = validCategories.includes(aiResult.category)
      ? aiResult.category
      : "OTHER";

    // 3. Create the expense record
    const expense = await db.expense.create({
      data: {
        customerId,
        amount: aiResult.amount,
        category,
        merchantName: aiResult.merchantName || null,
        date: aiResult.date ? new Date(aiResult.date) : new Date(),
        source: "VOICE",
        rawText: aiResult.transcription || "Voice Input",
        isAutomated: true,
        notes: aiResult.notes || `Voice: "${aiResult.transcription}"`,
      },
    });

    // 4. Trigger Budget Check
    this.checkBudget(customerId, category, aiResult.amount).catch(
      console.error,
    );

    // 5. If category is SERVICE/REPAIR and parts are found, create a service record
    let serviceRecord = null;
    if (
      (category === "SERVICE" || category === "REPAIR") &&
      aiResult.parts &&
      Array.isArray(aiResult.parts) &&
      aiResult.parts.length > 0
    ) {
      try {
        // Find user's default/only vehicle
        const vehicles = await dbInstances.customerVehicle.findMany({
          where: { customerId },
          select: { id: true },
          take: 1,
        });

        if (vehicles.length > 0) {
          const vehicleId = vehicles[0].id;

          const partsToCreate = aiResult.parts.map((p: any) => {
            let type = "OTHER";
            const name = (p.partName || "").toUpperCase();
            if (name.includes("OIL") && name.includes("ENGINE"))
              type = "ENGINE_OIL";
            else if (name.includes("FILTER") && name.includes("OIL"))
              type = "OIL_FILTER";
            else if (name.includes("FILTER") && name.includes("AIR"))
              type = "AIR_FILTER";
            else if (name.includes("BRAKE") && name.includes("PAD"))
              type = "BRAKE_PADS";
            else if (name.includes("BATTERY")) type = "BATTERY";
            else if (name.includes("TYRE")) type = "TYRES";
            else if (name.includes("COOLANT")) type = "COOLANT";
            else if (name.includes("PLUG")) type = "SPARK_PLUGS";

            return {
              partType: type,
              partName: p.partName,
              cost: p.amount,
              warrantyMonths: this.getDefaultWarranty(type),
            };
          });

          // Fetch current odometer for fallback
          const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: vehicleId! },
            select: { currentOdometer: true },
          });

          serviceRecord = await warrantyService.createServiceRecord({
            vehicleId: vehicleId!,
            expenseId: expense.id,
            serviceType: "REGULAR_SERVICE",
            garageName: aiResult.merchantName || undefined,
            odometerAtService: vehicle?.currentOdometer || undefined,
            serviceDate: aiResult.date
              ? new Date(aiResult.date).toISOString()
              : new Date().toISOString(),
            notes: `🎤 Created from voice command: "${aiResult.transcription}"`,
            parts: partsToCreate,
          });

          // Notify user
          await db.inAppNotification.create({
            data: {
              customerId,
              title: "✅ Service Details Captured via Voice",
              body: `Captured ${partsToCreate.length} items from your voice command. Warranty tracking active.`,
              type: "SUCCESS",
              link: "/expenses/warranty",
              metadata: {
                expenseId: expense.id,
                partsCount: partsToCreate.length,
              },
            },
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to create service record from voice");
      }
    }

    return {
      success: true,
      expense,
      serviceRecord,
      voiceMeta: {
        transcription: aiResult.transcription,
        confidence: aiResult.confidence || "MEDIUM",
        detectedAmount: aiResult.amount,
        detectedCategory: category,
        detectedMerchant: aiResult.merchantName,
        partsExtracted: aiResult.parts ? aiResult.parts.length : 0,
      },
    };
  },

  /**
   * Preview only: parse voice text and return extracted expense data without creating.
   * Used to show confirmation screen before saving.
   */
  async previewExpenseFromVoiceText(text: string) {
    const aiResult = await ocrService.parseVoiceExpenseFromText(text);

    if (aiResult.error) {
      throw AppError.badRequest(
        aiResult.error || "Could not understand the voice command. Please try again clearly.",
      );
    }

    const amount = Number(aiResult.amount) || 0;
    if (amount <= 0) {
      throw AppError.badRequest(
        "Could not detect expense amount. Please say the amount clearly (e.g. 500 rupees on fuel).",
      );
    }

    const validCategories = [
      "FUEL",
      "TOLL",
      "PARKING",
      "SERVICE",
      "INSURANCE",
      "CHALLAN",
      "EMI",
      "OTHER",
    ];
    const category = validCategories.includes(aiResult.category)
      ? aiResult.category
      : "OTHER";

    let expenseDate = new Date();
    if (aiResult.date) {
      const parsed = new Date(aiResult.date);
      const now = new Date();
      if (parsed.getFullYear() < now.getFullYear()) {
        parsed.setFullYear(now.getFullYear());
      }
      expenseDate = parsed;
    }

    return {
      success: true,
      dryRun: true,
      expense: {
        amount,
        category,
        merchantName: aiResult.merchantName || null,
        date: expenseDate.toISOString().split("T")[0],
        notes: aiResult.notes || `Voice: "${aiResult.transcription || text}"`,
        transcription: aiResult.transcription || text,
      },
    };
  },

  /**
   * Preview only: parse voice audio (Gemini transcribes + extracts; auto language).
   * Used when app uploads recording for language-auto flow.
   */
  async previewExpenseFromVoiceAudio(customerId: string, file: UploadedFile) {
    const aiResult = await ocrService.parseVoiceExpense(
      file.buffer,
      file.mimetype,
    );

    if (aiResult.error) {
      throw AppError.badRequest(
        aiResult.error || "Could not understand the voice. Please try again clearly.",
      );
    }

    const amount = Number(aiResult.amount) || 0;
    if (amount <= 0) {
      throw AppError.badRequest(
        "Could not detect expense amount. Please say the amount clearly.",
      );
    }

    const validCategories = [
      "FUEL",
      "TOLL",
      "PARKING",
      "SERVICE",
      "INSURANCE",
      "CHALLAN",
      "EMI",
      "OTHER",
    ];
    const category = validCategories.includes(aiResult.category)
      ? aiResult.category
      : "OTHER";

    let expenseDate = new Date();
    if (aiResult.date) {
      const parsed = new Date(aiResult.date);
      const now = new Date();
      if (parsed.getFullYear() < now.getFullYear()) {
        parsed.setFullYear(now.getFullYear());
      }
      expenseDate = parsed;
    }

    return {
      success: true,
      dryRun: true,
      expense: {
        amount,
        category,
        merchantName: aiResult.merchantName || null,
        date: expenseDate.toISOString().split("T")[0],
        notes: aiResult.notes || `Voice: "${aiResult.transcription || ""}"`,
        transcription: aiResult.transcription || "",
      },
    };
  },

  /**
   * Voice command from already-transcribed text (e.g. device speech-to-text).
   * Same flow as createExpenseFromVoice but uses parseVoiceExpenseFromText.
   */
  async createExpenseFromVoiceText(customerId: string, text: string) {
    const aiResult = await ocrService.parseVoiceExpenseFromText(text);

    if (aiResult.error) {
      throw AppError.badRequest(
        aiResult.error || "Could not understand the voice command. Please try again clearly.",
      );
    }

    const amount = Number(aiResult.amount) || 0;
    if (amount <= 0) {
      throw AppError.badRequest(
        "Could not detect expense amount. Please say the amount clearly (e.g. 500 rupees on fuel).",
      );
    }

    const validCategories = [
      "FUEL",
      "TOLL",
      "PARKING",
      "SERVICE",
      "INSURANCE",
      "CHALLAN",
      "EMI",
      "OTHER",
    ];
    const category = validCategories.includes(aiResult.category)
      ? aiResult.category
      : "OTHER";

    // Normalize date: if AI returned a past year (e.g. 2024), use current year so "yesterday" is correct
    let expenseDate = new Date();
    if (aiResult.date) {
      const parsed = new Date(aiResult.date);
      const now = new Date();
      if (parsed.getFullYear() < now.getFullYear()) {
        parsed.setFullYear(now.getFullYear());
      }
      expenseDate = parsed;
    }

    // Logic: Try to find the primary vehicle for this customer
    const primaryVehicle = await (dbInstances as any).customerVehicle.findFirst({
      where: { customerId, isPrimary: true, isActive: true },
      select: { id: true },
    });

    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: primaryVehicle?.id || null,
        amount,
        category,
        merchantName: aiResult.merchantName || null,
        date: expenseDate,
        source: "VOICE",
        rawText: aiResult.transcription || text,
        isAutomated: true,
        notes: aiResult.notes || `Voice: "${aiResult.transcription || text}"`,
      },
    });

    this.checkBudget(customerId, category, amount).catch(console.error);

    let serviceRecord = null;
    if (
      (category === "SERVICE" || category === "REPAIR") &&
      aiResult.parts &&
      Array.isArray(aiResult.parts) &&
      aiResult.parts.length > 0
    ) {
      try {
        const vehicles = await dbInstances.customerVehicle.findMany({
          where: { customerId },
          select: { id: true },
          take: 1,
        });
        if (vehicles.length > 0) {
          const vehicleId = vehicles[0].id;
          const partsToCreate = aiResult.parts.map((p: any) => {
            let type = "OTHER";
            const name = (p.partName || "").toUpperCase();
            if (name.includes("OIL") && name.includes("ENGINE")) type = "ENGINE_OIL";
            else if (name.includes("FILTER") && name.includes("OIL")) type = "OIL_FILTER";
            else if (name.includes("FILTER") && name.includes("AIR")) type = "AIR_FILTER";
            else if (name.includes("BRAKE") && name.includes("PAD")) type = "BRAKE_PADS";
            else if (name.includes("BATTERY")) type = "BATTERY";
            else if (name.includes("TYRE")) type = "TYRES";
            else if (name.includes("COOLANT")) type = "COOLANT";
            else if (name.includes("PLUG")) type = "SPARK_PLUGS";
            return {
              partType: type,
              partName: p.partName,
              cost: p.amount,
              warrantyMonths: this.getDefaultWarranty(type),
            };
          });
          // Fetch current odometer for fallback
          const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: vehicleId! },
            select: { currentOdometer: true },
          });

          serviceRecord = await warrantyService.createServiceRecord({
            vehicleId: vehicleId!,
            expenseId: expense.id,
            serviceType: "REGULAR_SERVICE",
            garageName: aiResult.merchantName || undefined,
            odometerAtService: vehicle?.currentOdometer || undefined,
            serviceDate: aiResult.date ? new Date(aiResult.date).toISOString() : new Date().toISOString(),
            notes: `🎤 Created from voice: "${aiResult.transcription || text}"`,
            parts: partsToCreate,
          });
          await db.inAppNotification.create({
            data: {
              customerId,
              title: "✅ Service Details Captured via Voice",
              body: `Captured ${partsToCreate.length} items from your voice command.`,
              type: "SUCCESS",
              link: "/expenses/warranty",
              metadata: { expenseId: expense.id, partsCount: partsToCreate.length },
            },
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to create service record from voice text");
      }
    }

    return {
      success: true,
      expense,
      serviceRecord,
      voiceMeta: {
        transcription: aiResult.transcription ?? text,
        confidence: aiResult.confidence || "MEDIUM",
        detectedAmount: amount,
        detectedCategory: category,
        detectedMerchant: aiResult.merchantName,
        partsExtracted: aiResult.parts ? aiResult.parts.length : 0,
      },
    };
  },

  /**
   * Listing with Filters
   */
  async listExpenses(customerId: string, query: any) {
    const where: any = { customerId };

    if (query.category) where.category = query.category;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.startDate && query.endDate) {
      where.date = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: "desc" },
      take: 50, // limit
    });

    // Simple aggregation
    const total = await db.expense.aggregate({
      where,
      _sum: { amount: true },
    });

    return { expenses, totalAmount: total._sum.amount || 0 };
  },

  /**
   * Keep only the latest receipt images per customer and remove older files.
   */
  async pruneOldReceiptImages(customerId: string, keep = MAX_RECEIPT_IMAGES_PER_CUSTOMER) {
    const oldReceipts = await db.expense.findMany({
      where: {
        customerId,
        receiptUrl: { not: null },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: keep,
      select: { id: true, receiptUrl: true },
    });

    if (!oldReceipts.length) return;

    await Promise.all(
      oldReceipts.map(async (row: { id: string; receiptUrl: string | null }) => {
        if (!row.receiptUrl) return;
        try {
          await storageService.deleteFile(row.receiptUrl);
        } catch (err) {
          logger.warn({ err, customerId, expenseId: row.id }, "Could not delete old receipt file");
        }
      }),
    );

    await db.expense.updateMany({
      where: { id: { in: oldReceipts.map((row: { id: string }) => row.id) } },
      data: { receiptUrl: null, mimeType: null },
    });
  },

  /**
   * Analytics: Category Pie Chart
   */
  async getSummary(customerId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month || now.getMonth();
    const y = year || now.getFullYear();

    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);

    const group = await db.expense.groupBy({
      by: ["category"],
      where: {
        customerId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    return {
      period: `${m + 1}-${y}`,
      breakdown: group.map((g: any) => ({
        category: g.category,
        total: g._sum.amount || 0,
      })),
    };
  },

  /**
   * Budget Management
   */
  async setBudget(customerId: string, input: ExpenseBudgetInput) {
    return db.expenseBudget.upsert({
      where: {
        customerId_category: {
          customerId,
          category: input.category,
        },
      },
      update: {
        amount: input.amount,
        period: input.period,
        notifyThreshold: input.notifyThreshold,
        isActive: true,
      },
      create: {
        customerId,
        ...input,
      },
    });
  },

  /**
   * Utility: Parse Helper
   */
  containsAny(str: string, keywords: string[]) {
    return keywords.some((k) => str.includes(k));
  },

  /**
   * Utility: Check Budget & Notify
   */
  async checkBudget(
    customerId: string,
    category: ExpenseCategory,
    newExpenseAmount: number,
  ) {
    // Find active budget
    const budget = await db.expenseBudget.findUnique({
      where: { customerId_category: { customerId, category } },
    });

    if (!budget || !budget.isActive) return;

    // Calculate total for this month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const total = await db.expense.aggregate({
      where: {
        customerId,
        category,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const currentTotal = total._sum.amount || 0;
    const percentage = (currentTotal / budget.amount) * 100;

    // Trigger Alert if crossed threshold
    if (percentage >= budget.notifyThreshold) {
      // Check if we already notified recently? (Simplification: just trigger always for now)
      // Creating In-App Notification
      await db.inAppNotification.create({
        data: {
          customerId,
          title: `Budget Alert: ${category}`,
          body: `You have used ${Math.round(percentage)}% of your ${category} budget (₹${currentTotal} / ₹${budget.amount}).`,
          type: "WARNING",
          link: "/expenses/budgets",
          metadata: { category, percentage, currentTotal },
        },
      });
      // TODO: Push Notification also
    }
  },
};

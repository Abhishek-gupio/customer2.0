import { dbInstances } from "@repo/db-customer";
import { ParseExpenseInput, ExpenseCategory, ExpenseSource } from "./expense.validators";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { vehicleService } from "../vehicle/vehicle.service";
import { ocrService } from "../../services/ocr.service";
import { upiParserService } from "../../services/upi-parser.service";
import { fuelPriceService } from "../../services/fuel-price.service";
import { expenseIntelligenceService } from "../../services/expense-intelligence.service";
import { queues } from "../../config/queue";
import { expenseBudgetService } from "./expense-budget.service";
import { storageService } from "../../services/storage.service";

const db = dbInstances;

const VALID_EXPENSE_CATEGORIES = new Set<string>([
  "FUEL",
  "TOLL",
  "PARKING",
  "SERVICE",
  "INSURANCE",
  "CHALLAN",
  "EMI",
  "REPAIR",
  "OTHER",
]);

function normalizeExpenseCategory(cat: unknown): ExpenseCategory {
  const s = typeof cat === "string" ? cat.trim().toUpperCase() : "";
  if (VALID_EXPENSE_CATEGORIES.has(s)) return s as ExpenseCategory;
  return "OTHER";
}

export const expenseParsingService = {
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
    const targetVehicleId = await vehicleService.resolveVehicleId(customerId, input.vehicleId);

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

        if (aiResult.notes?.includes("CREDIT_TXN")) {
          return { success: false, skipped: true, reason: "This is a credit/refund, not an expense." };
        }

        const expense = await db.expense.create({
          data: {
            customerId,
            vehicleId: targetVehicleId,
            amount: aiResult.amount,
            category: aiResult.category as ExpenseCategory,
            merchantName: aiResult.merchantName || null,
            date: aiResult.date ? new Date(aiResult.date) : (input.timestamp ? new Date(input.timestamp) : new Date()),
            source: input.source as ExpenseSource,
            rawText: text,
            isAutomated: true,
            notes: `AI-parsed (Confidence: ${aiResult.confidence})${aiResult.notes ? ` | ${aiResult.notes}` : ""}`,
          } as any,
        });

        // Trigger Budget Check (BullMQ)
        if (queues?.budgetCheck) {
          void queues.budgetCheck.add("check-budget", {
            customerId,
            metadata: { category: expense.category, amount: expense.amount },
          }).catch(err => logger.error({ err }, "Failed to queue budget check"));
        } else {
          void expenseBudgetService.checkBudget(customerId, expense.category, expense.amount).catch(() => {});
        }

        let fuelIntelligence = null;
        if (aiResult.category === "FUEL") {
          fuelIntelligence = await fuelPriceService.enrichFuelExpense(aiResult.amount, "Delhi", "PETROL").catch(() => null);
        }

        let serviceRecord = null;
        if (aiResult.category === "SERVICE" || aiResult.category === "REPAIR") {
            await db.inAppNotification.create({
              data: {
                customerId,
                title: "📸 Upload your service bill",
                body: `We detected ₹${aiResult.amount} at ${aiResult.merchantName || "a service center"}.`,
                type: "ACTION",
                link: `/expenses/${expense.id}/upload-bill`,
                metadata: { expenseId: expense.id, action: "UPLOAD_SERVICE_BILL" },
              },
            });
            serviceRecord = { status: "AWAITING_BILL", uploadUrl: `/expenses/${expense.id}/upload-bill` };
        }

        return { success: true, expense, fuelIntelligence, serviceRecord, parserMeta: { method: "GEMINI_AI", confidence: aiResult.confidence } };
      }
    } catch (err) {
      logger.warn({ err }, "Gemini AI parser failed, falling back to regex");
    }

    // ===== STEP 2: UPI REGEX PARSER (Fallback) =====
    if (upiParserService.isTransactionNotification(text)) {
      const upiResult = upiParserService.parse(text);
      if (upiResult && upiResult.amount > 0) {
        if (opts?.dryRun) {
          return { success: true, dryRun: true, expense: { amount: upiResult.amount, category: upiResult.category, merchantName: upiResult.merchantName, date: upiResult.date }, parserMeta: { method: 'UPI_REGEX' } };
        }
        const expense = await db.expense.create({
          data: {
            customerId,
            vehicleId: targetVehicleId,
            amount: upiResult.amount,
            category: upiResult.category as ExpenseCategory,
            merchantName: upiResult.merchantName || "Unknown Merchant",
            date: upiResult.date,
            source: input.source as ExpenseSource,
            rawText: text,
            isAutomated: true,
            notes: `Regex-parsed via UPI`,
          } as any,
        });

        if (queues?.budgetCheck) {
          void queues.budgetCheck.add("check-budget", { customerId, metadata: { category: expense.category, amount: expense.amount } }).catch(() => {});
        }

        return { success: true, expense, parserMeta: { method: "UPI_REGEX" } };
      }
    }

    // ===== STEP 3: BASIC REGEX =====
    const normalized = text.toLowerCase();
    const amountRegex = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{2})?)/i;
    const amountMatch = text.match(amountRegex);
    let amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

    if (amount > 0) {
      let category: ExpenseCategory = "OTHER";
      if (normalized.includes("petrol") || normalized.includes("fuel")) category = "FUEL";
      else if (normalized.includes("toll") || normalized.includes("fastag")) category = "TOLL";
      else if (normalized.includes("service") || normalized.includes("repair")) category = "SERVICE";

      if (opts?.dryRun) {
        return { success: true, dryRun: true, expense: { amount, category, date: new Date() }, parserMeta: { method: 'BASIC_REGEX' } };
      }

      const expense = await db.expense.create({
        data: {
          customerId,
          vehicleId: targetVehicleId,
          amount,
          category,
          merchantName: "Parsed Merchant",
          date: new Date(),
          source: input.source as ExpenseSource,
          rawText: text,
          isAutomated: true,
          notes: `Basic regex fallback`,
        } as any,
      });
      return { success: true, expense, parserMeta: { method: "BASIC_REGEX" } };
    }

    return { success: false, reason: "Could not parse expense from text." };
  },

  /**
   * Preview only: parse voice audio
   */
  async previewExpenseFromVoiceAudio(customerId: string, file: any) {
    const aiResult = await ocrService.parseVoiceExpense(file.buffer, file.mimetype);
    if (aiResult.error) throw AppError.badRequest(aiResult.error);

    return {
      success: true,
      dryRun: true,
      expense: {
        amount: Number(aiResult.amount) || 0,
        category: normalizeExpenseCategory(aiResult.category),
        merchantName: aiResult.merchantName || null,
        date: aiResult.date || new Date().toISOString().split("T")[0],
        notes: aiResult.notes || `Voice transcription: ${aiResult.transcription || ""}`,
      },
    };
  },

  async parseReceiptImage(customerId: string, file: Express.Multer.File, dryRun: boolean) {
    const parsed = await ocrService.parseReceipt(file.buffer, file.mimetype);
    if (parsed.error) {
      throw AppError.badRequest(typeof parsed.error === "string" ? parsed.error : "Could not parse receipt");
    }
    if (parsed.isReceipt === false) {
      throw AppError.badRequest(
        typeof parsed.error === "string" ? parsed.error : "This image does not look like a receipt.",
      );
    }
    const amount = Number(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw AppError.badRequest("Could not detect a valid amount on the receipt.");
    }
    const category = normalizeExpenseCategory(parsed.category);
    const targetVehicleId = await vehicleService.resolveVehicleId(customerId, undefined);

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        expense: {
          amount,
          category,
          merchantName: parsed.merchantName ?? null,
          date: parsed.date ? new Date(parsed.date) : new Date(),
          notes: parsed.notes ?? null,
          vehicleNumber: parsed.vehicleNumber ?? null,
        },
      };
    }

    const uploaded = await storageService.uploadFile(file, `expenses/${customerId}`);
    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: targetVehicleId,
        amount,
        category,
        merchantName: parsed.merchantName ?? null,
        date: parsed.date ? new Date(parsed.date) : new Date(),
        source: "RECEIPT",
        receiptUrl: uploaded.url,
        mimeType: file.mimetype,
        notes:
          parsed.notes ??
          (typeof parsed.rawText === "string" ? parsed.rawText.slice(0, 500) : null),
        isAutomated: true,
        rawText: typeof parsed.rawText === "string" ? parsed.rawText.slice(0, 5000) : null,
      } as any,
    });

    if (queues?.budgetCheck) {
      void queues.budgetCheck
        .add("check-budget", { customerId, metadata: { category: expense.category, amount: expense.amount } })
        .catch(() => {});
    } else {
      void expenseBudgetService.checkBudget(customerId, expense.category, expense.amount).catch(() => {});
    }

    let fuelIntelligence = null;
    if (category === "FUEL") {
      fuelIntelligence = await fuelPriceService.enrichFuelExpense(expense.amount, "Delhi", "PETROL").catch(() => null);
    }

    return { success: true, expense, fuelIntelligence };
  },

  async createExpenseFromVoice(customerId: string, file: Express.Multer.File) {
    const aiResult = await ocrService.parseVoiceExpense(file.buffer, file.mimetype);
    if (aiResult.error) throw AppError.badRequest(String(aiResult.error));
    const amount = Number(aiResult.amount) || 0;
    if (amount <= 0) throw AppError.badRequest("Could not detect expense amount from voice.");

    const category = normalizeExpenseCategory(aiResult.category);
    const targetVehicleId = await vehicleService.resolveVehicleId(customerId, undefined);
    const rawText = typeof aiResult.transcription === "string" ? aiResult.transcription : "";

    const dupCheck = await expenseIntelligenceService.isDuplicate(customerId, amount, category, new Date());
    if (dupCheck.isDuplicate) {
      return {
        success: false,
        skipped: true,
        reason: dupCheck.reason,
        existingExpenseId: dupCheck.existingExpenseId,
      };
    }

    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: targetVehicleId,
        amount,
        category,
        merchantName: aiResult.merchantName ?? null,
        date: aiResult.date ? new Date(aiResult.date) : new Date(),
        source: "VOICE",
        rawText: rawText.slice(0, 5000),
        isAutomated: true,
        notes: aiResult.notes ?? `Voice: ${rawText.slice(0, 500)}`,
      } as any,
    });

    if (queues?.budgetCheck) {
      void queues.budgetCheck
        .add("check-budget", { customerId, metadata: { category: expense.category, amount: expense.amount } })
        .catch(() => {});
    } else {
      void expenseBudgetService.checkBudget(customerId, expense.category, expense.amount).catch(() => {});
    }

    let fuelIntelligence = null;
    if (category === "FUEL") {
      fuelIntelligence = await fuelPriceService.enrichFuelExpense(amount, "Delhi", "PETROL").catch(() => null);
    }

    return { success: true, expense, fuelIntelligence, parserMeta: { method: "VOICE_AUDIO" as const } };
  },

  async previewExpenseFromVoiceText(text: string) {
    const aiResult = await ocrService.parseVoiceExpenseFromText(text);
    if (aiResult.error) throw AppError.badRequest(String(aiResult.error));

    return {
      success: true,
      dryRun: true,
      expense: {
        amount: Number(aiResult.amount) || 0,
        category: normalizeExpenseCategory(aiResult.category),
        merchantName: aiResult.merchantName ?? null,
        date: aiResult.date || new Date().toISOString().split("T")[0],
        notes: aiResult.notes ?? `Voice transcription: ${aiResult.transcription || text}`,
      },
    };
  },

  async createExpenseFromVoiceText(customerId: string, text: string) {
    const aiResult = await ocrService.parseVoiceExpenseFromText(text);
    if (aiResult.error) throw AppError.badRequest(String(aiResult.error));
    const amount = Number(aiResult.amount) || 0;
    if (amount <= 0) throw AppError.badRequest("Could not detect expense amount from text.");

    const category = normalizeExpenseCategory(aiResult.category);
    const targetVehicleId = await vehicleService.resolveVehicleId(customerId, undefined);
    const rawText = typeof aiResult.transcription === "string" ? aiResult.transcription : text;

    const dupCheck = await expenseIntelligenceService.isDuplicate(customerId, amount, category, new Date());
    if (dupCheck.isDuplicate) {
      return {
        success: false,
        skipped: true,
        reason: dupCheck.reason,
        existingExpenseId: dupCheck.existingExpenseId,
      };
    }

    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: targetVehicleId,
        amount,
        category,
        merchantName: aiResult.merchantName ?? null,
        date: aiResult.date ? new Date(aiResult.date) : new Date(),
        source: "VOICE",
        rawText: rawText.slice(0, 5000),
        isAutomated: true,
        notes: aiResult.notes ?? `Voice (text): ${text.slice(0, 500)}`,
      } as any,
    });

    if (queues?.budgetCheck) {
      void queues.budgetCheck
        .add("check-budget", { customerId, metadata: { category: expense.category, amount: expense.amount } })
        .catch(() => {});
    } else {
      void expenseBudgetService.checkBudget(customerId, expense.category, expense.amount).catch(() => {});
    }

    let fuelIntelligence = null;
    if (category === "FUEL") {
      fuelIntelligence = await fuelPriceService.enrichFuelExpense(amount, "Delhi", "PETROL").catch(() => null);
    }

    return { success: true, expense, fuelIntelligence, parserMeta: { method: "VOICE_TEXT" as const } };
  },
};

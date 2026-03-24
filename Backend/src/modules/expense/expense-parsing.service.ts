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

const db = dbInstances;

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
          },
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
          },
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
        },
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
        category: (aiResult.category as any) || "OTHER",
        merchantName: aiResult.merchantName || null,
        date: aiResult.date || new Date().toISOString().split("T")[0],
        notes: aiResult.notes || `Voice transcription: ${aiResult.transcription || ""}`,
      },
    };
  },
};

import { dbInstances } from "@repo/db-customer";
import { CreateExpenseInput, ParseExpenseInput, ExpenseBudgetInput, ExpenseCategory } from "./expense.validators";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { storageService } from "../../services/storage.service";
import { vehicleService } from "../vehicle/vehicle.service";

// Sub-services
import { expenseBudgetService } from "./expense-budget.service";
import { expenseParsingService } from "./expense-parsing.service";
import { expenseWarrantyService } from "./expense-warranty.service";

const db = dbInstances;
const MAX_RECEIPT_IMAGES_PER_CUSTOMER = 15;

export const expenseService = {
  /**
   * Core: Add Manual Expense
   * This remains the primary orchestrator for expense creation.
   */
  async createExpense(customerId: string, input: CreateExpenseInput, file?: Express.Multer.File) {
    let receiptUrl = input.receiptUrl || null;
    let mimeType = input.mimeType || null;
    
    if (file) {
      const uploaded = await storageService.uploadFile(file, `expenses/${customerId}`);
      receiptUrl = uploaded.url;
      mimeType = file.mimetype;
    }

    const targetVehicleId = await vehicleService.resolveVehicleId(customerId, input.vehicleId);
    let driverId: string | null = null;

    if (targetVehicleId) {
      const { role } = await vehicleService.ensureVehicleAccess(customerId, targetVehicleId, ["OWNER", "EDITOR", "DRIVER"]);
      if (role === "DRIVER") driverId = customerId;

      if (input.odometerReading) {
        await vehicleService.addOdometerLog(customerId, targetVehicleId, {
          reading: input.odometerReading,
          date: new Date(),
        });
      }
    }

    const expenseCategory = input.category;

    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: targetVehicleId,
        driverId,
        amount: input.amount,
        category: expenseCategory,
        date: input.date ? new Date(input.date) : new Date(),
        merchantName: input.merchantName,
        location: input.location,
        notes: input.notes,
        source: input.source || "MANUAL",
        receiptUrl,
        mimeType,
      } as any,
    });

    // 1. Warranty/Service Record Integration (Decomposed)
    if ((expenseCategory === "SERVICE" || expenseCategory === "REPAIR") && targetVehicleId) {
      if (input.parts && input.parts.length > 0) {
        await expenseWarrantyService.syncExpenseToWarranty(expense, targetVehicleId, input.parts, input.odometerReading)
          .catch(err => logger.error({ err }, "Manual parts warranty sync failed"));
      } else if (expense.notes && expense.notes.length > 1) {
        expenseWarrantyService.autoCreateServiceRecord(expense.id, targetVehicleId, expense.notes, expense.amount, expense.merchantName, customerId)
          .catch(err => logger.error({ err }, "Background part detection failed"));
      }
    }

    // 2. Budget Check
    void expenseBudgetService.checkBudget(customerId, expense.category, expense.amount).catch(() => {});
    
    if (expense.receiptUrl) {
      this.pruneOldReceiptImages(customerId).catch(err => logger.error({ err }, "Pruning failed"));
    }

    return { expense };
  },

  /**
   * Facades for decomposed services
   * ===============================
   */

  async parseExpenseText(customerId: string, input: ParseExpenseInput, opts?: any) {
    return expenseParsingService.parseExpenseText(customerId, input, opts);
  },

  async parseReceiptImage(customerId: string, file: Express.Multer.File, dryRun: boolean) {
    return expenseParsingService.parseReceiptImage(customerId, file, dryRun);
  },

  async createExpenseFromVoice(customerId: string, file: Express.Multer.File) {
    return expenseParsingService.createExpenseFromVoice(customerId, file);
  },

  async previewExpenseFromVoiceAudio(customerId: string, file: Express.Multer.File) {
    return expenseParsingService.previewExpenseFromVoiceAudio(customerId, file);
  },

  async previewExpenseFromVoiceText(text: string) {
    return expenseParsingService.previewExpenseFromVoiceText(text);
  },

  async createExpenseFromVoiceText(customerId: string, text: string) {
    return expenseParsingService.createExpenseFromVoiceText(customerId, text);
  },

  async setBudget(customerId: string, input: ExpenseBudgetInput) {
    return expenseBudgetService.setBudget(customerId, input);
  },

  async getSummary(customerId: string, month?: number, year?: number) {
    return expenseBudgetService.getMonthlySummary(customerId, month, year);
  },

  async listExpenses(customerId: string, query: Record<string, unknown>) {
    const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
    const limitRaw = parseInt(String(query.limit ?? "20"), 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
    const skip = (page - 1) * limit;

    const where: any = { customerId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.category) where.category = String(query.category).toUpperCase();

    const [items, total] = await Promise.all([
      db.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      db.expense.count({ where }),
    ]);

    return { expenses: items, items, total, page, limit };
  },

  /**
   * Shared utilities
   */
  async pruneOldReceiptImages(customerId: string, keep = MAX_RECEIPT_IMAGES_PER_CUSTOMER) {
    const oldReceipts = await db.expense.findMany({
      where: { customerId, receiptUrl: { not: null } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: keep,
      select: { id: true, receiptUrl: true },
    });
    if (!oldReceipts.length) return;
    await Promise.all(oldReceipts.map(r => r.receiptUrl && storageService.deleteFile(r.receiptUrl).catch(() => {})));
    await db.expense.updateMany({
      where: { id: { in: oldReceipts.map(r => r.id) } },
      data: { receiptUrl: null, mimeType: null },
    });
  }
};

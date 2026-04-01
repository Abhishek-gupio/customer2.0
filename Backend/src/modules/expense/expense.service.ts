import { dbInstances } from "@repo/db-customer";
import { CreateExpenseInput, ParseExpenseInput, ExpenseBudgetInput, ExpenseCategory } from "./expense.validators";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { storageService } from "../../services/storage.service";
import { vehicleService } from "../vehicle/vehicle.service";
import { fuelPriceService } from "../../services/fuel-price.service";
import { ingestionService } from "../../services/ingestion.service";
import { queues } from "../../config/queue";

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
    }

    if (targetVehicleId && input.odometerReading) {
      await vehicleService.addOdometerLog(customerId, targetVehicleId, {
        reading: input.odometerReading,
        date: new Date(),
      });
    }

    const expense = await db.expense.create({
      data: {
        customerId,
        vehicleId: targetVehicleId,
        driverId,
        amount: input.amount,
        category: input.category,
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
      } as any,
    });

    // 1. Fuel Enrichment (Handled directly as it's a small call)
    let fuelIntelligence = null;
    if (expense.category === "FUEL") {
      fuelIntelligence = await fuelPriceService.enrichFuelExpense(expense.amount, input.location || "Delhi", "PETROL").catch(() => null);
    }

    // 2. Warranty/Service Record Integration (Decomposed)
    let serviceRecord = null;
    if ((expense.category === "SERVICE" || expense.category === "OTHER") && targetVehicleId) {
      if (input.parts && input.parts.length > 0) {
        serviceRecord = await expenseWarrantyService.syncExpenseToWarranty(expense, targetVehicleId, input.parts, input.odometerReading);
      } else if (expense.notes && expense.notes.length > 3) {
        expenseWarrantyService.autoCreateServiceRecord(expense.id, targetVehicleId, expense.notes, expense.amount, expense.merchantName, customerId)
          .catch(err => logger.error({ err }, "Background part detection failed"));
      }
    }

    if (expense.receiptUrl) {
      this.pruneOldReceiptImages(customerId).catch(err => logger.error({ err }, "Pruning failed"));
    }

    // 3. Budget Check (BullMQ)
    if (queues?.budgetCheck) {
      void queues.budgetCheck.add("check-budget", { customerId, metadata: { category: expense.category, amount: expense.amount } }).catch(() => {});
    } else {
      void expenseBudgetService.checkBudget(customerId, expense.category, expense.amount).catch(() => {});
    }

    // 4. AI Ingestion (BullMQ)
    if (queues?.expenseIngestion) {
      void queues.expenseIngestion.add("ingest-expense", { metadata: { expenseId: expense.id } }).catch(() => {});
    } else {
      void ingestionService.ingestExpense(expense.id).catch(() => {});
    }

    return { expense, fuelIntelligence, serviceRecord };
  },

  // Facades for decomposed services
  async parseExpenseText(customerId: string, input: ParseExpenseInput, opts?: any) {
    return expenseParsingService.parseExpenseText(customerId, input, opts);
  },

  async previewExpenseFromVoiceAudio(customerId: string, file: Express.Multer.File) {
    return expenseParsingService.previewExpenseFromVoiceAudio(customerId, file);
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

    const allowedCategories = new Set<string>(Object.values(ExpenseCategory));
    const where: {
      customerId: string;
      vehicleId?: string;
      category?: (typeof ExpenseCategory)[keyof typeof ExpenseCategory];
      date?: { gte?: Date; lte?: Date };
    } = { customerId };

    const vehicleId = query.vehicleId;
    if (typeof vehicleId === "string" && vehicleId.trim()) {
      where.vehicleId = vehicleId.trim();
    }
    const cat = typeof query.category === "string" ? query.category.toUpperCase() : "";
    if (cat && allowedCategories.has(cat)) {
      where.category = cat as (typeof ExpenseCategory)[keyof typeof ExpenseCategory];
    }
    const from = query.from;
    const to = query.to;
    if ((typeof from === "string" && from) || (typeof to === "string" && to)) {
      where.date = {};
      if (typeof from === "string" && from) where.date.gte = new Date(from);
      if (typeof to === "string" && to) where.date.lte = new Date(to);
    }

    const [items, total] = await Promise.all([
      db.expense.findMany({
        where: where as any,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      db.expense.count({ where: where as any }),
    ]);

    const expenseIds = items.map((item) => item.id);
    const latestServiceRecordByExpenseId = new Map<string, any>();

    if (expenseIds.length > 0) {
      const serviceRecords = await db.serviceRecord.findMany({
        where: {
          expenseId: { in: expenseIds },
        },
        include: {
          parts: true,
        },
        orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
      });

      for (const record of serviceRecords) {
        if (record.expenseId && !latestServiceRecordByExpenseId.has(record.expenseId)) {
          latestServiceRecordByExpenseId.set(record.expenseId, record);
        }
      }
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      serviceRecord: latestServiceRecordByExpenseId.get(item.id) ?? null,
    }));

    // Backward-compatible shape for mobile clients:
    // - Older app expects `expenses` array in various nesting locations.
    // - Newer API can still use `items`/pagination if needed.
    return { expenses: enrichedItems, items: enrichedItems, total, page, limit };
  },

  async parseReceiptImage(customerId: string, file: Express.Multer.File, dryRun: boolean) {
    return expenseParsingService.parseReceiptImage(customerId, file, dryRun);
  },

  async createExpenseFromVoice(customerId: string, file: Express.Multer.File) {
    return expenseParsingService.createExpenseFromVoice(customerId, file);
  },

  async previewExpenseFromVoiceText(text: string) {
    return expenseParsingService.previewExpenseFromVoiceText(text);
  },

  async createExpenseFromVoiceText(customerId: string, text: string) {
    return expenseParsingService.createExpenseFromVoiceText(customerId, text);
  },

  // Shared utilities
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

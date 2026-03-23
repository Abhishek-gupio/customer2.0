import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { expenseService } from "./expense.service";
import {
  createExpenseSchema,
  expenseBudgetSchema,
  parseExpenseSchema,
  updateExpenseSchema,
  CreateExpenseInput,
  ParseExpenseInput,
  ExpenseBudgetInput,
} from "./expense.validators";
import { AppError } from "../../utils/AppError";

function parseBody<T>(req: Request, schema: any): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw AppError.badRequest(result.error.issues[0]?.message);
  }
  return result.data;
}

export const expenseController = {
  // 1. Manual Creation (Form)
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    // Multer puts file in req.file, other fields in req.body.
    // We might need to handle multipart body parsing carefully if Zod expects numbers but Multer gives strings.
    // For simplicity, let's assume we handle type conversion manually or via a helper if it's multipart.

    const rawBody = req.body;
    // Fix numbers if they came as strings (common in multipart/form-data)
    if (rawBody.amount) rawBody.amount = parseFloat(rawBody.amount);
    if (rawBody.odometerReading)
      rawBody.odometerReading = parseInt(rawBody.odometerReading);

    const body = parseBody<CreateExpenseInput>(req, createExpenseSchema);

    const expense = await expenseService.createExpense(
      req.customer.id,
      body,
      req.file,
    );
    success(res, expense, 201);
  }),

  // 2. Parse Text (SMS/Voice/Notif). dryRun=true returns preview only.
  parse: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseBody<ParseExpenseInput>(req, parseExpenseSchema);

    const dryRun = req.query.dryRun === 'true';
    const result = await expenseService.parseExpenseText(req.customer.id, body, { dryRun });
    success(res, result);
  }),

  // 3. Parse Receipt Image
  parseReceipt: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest("No receipt image uploaded");

    const dryRun = req.query.dryRun === 'true';
    const result = await expenseService.parseReceiptImage(
      req.customer.id,
      req.file,
      dryRun
    );
    success(res, result);
  }),

  // 4. List Expenses (Filters)
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const result = await expenseService.listExpenses(
      req.customer.id,
      req.query,
    );
    success(res, result);
  }),

  // 5. Monthly Summary
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const month = req.query.month
      ? parseInt(req.query.month as string)
      : undefined;
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : undefined;

    const result = await expenseService.getSummary(
      req.customer.id,
      month,
      year,
    );
    success(res, result);
  }),

  // 6. Set Budget
  setBudget: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseBody<ExpenseBudgetInput>(req, expenseBudgetSchema);

    const budget = await expenseService.setBudget(req.customer.id, body);
    success(res, budget);
  }),

  // 7. Voice Command (Audio → Gemini → transcribe + extract). dryRun=true returns preview only (auto language).
  parseVoice: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest("No audio file uploaded");

    const dryRun = req.query.dryRun === "true" || req.body?.dryRun === true;
    if (dryRun) {
      const result = await expenseService.previewExpenseFromVoiceAudio(
        req.customer.id,
        req.file,
      );
      return success(res, result, 200);
    }

    const result = await expenseService.createExpenseFromVoice(
      req.customer.id,
      req.file,
    );
    success(res, result, 201);
  }),

  // 8. Voice Command from transcribed text (device speech-to-text → Gemini extract → Expense)
  parseVoiceText: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const text =
      typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) throw AppError.badRequest("No text provided");

    const dryRun = req.query.dryRun === "true" || req.body.dryRun === true;

    if (dryRun) {
      const result = await expenseService.previewExpenseFromVoiceText(text);
      return success(res, result, 200);
    }

    const result = await expenseService.createExpenseFromVoiceText(
      req.customer.id,
      text,
    );
    success(res, result, 201);
  }),
};

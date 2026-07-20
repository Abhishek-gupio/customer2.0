import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { paymentsService } from "./payments.service";
import { createOrderSchema, verifyOrderSchema } from "./payments.validators";

function parseBody<T>(
  req: Request,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(req.body);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const paymentsController = {
  createOrder: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseBody(req, createOrderSchema);
    const order = await paymentsService.createOrder(req.customer.id, body);
    success(res, order, 201);
  }),

  getOrder: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const order = await paymentsService.getOrder(req.customer.id, req.params.id as string);
    success(res, order);
  }),

  verifyOrder: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseBody(req, verifyOrderSchema);
    const result = await paymentsService.verifyOrder(req.customer.id, req.params.id as string, body);
    success(res, result);
  }),

  listHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const history = await paymentsService.listHistory(req.customer.id);
    success(res, history);
  }),
};

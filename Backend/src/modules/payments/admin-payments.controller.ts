import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { paymentsService } from "./payments.service";

export const adminPaymentsController = {
  listOrders: asyncHandler(async (req: Request, res: Response) => {
    const { status, stuckOnly, page, limit } = req.query as Record<string, string | undefined>;
    const result = await paymentsService.adminListOrders({
      status,
      stuckOnly: stuckOnly === "true",
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    success(res, result);
  }),
};

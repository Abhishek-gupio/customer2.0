import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { adminService } from "./admin.service";
import { adminDashboardService } from "./admin-dashboard.service";
import { adminLoginSchema } from "./admin.validators";
import { AppError } from "../../utils/AppError";

function parseBody<T>(
  req: Request,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } },
): T {
  const result = schema.safeParse(req.body);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const adminController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, adminLoginSchema);
    const data = await adminService.login(body);
    success(res, data, 200);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    success(res, { admin: req.admin });
  }),

  listCustomers: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await adminDashboardService.listCustomers({
      page,
      limit,
      search,
      role: req.admin.role,
    });
    success(res, data);
  }),

  getCustomerDetail: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const customerId = typeof req.params.id === "string" ? req.params.id : "";
    if (!customerId) throw AppError.badRequest("Customer ID required");
    const data = await adminDashboardService.getCustomerDetail(customerId, req.admin.role);
    success(res, data);
  }),

  getOverviewStats: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const data = await adminDashboardService.getOverviewStats(req.admin.role);
    success(res, data);
  }),

  listTickets: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await adminDashboardService.listTickets({
      page,
      limit,
      search,
      role: req.admin.role,
    });
    success(res, data);
  }),

  listVehicles: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await adminDashboardService.listVehicles({
      page,
      limit,
      search,
      role: req.admin.role,
    });
    success(res, data);
  }),
};

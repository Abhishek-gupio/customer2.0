import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { asyncHandler } from "../../utils/asyncHandler";

import { success } from "../../utils/apiResponse";
import { dbInstances } from "@repo/db-customer";
import { adminService } from "./admin.service";
import { adminDashboardService } from "./admin-dashboard.service";
import { adminLoginSchema } from "./admin.validators";
import { AppError } from "../../utils/AppError";
import { adminPermissionsService } from "../../services/admin-permissions.service";
import { messagingService } from "../messaging/messaging.service";


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
    
    // Inject custom permissions
    if (data.admin.role === 'SUPPORT') {
      (data.admin as any).canAccessCustomers = adminPermissionsService.hasCustomerAccess(data.admin.id);
    } else {
      (data.admin as any).canAccessCustomers = true;
    }
    
    success(res, data, 200);
  }),


  signup: asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role } = req.body;
    if (!email || !password) throw AppError.badRequest("Email and password required");
    const data = await adminService.createAdmin({ email, password, name, role });
    success(res, data, 201);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    
    const admin = { ...req.admin } as any;
    if (admin.role === 'SUPPORT') {
      admin.canAccessCustomers = adminPermissionsService.hasCustomerAccess(admin.id);
    } else {
      admin.canAccessCustomers = true;
    }
    
    success(res, { admin });
  }),


  listCustomers: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    
    // Support role check
    if (req.admin.role === 'SUPPORT' && !adminPermissionsService.hasCustomerAccess(req.admin.id)) {
      throw AppError.forbidden("You do not have permission to access customers");
    }

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
    
    // Support role check
    if (req.admin.role === 'SUPPORT' && !adminPermissionsService.hasCustomerAccess(req.admin.id)) {
      throw AppError.forbidden("You do not have permission to access customers");
    }

    const customerId = typeof req.params.id === "string" ? req.params.id : "";
    if (!customerId) throw AppError.badRequest("Customer ID required");
    const data = await adminDashboardService.getCustomerDetail(customerId, req.admin.role);
    success(res, data);
  }),


  getOverviewStats: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const days = req.query.days ? Number(req.query.days) : 7;
    const data = await adminDashboardService.getOverviewStats(req.admin.role, days);
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
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const healthStatus = typeof req.query.healthStatus === "string" ? req.query.healthStatus : undefined;
    const verificationStatus = typeof req.query.verificationStatus === "string" ? req.query.verificationStatus : undefined;
    const data = await adminDashboardService.listVehicles({
      page,
      limit,
      search,
      type,
      healthStatus,
      verificationStatus,
      role: req.admin.role,
    });
    success(res, data);
  }),

  getExpenseDetail: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const expenseId = typeof req.params.id === "string" ? req.params.id : "";
    if (!expenseId) throw AppError.badRequest("Expense ID required");
    const data = await adminDashboardService.getExpenseDetail(expenseId);
    success(res, data);
  }),

  listExpenses: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const data = await adminDashboardService.listExpenses({ page, limit, search, customerId });
    success(res, data);
  }),

  catalogVehicles: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const data = await adminDashboardService.listCatalogVehicles({ type });
    success(res, data);
  }),

  createCatalogVehicle: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const { make, model, type } = req.body;
    if (!make || !model || !type) throw AppError.badRequest("Make, model, and type are required");
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw AppError.badRequest("At least one image is required");

    // optional array of imageType from body (e.g. HERO, ANGLE)
    const imageTypes = Array.isArray(req.body.imageTypes) ? req.body.imageTypes : [req.body.imageTypes || "HERO"];

    const data = await adminDashboardService.createCatalogVehicle({
      make, model, type, files, imageTypes
    });
    success(res, data, 201);
  }),

  createCatalogVehicleAsset: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const catalogId = req.params.id as string;
    if (!catalogId) throw AppError.badRequest("Catalog ID required");
    if (!req.file) throw AppError.badRequest("No image file provided");

    // accept optional imageType field from form-data (defaults to HERO)
    const imageType = typeof req.body.imageType === 'string' ? req.body.imageType.toUpperCase() : 'HERO';
    const data = await adminDashboardService.createCatalogVehicleAsset(catalogId, req.file, imageType);
    success(res, data, 201);
  }),

  updateCatalogVehicleAsset: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const catalogId = req.params.id as string;
    const assetId = req.params.assetId as string;
    if (!catalogId || !assetId) throw AppError.badRequest("Catalog ID and Asset ID required");
    if (!req.file) throw AppError.badRequest("No image file provided");

    const data = await adminDashboardService.updateCatalogVehicleAsset(catalogId, assetId, req.file);
    success(res, data, 200);
  }),

  addTicketMessage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const ticketId = req.params.id;
    const { content } = req.body;
    if (!content) throw AppError.badRequest("Content is required");

    // We can use supportService directly for now if we import it
    const { supportService } = require("../support/support.service");
    const data = await supportService.addAdminMessage(req.admin.id, ticketId, content);
    success(res, data, 201);
  }),

  updateTicketStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const ticketId = req.params.id;
    const { status } = req.body;
    if (!status) throw AppError.badRequest("Status is required");

    const { supportService } = require("../support/support.service");
    const adminName = req.admin.name || req.admin.email;
    const data = await supportService.updateTicketStatus(ticketId, status, req.admin.id, adminName);
    success(res, data);
  }),

  getTicketMessages: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const ticketId = req.params.id;

    const messages = await (dbInstances as any).ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' }
    });
    success(res, messages);
  }),

  downloadDocument: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const documentId = req.params.id as string;
    const { buffer, mimeType, filename } = await adminDashboardService.downloadDocument(documentId);

    const finalMime = (Array.isArray(mimeType) ? mimeType[0] : mimeType) || "application/octet-stream";
    res.setHeader("Content-Type", String(finalMime));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") throw AppError.badRequest("Email is required");
    const data = await adminService.forgotPassword(email);
    success(res, data);
  }),

  verifyResetOtp: asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw AppError.badRequest("Email and OTP are required");
    const data = await adminService.verifyForgotPasswordOtp(email, otp);
    success(res, data);
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw AppError.badRequest("Email, OTP, and new password are required");
    if (newPassword.length < 8) throw AppError.badRequest("Password must be at least 8 characters");
    const data = await adminService.resetPassword(email, otp, newPassword);
    success(res, data, 202);
  }),

  deleteCustomers: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden("Only Super Admins can delete customers");
    }
    const { customerIds } = req.body;
    if (!Array.isArray(customerIds) || !customerIds.length) {
      throw AppError.badRequest("Customer IDs must be a non-empty array");
    }
    const data = await adminDashboardService.deleteCustomers(customerIds);
    success(res, data, 200);
  }),

  updateCustomer: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden("Only Super Admins can update customer records");
    }
    const customerId = typeof req.params.id === "string" ? req.params.id : "";
    if (!customerId) throw AppError.badRequest("Customer ID required");

    const { fullName, email, phoneNumber } = req.body;

    const data = await adminDashboardService.updateCustomer(customerId, {
      fullName,
      email,
      phoneNumber
    });
    success(res, data, 200);
  }),

  listAdmins: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden("Only Super Admins can manage other admins");
    }
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    
    const data = await adminDashboardService.listAdmins({ page, limit, search, role });
    success(res, data);
  }),

  deleteAdmins: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden("Only Super Admins can delete other admins");
    }
    const { adminIds } = req.body;
    if (!Array.isArray(adminIds) || !adminIds.length) {
      throw AppError.badRequest("Admin IDs must be a non-empty array");
    }
    const data = await adminDashboardService.deleteAdmins(adminIds, req.admin.id);
    success(res, data, 200);
  }),

  toggleSupportCustomerAccess: asyncHandler(async (req: Request, res: Response) => {
    try {
      const debugLog = `[${new Date().toISOString()}] Toggle request for ID: ${req.params.id} by admin: ${req.admin?.id}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'debug_toggle.log'), debugLog);
    } catch (e) {
      console.error("Debug log failed", e);
    }

    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden("Only Super Admins can manage permissions");
    }
    const adminId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!adminId) throw AppError.badRequest("Admin ID required");
    
    // Verify admin exists and is a support role
    const admin = await dbInstances.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw AppError.notFound("Admin user not found");
    if (admin.role !== 'SUPPORT') throw AppError.badRequest("Can only toggle customer access for Support role");

    const enabled = adminPermissionsService.toggleCustomerAccess(adminId);
    success(res, { enabled }, 200);
  }),

  toggleAdminStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden("Only Super Admins can manage account status");
    }
    const adminId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!adminId) throw AppError.badRequest("Admin ID required");

    const data = await adminDashboardService.toggleAdminStatus(adminId);
    success(res, data, 200);
  }),

  // ── Vehicle QR messaging moderation ──────────────────────────────

  listMessagingReports: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const { status } = req.query as { status?: string };
    const reports = await messagingService.adminListReports(status);
    success(res, reports);
  }),

  resolveMessagingReport: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const { status } = req.body as { status?: "REVIEWED" | "DISMISSED" | "ACTIONED" };
    if (!status) throw AppError.badRequest("status is required");
    const report = await messagingService.adminResolveReport(req.params.id as string, status);
    success(res, report);
  }),

  listConversations: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const { page, limit } = req.query as { page?: string; limit?: string };
    const data = await messagingService.adminListConversations({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    success(res, data);
  }),

  deleteConversation: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    await messagingService.adminDeleteConversation(req.params.id as string);
    success(res, { ok: true });
  }),

  suspendCustomer: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const { reason } = req.body as { reason?: string };
    if (!reason) throw AppError.badRequest("reason is required");
    const customer = await messagingService.adminSuspendCustomer(req.params.id as string, reason);
    success(res, customer);
  }),

  unsuspendCustomer: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const customer = await messagingService.adminUnsuspendCustomer(req.params.id as string);
    success(res, customer);
  }),

  messagingAnalytics: asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin) throw AppError.unauthorized();
    const analytics = await messagingService.adminAnalytics();
    success(res, analytics);
  }),
};






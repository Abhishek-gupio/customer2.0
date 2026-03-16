import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { supportService } from "./support.service";
import { AppError } from "../../utils/AppError";
import {
  createTicketSchema,
  addMessageSchema,
  getTicketSchema,
} from "./support.validators";
import type { 
  CreateTicketDTO, 
  AddMessageDTO 
} from "./support.types";

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

export const supportController = {
  getTickets: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const tickets = await supportService.listTickets(req.customer.id);
    success(res, tickets);
  }),

  getTicket: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const ticketId = req.params.ticketId as string;
    const ticket = await supportService.getTicket(req.customer.id, ticketId);
    success(res, ticket);
  }),

  createTicket: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseBody<CreateTicketDTO>(req, createTicketSchema);
    const ticket = await supportService.createTicket(req.customer.id, body);
    success(res, ticket, 201);
  }),

  addMessage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const ticketId = req.params.ticketId as string;
    const body = parseBody<AddMessageDTO>(req, addMessageSchema);
    const message = await supportService.addMessage(
      req.customer.id,
      ticketId,
      body,
    );
    success(res, message, 201);
  }),

  getFaqs: asyncHandler(async (_req: Request, res: Response) => {
    const faqs = await supportService.listFaqs();
    success(res, faqs);
  }),

  getChatFlow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const flowId = (req.query.flowId as string) || "root";
    const flow = await supportService.getChatFlow(req.customer.id, flowId);
    success(res, flow);
  }),

  getSupportInfo: asyncHandler(async (_req: Request, res: Response) => {
    const info = await supportService.getSupportInfo();
    success(res, info);
  }),
};

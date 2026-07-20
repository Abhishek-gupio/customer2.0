import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { storageService } from "../../services/storage.service";
import { messagingService } from "./messaging.service";
import {
  createConversationSchema,
  updateStatusSchema,
  sendMessageSchema,
  reactionSchema,
  reportConversationSchema,
  blockContactSchema,
} from "./messaging.validators";

function parseInput<T>(
  raw: unknown,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(raw);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const messagingController = {
  createConversation: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, createConversationSchema);
    const conversation = await messagingService.getOrCreateConversation(req.customer.id, body);
    success(res, conversation, 201);
  }),

  listConversations: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const conversations = await messagingService.listMyConversations(req.customer.id);
    success(res, conversations);
  }),

  getConversation: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const conversation = await messagingService.getConversation(
      req.customer.id,
      req.params.id as string,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
    success(res, conversation);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, updateStatusSchema);
    const conversation = await messagingService.updateStatus(req.customer.id, req.params.id as string, body);
    success(res, conversation);
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, sendMessageSchema);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length > 5) throw AppError.badRequest("Maximum 5 images per message");
    const imageUrls = await Promise.all(
      files.map(async (file) => (await storageService.uploadFile(file, "messaging", true)).url),
    );

    const message = await messagingService.sendMessage(req.customer.id, req.params.id as string, body, imageUrls);
    success(res, message, 201);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await messagingService.markRead(req.customer.id, req.params.id as string);
    success(res, { ok: true });
  }),

  markDelivered: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await messagingService.markDelivered(req.customer.id, req.params.id as string);
    success(res, { ok: true });
  }),

  addReaction: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, reactionSchema);
    const message = await messagingService.addReaction(req.customer.id, req.params.messageId as string, body.emoji);
    success(res, message);
  }),

  reportConversation: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, reportConversationSchema);
    const report = await messagingService.reportConversation(req.customer.id, req.params.id as string, body.reason);
    success(res, report, 201);
  }),

  blockContact: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, blockContactSchema);
    const blocked = await messagingService.blockContact(req.customer.id, body.customerId, body.reason);
    success(res, blocked, 201);
  }),

  unblockContact: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await messagingService.unblockContact(req.customer.id, req.params.customerId as string);
    success(res, { ok: true });
  }),

  listBlocked: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const blocked = await messagingService.listBlocked(req.customer.id);
    success(res, blocked);
  }),

  listQuickReplies: asyncHandler(async (_req: Request, res: Response) => {
    success(res, messagingService.listQuickReplies());
  }),
};

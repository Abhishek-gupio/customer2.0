import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { storageService } from "../../services/storage.service";
import { guestService } from "./guest.service";
import { submitGuestMessageSchema, ownerReplySchema, ownerGuestStatusSchema } from "./guest.validators";

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

export const guestController = {
  // ── Public — no auth, no account ─────────────────────────────────

  resolveVehicle: asyncHandler(async (req: Request, res: Response) => {
    const vehicle = await guestService.resolveForGuest(req.params.token as string);
    success(res, vehicle);
  }),

  submitMessage: asyncHandler(async (req: Request, res: Response) => {
    const body = parseInput(req.body, submitGuestMessageSchema);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length > 5) throw AppError.badRequest("Maximum 5 images per message");
    const imageUrls = await Promise.all(
      files.map(async (file) => (await storageService.uploadFile(file, "guest-messaging", true)).url),
    );
    const result = await guestService.submitMessage(
      req.params.token as string,
      { guestName: body.guestName, guestContact: body.guestContact, text: body.text, imageUrls },
      body.guestToken,
    );
    success(res, result, 201);
  }),

  getByGuestToken: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await guestService.getByGuestToken(req.params.guestToken as string);
    success(res, conversation);
  }),

  // ── Owner-facing — authenticated, mounted under messaging.routes.ts ──

  ownerListConversations: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const conversations = await guestService.ownerListConversations(req.customer.id);
    success(res, conversations);
  }),

  ownerGetConversation: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const conversation = await guestService.ownerGetConversation(req.customer.id, req.params.id as string);
    success(res, conversation);
  }),

  ownerReply: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, ownerReplySchema);
    const entry = await guestService.ownerReply(req.customer.id, req.params.id as string, body.text);
    success(res, entry, 201);
  }),

  ownerUpdateStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, ownerGuestStatusSchema);
    const conversation = await guestService.ownerUpdateStatus(req.customer.id, req.params.id as string, body.status);
    success(res, conversation);
  }),

  ownerDelete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    await guestService.ownerDeleteConversation(req.customer.id, req.params.id as string);
    success(res, { ok: true });
  }),
};

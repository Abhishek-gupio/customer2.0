import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { aiService } from "../../services/ai.service";
import { AppError } from "../../utils/AppError";

export const chatController = {
  /**
   * Start/Continue Chat (RAG)
   */
  chat: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const { message, sessionId } = req.body;
    if (!message) throw AppError.badRequest("Message is required");

    const response = await aiService.chat(req.customer.id, message, sessionId);
    success(res, response);
  }),

  /**
   * Get history of a specific session
   */
  getHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const sessionId = req.params.sessionId as string;
    const session = await aiService.getHistory(req.customer.id, sessionId);

    if (!session) throw AppError.notFound("Chat session not found");
    success(res, session);
  }),

  /**
   * List all chat sessions
   */
  listSessions: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const sessions = await aiService.listSessions(req.customer.id);
    success(res, sessions);
  }),
};

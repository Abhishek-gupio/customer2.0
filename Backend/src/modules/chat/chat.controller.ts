import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { aiService } from "../../services/ai.service";
import { analyticsService } from "../../services/analytics.service";
import { AppError } from "../../utils/AppError";

export const chatController = {
  /**
   * Standard Chat — Start/Continue (RAG + Multi-turn Tools + Agent Mode + Multimodal)
   */
  chat: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const { message, sessionId, agentMode } = req.body;
    if (!message) throw AppError.badRequest("Message is required");

    // Feature 5: Extract uploaded image
    const imageBuffer = req.file?.buffer;
    const mimeType = req.file?.mimetype;

    const response = await aiService.chat(
      req.customer.id,
      message,
      sessionId,
      imageBuffer,
      mimeType,
      agentMode === true || agentMode === "true",
    );
    success(res, response);
  }),

  /**
   * Feature 1: Streaming Chat (SSE)
   * Returns Server-Sent Events for real-time token streaming
   */
  streamChat: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const { message, sessionId } = req.body;
    if (!message) throw AppError.badRequest("Message is required");

    const imageBuffer = req.file?.buffer;
    const mimeType = req.file?.mimetype;

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    try {
      const stream = aiService.chatStream(
        req.customer.id,
        message,
        sessionId,
        imageBuffer,
        mimeType,
      );

      for await (const chunk of stream) {
        res.write(`data: ${chunk}\n\n`);
      }
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: "error", message: "Stream failed" })}\n\n`,
      );
    }

    res.end();
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

  /**
   * Feature 10: Get chat analytics
   */
  getAnalytics: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const days = parseInt(req.query.days as string) || 30;
    const analytics = await analyticsService.getAnalytics(
      req.customer.id,
      days,
    );
    success(res, analytics);
  }),

  /**
   * Feature 10: Submit feedback (thumbs up/down)
   */
  submitFeedback: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const { sessionId, score } = req.body;
    if (!sessionId) throw AppError.badRequest("sessionId is required");
    if (score !== 1 && score !== -1)
      throw AppError.badRequest("score must be 1 or -1");

    await analyticsService.submitFeedback(req.customer.id, sessionId, score);
    success(res, { message: "Feedback recorded" });
  }),
};

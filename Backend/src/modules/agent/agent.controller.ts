import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { handleAgentMessage, handleAgentMessageStream } from "../../agent/runtime";
import { AgentRequest, ClientContext } from "../../agent/types";

function readClientContext(body: any): ClientContext | undefined {
  const raw = body?.clientContext;
  if (!raw || typeof raw !== "object") return undefined;
  // Accepted and made available to the runtime/flows; deep screen-aware reasoning (e.g.
  // injecting `raw.screen`/`raw.draftState` into the LLM prompt inside ai.service.ts) is not
  // yet wired for the general chat fallback path — flows use it opportunistically today.
  return raw as ClientContext;
}

export const agentController = {
  /** The single entrypoint for both flow-driven actions and general chat — one request in, one event-bearing response out. */
  message: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) throw AppError.badRequest("message is required");

    const request: AgentRequest = {
      message,
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
      clientContext: readClientContext(req.body),
      imageBase64: typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : undefined,
      imageMimeType: typeof req.body?.imageMimeType === "string" ? req.body.imageMimeType : undefined,
    };

    const response = await handleAgentMessage(req.customer.id, request);
    success(res, response);
  }),

  /** Same routing/flow logic as `message`, but yields events as they're decided instead of all at once. */
  messageStream: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) throw AppError.badRequest("message is required");

    const request: AgentRequest = {
      message,
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
      clientContext: readClientContext(req.body),
      imageBase64: typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : undefined,
      imageMimeType: typeof req.body?.imageMimeType === "string" ? req.body.imageMimeType : undefined,
    };

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      for await (const chunk of handleAgentMessageStream(req.customer.id, request)) {
        res.write(`data: ${chunk}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Stream failed" })}\n\n`);
    }
    res.end();
  }),
};

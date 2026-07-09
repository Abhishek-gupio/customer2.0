import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { getVoiceAction } from "./voice-action.registry";
import "./actions"; // ensure all actions are registered before any request is handled

// A commit must be re-run against fresh values within this window of its preview — mirrors the
// staleness guard already used for voice-expense drafts, kept here as an orchestration-layer
// concern rather than duplicated per action.
const MAX_DRAFT_AGE_MS = 10 * 60 * 1000;

export const voiceActionController = {
  preview: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const actionKey = Array.isArray(req.params.actionKey) ? req.params.actionKey[0] : req.params.actionKey;
    const action = getVoiceAction(actionKey);
    if (!action) throw AppError.notFound(`Unknown voice action: ${actionKey}`);

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) throw AppError.badRequest("No text provided");

    const knownValues =
      req.body?.knownValues && typeof req.body.knownValues === "object" ? req.body.knownValues : {};
    const missingSlotsHint = action.slots.map((s) => s.name).filter((name) => knownValues[name] == null);

    const result = await action.extract(req.customer.id, text, knownValues, missingSlotsHint);
    const requiresConfirmation = result.missingSlots.length > 0 || result.confidence !== "HIGH";
    const nextSlot =
      result.missingSlots.length > 0 ? action.slots.find((s) => s.name === result.missingSlots[0]) : null;

    success(res, {
      success: true,
      dryRun: true,
      actionKey: action.key,
      values: result.values,
      missingSlots: result.missingSlots,
      confidence: result.confidence,
      requiresConfirmation,
      askPrompt: nextSlot?.askPrompt ?? null,
      previewedAt: new Date().toISOString(),
    });
  }),

  commit: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const actionKey = Array.isArray(req.params.actionKey) ? req.params.actionKey[0] : req.params.actionKey;
    const action = getVoiceAction(actionKey);
    if (!action) throw AppError.notFound(`Unknown voice action: ${actionKey}`);

    const values = req.body?.values && typeof req.body.values === "object" ? req.body.values : {};
    const previewedAt = typeof req.body?.previewedAt === "string" ? req.body.previewedAt : null;

    if (previewedAt) {
      const previewedAtMs = new Date(previewedAt).getTime();
      if (!Number.isFinite(previewedAtMs) || Date.now() - previewedAtMs > MAX_DRAFT_AGE_MS) {
        return success(res, {
          success: false,
          stale: true,
          reason: "This has expired. Please say the command again.",
        });
      }
    }

    const missingSlots = action.slots.map((s) => s.name).filter((name) => values[name] == null);
    if (missingSlots.length > 0) {
      throw AppError.badRequest(`Missing required fields: ${missingSlots.join(", ")}`);
    }

    const result = await action.commit(req.customer.id, values);
    success(res, {
      ...result,
      navigate: result.success ? { screen: action.targetScreen, params: result.navigateParams } : undefined,
    });
  }),
};

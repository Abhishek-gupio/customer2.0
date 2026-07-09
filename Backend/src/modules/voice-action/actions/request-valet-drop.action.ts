import { registerVoiceAction } from "../voice-action.registry";
import { VoiceAction, VoiceActionExtractResult, VoiceActionCommitResult } from "../voice-action.types";
import { callAI } from "../../../services/ai-provider.service";
import { logger } from "../../../config/logger";
import { customerService } from "../../customer/customer.service";

// No required slots — vehicleNumber defaults to the customer's primary vehicle server-side
// (matching the manual Valet screen's "just tap the button" flow), so this auto-commits on
// the first turn. It's opportunistically filled here only if the user names a specific
// vehicle in the same utterance.
const SLOTS: VoiceAction["slots"] = [];

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  _missingSlotsHint: string[],
): Promise<VoiceActionExtractResult> {
  const values: Record<string, any> = { ...knownValues };

  if (values.vehicleNumber == null) {
    try {
      const raw = await callAI(
        newReplyText,
        `Extract a vehicle registration number if one is mentioned, e.g. "KA01AB1234". Output ONLY raw JSON, no markdown: {"vehicleNumber": string|null}`,
        { temperature: 0.1, maxOutputTokens: 100 },
      );
      const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed.vehicleNumber === "string" && parsed.vehicleNumber.trim()) {
        values.vehicleNumber = parsed.vehicleNumber.replace(/\s/g, "").toUpperCase();
      }
    } catch (err) {
      logger.debug({ err }, "[VoiceAction:request_valet_drop] optional vehicleNumber extraction failed");
    }
  }

  // No required slots, so this is always complete — auto-commits immediately.
  return { values, missingSlots: [], confidence: "HIGH" };
}

async function commit(customerId: string, values: Record<string, any>): Promise<VoiceActionCommitResult> {
  try {
    const result = await customerService.requestDrop(customerId, values.vehicleNumber || undefined);
    return {
      success: true,
      message: result?.message || "Valet drop request created successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Could not create the valet request right now. Please try again.",
    };
  }
}

registerVoiceAction({
  key: "request_valet_drop",
  slots: SLOTS,
  targetScreen: "Valet",
  extract,
  commit,
});

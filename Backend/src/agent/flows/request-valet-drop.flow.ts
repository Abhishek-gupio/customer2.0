import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { customerService } from "../../modules/customer/customer.service";

// No required slots — vehicleNumber defaults to the customer's primary vehicle server-side
// (matching the manual Valet screen's "just tap the button" flow), so this auto-commits on
// the first turn. It's opportunistically filled here only if the user names a specific
// vehicle in the same utterance.
const SLOTS: Flow["slots"] = [];

function matches(text: string): boolean {
  return (
    /\b(request|call|book|get)\b.*\bvalet\b/i.test(text) ||
    /\bvalet\b.*\b(drop|service|pickup|pick up)\b/i.test(text) ||
    /\bdrop my (car|vehicle)\b/i.test(text)
  );
}

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  _missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const values: Record<string, any> = { ...knownValues };

  if (values.vehicleNumber == null) {
    try {
      const raw = await routeText(
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
      logger.warn({ err }, "[Flow:request_valet_drop] optional vehicleNumber extraction failed");
    }
  }

  // No required slots, so this is always complete — auto-commits immediately.
  return { values, missingSlots: [], confidence: "HIGH" };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  try {
    const result = await customerService.requestDrop(customerId, values.vehicleNumber || undefined);
    return {
      success: true,
      message: result?.message || "Valet drop request created successfully.",
      data: {},
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Could not create the valet request right now. Please try again.",
    };
  }
}

registerFlow({
  key: "request_valet_drop",
  description: "Request a valet to pick up or drop off the user's vehicle.",
  matches,
  slots: SLOTS,
  view: "Valet",
  draftKey: "valet",
  extract,
  commit,
});

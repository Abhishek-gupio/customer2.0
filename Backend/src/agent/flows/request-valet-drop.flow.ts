import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { customerService } from "../../modules/customer/customer.service";

// This flow dispatches a real, physical service, so it must never auto-commit off a single
// utterance: `confirmed` is a required slot, and only an explicit yes fills it. vehicleNumber
// stays optional (defaults to the caller's primary vehicle server-side, matching the manual
// Valet screen) and is opportunistically filled if the user names one in the same utterance.
const SLOTS: Flow["slots"] = [
  {
    name: "confirmed",
    askPrompt: "Just to confirm — should I request a valet to drop your vehicle now?",
    required: true,
  },
];

/**
 * Questions *about* the valet service ("how much does valet service cost", "do you offer
 * valet?") must not enter this flow — it creates a real dispatch. Checked before the intent
 * patterns below, which are otherwise deliberately broad for voice recall.
 */
/**
 * `available` was removed: it blocked "send a valet to drop my car, I'm available at gate 3",
 * which is a command, not a question. Only unambiguous question forms remain.
 */
const INFORMATIONAL = /\b(how much|how do|how does|how can|what is|what's|whats|cost|price|charges?|availability|do you (offer|have|provide)|is there)\b/i;

/**
 * "can I book a valet?" asks about capability; "can you book a valet" is a polite imperative.
 * Only the leading modal+I form is treated as a question, so "can you ..." still routes here.
 */
const ASKS_ABOUT_SELF = /^\s*(can|could|may|should|would|do|am|will)\s+i\b/i;

/** "cancel my valet drop" is the opposite of this flow's intent and must never start it. */
const CANCELLING = /\b(cancel|don'?t|do not|stop|nahi|mat karo)\b/i;

function matches(text: string): boolean {
  if (INFORMATIONAL.test(text) || ASKS_ABOUT_SELF.test(text) || CANCELLING.test(text)) return false;
  return (
    /\b(request|call|book|send|order|arrange)\b.*\bvalet\b/i.test(text) ||
    /\bvalet\b.*\b(drop|pickup|pick up)\b/i.test(text) ||
    /\bdrop my (car|vehicle)\b/i.test(text)
  );
}

/**
 * Yes/no detection for the confirmation turn. Both are anchored to the WHOLE utterance, not just
 * its start: a prefix match let a leading "please"/"ok" in a full sentence count as consent, so
 * "please send a valet" self-confirmed on the first turn (skipping the gate entirely) and
 * "please cancel my valet drop" was read as a yes and created the very request the user was
 * trying to stop. NEGATIVE is also tested first, so a sentence containing both loses safely.
 */
const AFFIRMATIVE = /^\s*(y|ya|yes|yeah|yep|yup|ok|okay|sure|go ahead|do it|please do|yes please|confirm(ed)?|haan|ha|theek hai|kar do)\s*[.!]*\s*$/i;
/**
 * Unanchored on purpose: a refusal anywhere in the sentence should block consent, so a phrase
 * like "ok cancel that" fails closed rather than being read as the leading "ok".
 */
const NEGATIVE = /\b(no|nope|nah|don'?t|do not|stop|cancel|no thanks|nahi|nahin|mat karo)\b/i;

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

  // Confirmation is resolved with a plain regex rather than an LLM call: it keeps the yes/no
  // turn free and, more importantly, avoids a LOW-confidence dead end if extraction fails.
  // An explicit "no" is recorded as `false` (not left null) so the slot counts as filled and
  // commit can decline cleanly instead of re-asking forever.
  if (values.confirmed == null) {
    // NEGATIVE first: a reply that reads as a refusal must never be salvaged into consent.
    if (NEGATIVE.test(newReplyText)) values.confirmed = false;
    else if (AFFIRMATIVE.test(newReplyText)) values.confirmed = true;
  }

  const missingSlots = values.confirmed == null ? ["confirmed"] : [];
  return { values, missingSlots, confidence: missingSlots.length === 0 ? "HIGH" : "LOW" };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  if (values.confirmed !== true) {
    return { success: false, message: "No problem — I haven't requested a valet." };
  }
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

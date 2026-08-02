import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { fastagVerificationService } from "../../modules/document/fastag.service";
import { documentService } from "../../modules/document/document.service";

// IFSC: 4 letters, a literal 0, then 6 alphanumeric characters (standard RBI format).
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Indian bank account numbers vary in length (typically 9-18 digits) — sanity-check only,
// not a strict format, but enough to reject an obviously mis-heard transcription before it
// burns a call against the paid external verification API.
const ACCOUNT_ID_REGEX = /^\d{6,18}$/;

const SLOTS: Flow["slots"] = [
  { name: "creditorAccountId", askPrompt: "What's the bank account number to verify?" },
  { name: "ifscCode", askPrompt: "What's the IFSC code for that account?" },
];

/**
 * Committing this flow asks the user to dictate a bank account number and IFSC, then spends a
 * paid IDSPay call. A balance/status question must therefore not trigger it — "check my fastag
 * balance" is a read, not a request to verify a beneficiary account.
 */
const INFORMATIONAL = /\b(balance|status|how much|recharge|amount|left|remaining|expiry|expires|history)\b/i;

function matches(text: string): boolean {
  if (INFORMATIONAL.test(text)) return false;
  return (
    /\b(verify|check)\b.*\b(fastag|bank account|beneficiary)\b/i.test(text) || /\bfastag verification\b/i.test(text)
  );
}

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const systemPrompt = `You extract bank account verification details from a short spoken reply.
Only these fields matter:
- creditorAccountId: a bank account number, digits only (strip spaces/dashes the user may have said between groups of digits)
- ifscCode: an 11-character IFSC code — 4 letters, then a zero, then 6 more letters/digits, e.g. "SBIN0001234" (uppercase, strip spaces)

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a field if it is clearly present in what the user just said — do not guess or invent digits.
Output ONLY raw JSON, no markdown, no explanation: {"creditorAccountId": string|null, "ifscCode": string|null}`;

  let parsed: any = {};
  try {
    const raw = await routeText(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 150 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ err }, "[Flow:verify_fastag] extract parse failed");
    parsed = {};
  }

  // Validate at *write* time against the same regexes the confidence gate below uses.
  //
  // These two rules previously disagreed: a loosely-checked value was stored, the strict gate
  // then refused to accept it, and because slots were write-once no correction could ever
  // replace it — leaving the user stuck on an unanswerable "Could you clarify that?". Storing
  // only values that can actually pass means a bad transcription leaves the slot empty, so the
  // engine re-asks the real question and the next answer overwrites cleanly.
  const values: Record<string, any> = { ...knownValues };
  if (typeof parsed.creditorAccountId === "string") {
    const digits = parsed.creditorAccountId.replace(/\D/g, "");
    if (ACCOUNT_ID_REGEX.test(digits)) values.creditorAccountId = digits;
  }
  if (typeof parsed.ifscCode === "string") {
    const clean = parsed.ifscCode.replace(/\s/g, "").toUpperCase();
    if (IFSC_REGEX.test(clean)) values.ifscCode = clean;
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  // Never mark HIGH confidence unless both values also pass real format validation — an
  // account number/IFSC that "extracted" but is malformed should still trigger a re-ask
  // rather than a wasted call to the paid external verification API.
  const formatsValid =
    missingSlots.length === 0 &&
    ACCOUNT_ID_REGEX.test(String(values.creditorAccountId)) &&
    IFSC_REGEX.test(String(values.ifscCode));
  const confidence: FlowExtractResult["confidence"] = formatsValid ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  const accountId = String(values.creditorAccountId || "").replace(/\D/g, "");
  const ifsc = String(values.ifscCode || "").replace(/\s/g, "").toUpperCase();

  if (!ACCOUNT_ID_REGEX.test(accountId)) {
    return { success: false, message: "That doesn't look like a valid account number. Please say it again clearly." };
  }
  if (!IFSC_REGEX.test(ifsc)) {
    return { success: false, message: "That doesn't look like a valid IFSC code. Please say it again clearly." };
  }

  try {
    const result = await fastagVerificationService.verifyAccount(accountId, ifsc);
    await documentService.storeFastagVerification(customerId, result).catch((err) => {
      logger.error({ err, customerId }, "[Flow:verify_fastag] failed to store verification result");
    });
    return {
      success: true,
      message: "Your Fastag account has been verified successfully.",
      data: { justVerifiedViaVoice: true },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Could not verify that account. Please check the details and try again.",
    };
  }
}

registerFlow({
  key: "verify_fastag",
  description: "Verify a bank account (account number + IFSC code) for Fastag/toll auto-payments.",
  matches,
  slots: SLOTS,
  view: "Fastag",
  draftKey: "fastag",
  extract,
  commit,
});

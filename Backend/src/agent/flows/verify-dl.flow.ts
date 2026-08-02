import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { dlVerificationService } from "../../services/dl-verification.service";
import { documentService } from "../../modules/document/document.service";

// DD-MM-YYYY, matching the exact format the manual DLVerification screen sends.
const DOB_REGEX = /^\d{2}-\d{2}-\d{4}$/;

/**
 * Indian driving licence: two-letter state code, then digits (formats vary by state, e.g.
 * "DL1420110012345", "MH0220120001234"). Deliberately shape-based rather than exhaustive — it
 * only has to be strong enough that a date, a phone number, or a stray word cannot pass for one.
 */
const DL_NUMBER_REGEX = /^[A-Z]{2}[A-Z0-9]{6,18}$/;

const SLOTS: Flow["slots"] = [
  { name: "dlNumber", askPrompt: "What's your driving licence number?" },
  { name: "dob", askPrompt: "What's your date of birth?" },
];

/**
 * This flow asks the user to dictate their licence number and date of birth, then spends a paid
 * IDSPay call. Status/expiry questions are reads and must not trigger it — note the existing
 * `\bdl\b` word boundary already keeps "download my documents" out.
 */
/**
 * Read-only licence questions. Kept narrow on purpose: an over-broad guard here silently disables
 * the flow for real commands. `number is`, `my dl number`, `valid`/`validity` and `show` were all
 * removed after they blocked the natural one-shot phrasings "verify my dl number is DL14...",
 * "verify my dl number DL14..." and "verify my driving licence validity" — a false negative that
 * turns off the feature is worse than the false positive this guard exists to prevent.
 */
const INFORMATIONAL = /\b(status|expiry|expires|when does|how long)\b/i;

function matches(text: string): boolean {
  if (INFORMATIONAL.test(text)) return false;
  return (
    /\b(verify|check)\b.*\b(dl|driving licen[cs]e|license)\b/i.test(text) || /\bdl verification\b/i.test(text)
  );
}

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const systemPrompt = `You extract driving-licence verification details from a short spoken reply.
Only these fields matter:
- dlNumber: an Indian driving licence number, letters and digits only (strip spaces the user said between groups)
- dob: date of birth, normalized to exactly DD-MM-YYYY (e.g. "15th of August 1990" -> "15-08-1990", "1990-08-15" -> "15-08-1990")

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a field if it is clearly present in what the user just said — do not guess or invent digits.
Output ONLY raw JSON, no markdown, no explanation: {"dlNumber": string|null, "dob": string|null}`;

  let parsed: any = {};
  try {
    const raw = await routeText(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 150 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ err }, "[Flow:verify_dl] extract parse failed");
    parsed = {};
  }

  // Overwrite on a newly extracted valid value so a correction lands; a null or malformed
  // extraction leaves the stored value alone rather than wiping it.
  const values: Record<string, any> = { ...knownValues };
  if (typeof parsed.dlNumber === "string") {
    const clean = parsed.dlNumber.replace(/[\s-]/g, "").toUpperCase();
    // Must look like a real licence, not merely be long enough. With the write-once guard removed
    // so corrections can land, a weak `length >= 5` check meant a later turn's stray digits could
    // overwrite an already-correct number — e.g. the extractor echoing a date of birth as
    // "15081990" silently replaced the licence and still passed commit's identical length check,
    // sending garbage to the paid IDSPay call. An Indian DL is state code + digits.
    if (DL_NUMBER_REGEX.test(clean)) values.dlNumber = clean;
  }
  if (typeof parsed.dob === "string" && DOB_REGEX.test(parsed.dob.trim())) {
    values.dob = parsed.dob.trim();
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  // Only HIGH confidence once dob actually matches the required DD-MM-YYYY shape — otherwise
  // re-ask rather than send a malformed date to the paid external verification API.
  const formatsValid = missingSlots.length === 0 && DOB_REGEX.test(String(values.dob));
  const confidence: FlowExtractResult["confidence"] = formatsValid ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  const dlNumber = String(values.dlNumber || "").replace(/\s/g, "").toUpperCase();
  const dob = String(values.dob || "").trim();

  if (dlNumber.length < 5) {
    return { success: false, message: "That doesn't look like a valid licence number. Please say it again clearly." };
  }
  if (!DOB_REGEX.test(dob)) {
    return { success: false, message: "Please say your date of birth as day, month, and year." };
  }

  try {
    const result = await dlVerificationService.verifyDL(dlNumber, dob);
    await documentService.storeVerifiedDL(customerId, result, dlNumber).catch((err) => {
      logger.error({ err, customerId }, "[Flow:verify_dl] failed to store verification result");
    });
    return {
      success: true,
      message: "Your driving licence has been verified successfully.",
      data: { justVerifiedViaVoice: true },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Could not verify that licence. Please check the details and try again.",
    };
  }
}

registerFlow({
  key: "verify_dl",
  description: "Verify the user's driving licence using their licence number and date of birth.",
  matches,
  slots: SLOTS,
  view: "DLVerification",
  draftKey: "dl_verification",
  extract,
  commit,
});

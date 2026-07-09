import { registerVoiceAction } from "../voice-action.registry";
import { VoiceAction, VoiceActionExtractResult, VoiceActionCommitResult } from "../voice-action.types";
import { callAI } from "../../../services/ai-provider.service";
import { logger } from "../../../config/logger";
import { dlVerificationService } from "../../../services/dl-verification.service";
import { documentService } from "../../document/document.service";

// DD-MM-YYYY, matching the exact format the manual DLVerification screen sends.
const DOB_REGEX = /^\d{2}-\d{2}-\d{4}$/;

const SLOTS: VoiceAction["slots"] = [
  { name: "dlNumber", askPrompt: "What's your driving licence number?" },
  { name: "dob", askPrompt: "What's your date of birth?" },
];

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<VoiceActionExtractResult> {
  const systemPrompt = `You extract driving-licence verification details from a short spoken reply.
Only these fields matter:
- dlNumber: an Indian driving licence number, letters and digits only (strip spaces the user said between groups)
- dob: date of birth, normalized to exactly DD-MM-YYYY (e.g. "15th of August 1990" -> "15-08-1990", "1990-08-15" -> "15-08-1990")

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a field if it is clearly present in what the user just said — do not guess or invent digits.
Output ONLY raw JSON, no markdown, no explanation: {"dlNumber": string|null, "dob": string|null}`;

  let parsed: any = {};
  try {
    const raw = await callAI(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 150 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.debug({ err }, "[VoiceAction:verify_dl] extract parse failed");
    parsed = {};
  }

  const values: Record<string, any> = { ...knownValues };
  if (values.dlNumber == null && typeof parsed.dlNumber === "string") {
    const clean = parsed.dlNumber.replace(/\s/g, "").toUpperCase();
    if (clean.length >= 5) values.dlNumber = clean;
  }
  if (values.dob == null && typeof parsed.dob === "string" && DOB_REGEX.test(parsed.dob.trim())) {
    values.dob = parsed.dob.trim();
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  // Only HIGH confidence once dob actually matches the required DD-MM-YYYY shape — otherwise
  // re-ask rather than send a malformed date to the paid external verification API.
  const formatsValid = missingSlots.length === 0 && DOB_REGEX.test(String(values.dob));
  const confidence: "HIGH" | "MEDIUM" | "LOW" = formatsValid ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<VoiceActionCommitResult> {
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
      logger.error({ err, customerId }, "[VoiceAction:verify_dl] failed to store verification result");
    });
    return {
      success: true,
      message: "Your driving licence has been verified successfully.",
      navigateParams: { justVerifiedViaVoice: true },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Could not verify that licence. Please check the details and try again.",
    };
  }
}

registerVoiceAction({
  key: "verify_dl",
  slots: SLOTS,
  targetScreen: "DLVerification",
  extract,
  commit,
});

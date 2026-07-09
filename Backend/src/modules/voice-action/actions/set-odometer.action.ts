import { registerVoiceAction } from "../voice-action.registry";
import { VoiceAction, VoiceActionExtractResult, VoiceActionCommitResult } from "../voice-action.types";
import { callAI } from "../../../services/ai-provider.service";
import { logger } from "../../../config/logger";
import { vehicleService } from "../../vehicle/vehicle.service";
import { AppError } from "../../../utils/AppError";

const SLOTS: VoiceAction["slots"] = [
  { name: "reading", askPrompt: "What's the current odometer reading?" },
];

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<VoiceActionExtractResult> {
  const systemPrompt = `You extract an odometer reading from a short spoken reply.
Only this field matters: reading — a positive whole number of kilometers, parsed from either digits ("45230") or spoken words ("forty five thousand two hundred and thirty").

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a value if it is clearly present in what the user just said — do not guess.
Output ONLY raw JSON, no markdown, no explanation: {"reading": number|null}`;

  let parsed: any = {};
  try {
    const raw = await callAI(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 100 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.debug({ err }, "[VoiceAction:set_odometer] extract parse failed");
    parsed = {};
  }

  const values: Record<string, any> = { ...knownValues };
  if (values.reading == null && parsed.reading != null && Number(parsed.reading) > 0) {
    values.reading = Number(parsed.reading);
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const confidence: "HIGH" | "MEDIUM" | "LOW" = missingSlots.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<VoiceActionCommitResult> {
  const reading = Number(values.reading);
  if (!Number.isFinite(reading) || reading <= 0) {
    return { success: false, message: "That doesn't look like a valid odometer reading. Please say it again." };
  }

  const vehicle = await vehicleService.resolveVehicleTarget(customerId, {});
  if (vehicle.ambiguous) {
    return {
      success: false,
      message: "Which vehicle should I update — " +
        vehicle.candidates.map((v) => v.registrationNumber).filter(Boolean).join(" or ") + "?",
    };
  }
  if (!vehicle.vehicleId) {
    return { success: false, message: "I could not find a vehicle to update the odometer for." };
  }

  try {
    await vehicleService.addOdometerLog(customerId, vehicle.vehicleId, {
      reading,
      date: new Date(),
    });
    return {
      success: true,
      message: `Odometer updated to ${reading.toLocaleString("en-IN")} kilometers.`,
      navigateParams: { screen: "Odometer", params: { justSetViaVoice: true } },
    };
  } catch (err: any) {
    if (err instanceof AppError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: "Could not update the odometer right now. Please try again." };
  }
}

registerVoiceAction({
  key: "set_odometer",
  slots: SLOTS,
  // Odometer lives inside the Main tab navigator, not the root stack — React Navigation's
  // nested-dispatch convention (navigate('Main', { screen: 'Odometer', params })) already
  // works with the existing generic {screen, params} navigate contract for free, as long as
  // targetScreen is the parent ("Main") and navigateParams carries the child {screen, params}.
  targetScreen: "Main",
  extract,
  commit,
});

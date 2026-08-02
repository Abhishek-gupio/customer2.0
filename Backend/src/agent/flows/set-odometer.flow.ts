import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { vehicleService } from "../../modules/vehicle/vehicle.service";
import { AppError } from "../../utils/AppError";

const SLOTS: Flow["slots"] = [{ name: "reading", askPrompt: "What's the current odometer reading?" }];

/** Sanity ceiling for a speech-extracted reading — see the guard in `extract`. */
const MAX_ODOMETER_KM = 2_000_000;

function matches(text: string): boolean {
  return (
    /\b(update|set|log|record)\b.*\bodometer\b/i.test(text) ||
    /\bodometer\b.*\b(reading|is|update|km|kms)\b/i.test(text) ||
    /\bmy (car|vehicle|bike) (has done|is at)\b/i.test(text)
  );
}

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const systemPrompt = `You extract an odometer reading from a short spoken reply.
Only this field matters: reading — a positive whole number of kilometers, parsed from either digits ("45230") or spoken words ("forty five thousand two hundred and thirty").

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a value if it is clearly present in what the user just said — do not guess.
Output ONLY raw JSON, no markdown, no explanation: {"reading": number|null}`;

  let parsed: any = {};
  try {
    const raw = await routeText(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 100 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ err }, "[Flow:set_odometer] extract parse failed");
    parsed = {};
  }

  // Overwrite on a newly extracted valid reading so a correction lands; a null extraction
  // (the user said something else this turn) leaves the stored value alone.
  //
  // The upper bound matters: an over-large mis-extraction ("four hundred fifty thousand" heard as
  // 450000000) is rejected here rather than being written, because `addOdometerLog` refuses any
  // future reading lower than the last one — one bad write would block every real reading after
  // it. 2,000,000 km is comfortably beyond any real vehicle.
  const values: Record<string, any> = { ...knownValues };
  const candidate = parsed.reading != null ? Number(parsed.reading) : NaN;
  if (Number.isFinite(candidate) && Number.isInteger(candidate) && candidate > 0 && candidate <= MAX_ODOMETER_KM) {
    values.reading = candidate;
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const confidence: FlowExtractResult["confidence"] = missingSlots.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  const reading = Number(values.reading);
  if (!Number.isFinite(reading) || reading <= 0) {
    return { success: false, message: "That doesn't look like a valid odometer reading. Please say it again." };
  }

  const vehicle = await vehicleService.resolveVehicleTarget(customerId, {});
  if (vehicle.ambiguous) {
    return {
      success: false,
      message:
        "Which vehicle should I update — " +
        vehicle.candidates.map((v) => v.registrationNumber).filter(Boolean).join(" or ") +
        "?",
    };
  }
  if (!vehicle.vehicleId) {
    return { success: false, message: "I could not find a vehicle to update the odometer for." };
  }

  try {
    await vehicleService.addOdometerLog(customerId, vehicle.vehicleId, { reading, date: new Date() });
    return {
      success: true,
      message: `Odometer updated to ${reading.toLocaleString("en-IN")} kilometers.`,
      data: { reading },
      // Odometer lives inside the Main tab navigator, not the root stack — redirect *where*
      // the engine's open_view event points; the engine still authors the actual event.
      viewOverride: { view: "Main", params: { screen: "Odometer", params: { justSetViaVoice: true } } },
    };
  } catch (err: any) {
    if (err instanceof AppError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: "Could not update the odometer right now. Please try again." };
  }
}

registerFlow({
  key: "set_odometer",
  description: "Record or update the vehicle's current odometer reading.",
  matches,
  slots: SLOTS,
  view: "Main",
  draftKey: "odometer",
  extract,
  commit,
});

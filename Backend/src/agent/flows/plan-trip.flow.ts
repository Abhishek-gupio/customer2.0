import { dbInstances } from "@repo/db-customer";
import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { vehicleService } from "../../modules/vehicle/vehicle.service";
import { tripExpenseService } from "../../modules/trip-expense/trip-expense.service";

const db = dbInstances as any;

// Only origin/destination are required to show a useful result — vehicle is a real optional
// refinement (it changes the fuel-cost calculation via vehicleType/fuelType), so it's asked
// about after the trip is already showing, not before.
const SLOTS: Flow["slots"] = [
  { name: "origin", askPrompt: "Where are you starting from?" },
  { name: "destination", askPrompt: "Where are you headed?" },
  { name: "vehicleId", askPrompt: "Which vehicle are you taking?", required: false },
];

function matches(text: string): boolean {
  return /\bplan\b.*\btrip\b/i.test(text) || /\btrip from\b.*\bto\b/i.test(text) || /\broute from\b.*\bto\b/i.test(text);
}

async function extract(
  customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const systemPrompt = `You extract trip-planning details from a short spoken reply for a vehicle trip-cost planner.
Only these fields matter:
- origin: the starting city/place name
- destination: the destination city/place name
- vehicleName: a vehicle name/registration number/nickname if one is mentioned (e.g. "my Swift", "KA01AB1234", "the bike") — not a database id, just what the user said

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a field if it is clearly present in what the user just said — do not guess or invent a place name.
Output ONLY raw JSON, no markdown, no explanation: {"origin": string|null, "destination": string|null, "vehicleName": string|null}`;

  let parsed: any = {};
  try {
    const raw = await routeText(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 150 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ err }, "[Flow:plan_trip] extract parse failed");
    parsed = {};
  }

  // Overwrite on a newly extracted value so a correction ("no, to Agra") lands; a null
  // extraction leaves the stored value alone.
  const values: Record<string, any> = { ...knownValues };
  if (typeof parsed.origin === "string" && parsed.origin.trim()) {
    values.origin = parsed.origin.trim();
  }
  if (typeof parsed.destination === "string" && parsed.destination.trim()) {
    values.destination = parsed.destination.trim();
  }
  if (values.vehicleId == null && typeof parsed.vehicleName === "string" && parsed.vehicleName.trim()) {
    // Resolve a spoken vehicle name/registration to a real vehicleId now, during extraction,
    // so a mismatch ("I don't have that vehicle") can be surfaced as a re-ask rather than
    // silently failing later inside commit.
    try {
      const resolved = await vehicleService.resolveVehicleTarget(customerId, {
        registrationNumber: parsed.vehicleName.trim(),
      });
      if (resolved.vehicleId) values.vehicleId = resolved.vehicleId;
    } catch (err) {
      logger.warn({ err }, "[Flow:plan_trip] vehicle name resolution failed");
    }
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const requiredMissing = missingSlots.filter((name) => SLOTS.find((s) => s.name === name)?.required !== false);
  const confidence: FlowExtractResult["confidence"] = requiredMissing.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  const origin = String(values.origin || "").trim();
  const destination = String(values.destination || "").trim();
  if (!origin || !destination) {
    return { success: false, message: "I need both a starting point and a destination to plan the trip." };
  }

  let vehicleType: string | undefined;
  let fuelType: string | undefined;
  if (values.vehicleId) {
    try {
      const vehicle = await db.customerVehicle.findUnique({
        where: { id: values.vehicleId },
        select: { vehicleType: true, fuelType: true },
      });
      vehicleType = vehicle?.vehicleType ?? undefined;
      fuelType = vehicle?.fuelType ?? undefined;
    } catch (err) {
      logger.warn({ err }, "[Flow:plan_trip] vehicle lookup for fuel/vehicle type failed");
    }
  }

  try {
    // calculateTripExpense derives a stable tripId from `${origin}_${destination}` per customer
    // and upserts on it — calling this again with a newly-resolved vehicleType/fuelType (once
    // the optional vehicle slot is filled) naturally recalculates the same trip in place rather
    // than creating a duplicate PlannedTrip row.
    const result = await tripExpenseService.calculateTripExpense({
      from: origin,
      to: destination,
      customerId,
      vehicleId: values.vehicleId,
      vehicleType,
      fuelType,
    });

    const activeRoute = result.cheapestRoute || result.fastestRoute || result.routes?.[0];
    const message = activeRoute
      ? `Here's your route from ${origin} to ${destination}: ${activeRoute.distance.text}, about ${activeRoute.duration.text}, estimated cost ₹${activeRoute.costs.total}.`
      : `I've planned your trip from ${origin} to ${destination}.`;

    return {
      success: true,
      message,
      data: { tripId: result.id, origin, destination, vehicleId: values.vehicleId, result },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Could not calculate that trip right now. Please try again.",
    };
  }
}

registerFlow({
  key: "plan_trip",
  description:
    "Plan a road trip between two places — calculates route, tolls, and fuel cost, then lets the user refine it with which vehicle they're taking. Matches any travel/vacation/trip/getaway/holiday intent, even phrased indirectly (e.g. 'I have some money saved for a trip', 'thinking about a getaway to Goa', 'need a holiday next month') — not just literal 'plan a trip' phrasing.",
  matches,
  slots: SLOTS,
  view: "TripExpense",
  draftKey: "trip-plan",
  extract,
  commit,
});

import { logger } from "../config/logger";
import { dbInstances } from "@repo/db-customer";
import { callAI, isAIConfigured } from "./ai-provider.service";

const db = dbInstances as any;

/** Part type and suggested interval from OEM/public knowledge. */
export type SuggestedInterval = {
  partType: string;
  intervalKm: number;
  intervalMonths: number;
  source: string;
};

/**
 * Reference: Public OEM-style intervals for Indian market (from manufacturer manuals / PMS).
 * Used in the prompt so the model returns structured data aligned with real schedules.
 */
const CAR_REFERENCE_INTERVALS = `
Indian OEM typical intervals for cars (use as reference; return for matching make/model):
- Maruti Suzuki (Swift, Dzire, Baleno, Brezza, Alto, Ertiga, etc.): ENGINE_OIL 10000 km / 6 months, OIL_FILTER 10000/6, AIR_FILTER 20000/12, BRAKE_PADS 30000/24, SPARK_PLUGS 30000/24, COOLANT 40000/24, AC_FILTER 15000/12, WIPER_BLADES 20000/12, BATTERY 36 months.
- Hyundai India (i20, Creta, Venue, Verna, Grand i10, etc.): ENGINE_OIL 10000 km / 1 year, OIL_FILTER 10000/12, AIR_FILTER 20000-30000/12, BRAKE_FLUID 45000/3y, SPARK_PLUGS 60000-160000 (model dependent), AC_FILTER 20000/2y.
- Tata (Nexon, Harrier, Punch, Tiago, Safari): ENGINE_OIL 10000/6-12, OIL_FILTER 10000, AIR_FILTER 20000, BRAKE_PADS 30000-40000.
- Mahindra (XUV700, Thar, XUV500, Scorpio): ENGINE_OIL 10000/12, AIR_FILTER 20000, similar to above for brakes and filters.
- Honda India (City, Amaze, Elevate): ENGINE_OIL 10000/12, filters and brakes per manual (typically 20k-30k km).
If make/model not in list, use generic: ENGINE_OIL 10000/6, OIL_FILTER 10000/6, AIR_FILTER 15000/12, BRAKE_PADS 30000/24, BATTERY 36/-, SPARK_PLUGS 30000/24, COOLANT 40000/24, AC_FILTER 15000/12, WIPER_BLADES 20000/12.
`;

const BIKE_REFERENCE_INTERVALS = `
Indian OEM typical intervals for two-wheelers (motorcycles/scooters) -- use as reference:
- Hero MotoCorp (Splendor, HF Deluxe, Passion, Glamour): engine oil every 2500-3000 km or 3 months, air filter 10000 km/12 months, spark plugs 10000 km/12 months, chain and sprocket kit 20000 km/24 months, rear brake shoes (drum) 20000 km/24 months, battery 24 months.
- Honda two-wheelers (Activa, Shine, Unicorn): engine oil 3000 km/4 months; scooters use a CVT belt instead of a chain -- CVT belt 20000-25000 km/24 months, air filter 8000-12000 km/12 months.
- Bajaj Auto (Pulsar, Platina, CT100): engine oil 3000-5000 km/6 months, chain and sprocket kit 20000 km/24 months, front disc brake pads (where fitted) 25000 km/24 months.
- TVS Motor (Apache, Jupiter, Ntorq): engine oil 3000-5000 km/6 months, CVT belt on scooters 20000 km/24 months, chain and sprocket kit on motorcycles 20000 km/24 months.
- Royal Enfield (Classic, Bullet, Meteor): engine oil 3000 km/3 months, chain and sprocket kit 20000 km/24 months, spark plugs 15000 km/24 months.
- Suzuki Motorcycle India (Access, Gixxer): engine oil 3000-4000 km/6 months, CVT belt on the Access 20000 km/24 months.
If make/model not in list, use generic for two-wheelers: engine oil 3000 km/3 months, oil filter 6000 km/6 months, air filter 10000 km/12 months, brake pads 20000 km/24 months, brake shoes 20000 km/24 months, chain and sprocket kit 20000 km/24 months, spark plugs 10000 km/12 months, battery 24 months.
`;

const PART_TYPES =
  "ENGINE_OIL, OIL_FILTER, AIR_FILTER, BRAKE_PADS, BRAKE_DISCS, BRAKE_SHOES, BATTERY, TYRES_FRONT, TYRES_REAR, CLUTCH_PLATE, SPARK_PLUGS, COOLANT, TIMING_BELT, CVT_BELT, CHAIN_SPROCKET_KIT, AC_FILTER, WIPER_BLADES, HEADLIGHT_BULB, OTHER_PART";

/**
 * Use AI to suggest parts replacement intervals for a vehicle based on public OEM knowledge (Indian market).
 * Returns structured intervals that can be saved to PartReplacementInterval with source = 'AI_SUGGESTED'.
 */
export async function suggestIntervalsFromAI(
  make: string,
  model: string,
  year: number | null,
  vehicleType?: string | null,
): Promise<SuggestedInterval[]> {
  if (!isAIConfigured()) {
    logger.warn("No AI provider configured, cannot suggest OEM intervals");
    return [];
  }

  const yearStr = year ? String(year) : "unknown";
  const isBike = /BIKE|MOTORCYCLE|SCOOTER|2W|TWO/i.test(String(vehicleType || ""));
  const referenceIntervals = isBike ? BIKE_REFERENCE_INTERVALS : CAR_REFERENCE_INTERVALS;

  const prompt = `
You are an expert in Indian vehicle service schedules. Using ONLY the reference data below (from public OEM manuals), return replacement intervals for this vehicle.

Vehicle: Make="${make}", Model="${model}", Year=${yearStr}, Category=${isBike ? "TWO_WHEELER (motorcycle/scooter)" : "CAR"}

${referenceIntervals}

Task: Return a JSON array of intervals. Each object must have:
- partType: one of [${PART_TYPES}]
- intervalKm: number (e.g. 10000)
- intervalMonths: number (e.g. 6 or 12)
- source: "AI_SUGGESTED"

Include as many parts as possible from this list: ENGINE_OIL, OIL_FILTER, AIR_FILTER, BRAKE_PADS, BRAKE_DISCS, BATTERY, TYRES_FRONT, TYRES_REAR, CLUTCH_PLATE, SPARK_PLUGS, COOLANT, TIMING_BELT, AC_FILTER, WIPER_BLADES, HEADLIGHT_BULB.
Skip part types you Have absolutely no data for, but prioritize getting a complete set for common Indian vehicles.
Return ONLY valid JSON array, no markdown or extra text. Example: [{"partType":"ENGINE_OIL","intervalKm":10000,"intervalMonths":6,"source":"AI_SUGGESTED"}]
`;

  try {
    const text = await callAI(prompt);
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as SuggestedInterval[];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (p) =>
        p.partType &&
        typeof p.intervalKm === "number" &&
        typeof p.intervalMonths === "number",
    );
  } catch (e) {
    logger.error({ err: e, make, model }, "AI OEM interval suggestion failed");
    return [];
  }
}

/**
 * Priority rank for an interval source. Used so a lower-priority source (e.g. a later
 * AI-fallback save) can never silently downgrade/overwrite an already-verified,
 * higher-priority source (e.g. real OEM-scraped data) already stored for the same row.
 */
function sourceRank(source?: string | null): number {
  const s = (source || "").toUpperCase();
  if (s === "OEM_WEBSITE") return 2;
  if (s === "AI_SUGGESTED") return 1;
  return 0;
}

/**
 * Save suggested intervals to PartReplacementInterval for the given make/model/year.
 * Uses make/model/yearMin/yearMax; if year is null, uses yearMin=0, yearMax=9999.
 */
export async function saveSuggestedIntervals(
  make: string,
  model: string,
  year: number | null,
  intervals: SuggestedInterval[],
): Promise<{ saved: number; errors: string[] }> {
  if (!make || !model) return { saved: 0, errors: ["make and model required"] };

  const yearMin = year ?? 0;
  const yearMax = year ?? 9999;
  const errors: string[] = [];
  let saved = 0;

  if (!db.partReplacementInterval) {
    return { saved: 0, errors: ["PartReplacementInterval model not in schema"] };
  }

  for (const p of intervals) {
    try {
      const incomingSource = p.source || "AI_SUGGESTED";
      const isOemWebsite = incomingSource.toUpperCase() === "OEM_WEBSITE";
      const incomingRank = sourceRank(incomingSource);
      const whereKey = {
        make_model_yearMin_yearMax_partType: {
          make,
          model,
          yearMin,
          yearMax,
          partType: p.partType as any,
        },
      };

      const existing = await db.partReplacementInterval.findUnique({ where: whereKey });

      if (existing && sourceRank(existing.source) > incomingRank) {
        // A higher-priority source (e.g. OEM_WEBSITE) already sits here -- never let a
        // lower-priority save (e.g. AI_SUGGESTED) downgrade it.
        logger.debug(
          { make, model, partType: p.partType, existingSource: existing.source, incomingSource },
          "Skipping interval overwrite: existing source outranks incoming source",
        );
        if (isOemWebsite) {
          // Confirming an OEM value (or attempting to supersede a lower-rank one) still
          // counts as "just verified against the live OEM source".
          await db.partReplacementInterval.update({
            where: whereKey,
            data: { verifiedAt: new Date() },
          });
        }
        continue;
      }

      await db.partReplacementInterval.upsert({
        where: whereKey,
        create: {
          make,
          model,
          yearMin,
          yearMax,
          partType: p.partType as any,
          intervalMonths: p.intervalMonths,
          intervalKm: p.intervalKm,
          defaultWarrantyMonths: 0,
          source: incomingSource,
          ...(isOemWebsite ? { verifiedAt: new Date() } : {}),
        },
        update: {
          intervalMonths: p.intervalMonths,
          intervalKm: p.intervalKm,
          source: incomingSource,
          ...(isOemWebsite ? { verifiedAt: new Date() } : {}),
        },
      });
      saved++;
    } catch (e: any) {
      errors.push(`${p.partType}: ${e?.message || "failed"}`);
    }
  }

  return { saved, errors };
}

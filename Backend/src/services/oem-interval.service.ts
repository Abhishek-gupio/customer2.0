import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { dbInstances } from "@repo/db-customer";

const db = dbInstances as any;
const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;

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
const OEM_REFERENCE_INTERVALS = `
Indian OEM typical intervals (use as reference; return for matching make/model):
- Maruti Suzuki (Swift, Dzire, Baleno, Brezza, Alto, Ertiga, etc.): ENGINE_OIL 10000 km / 6 months, OIL_FILTER 10000/6, AIR_FILTER 20000/12, BRAKE_PADS 30000/24, SPARK_PLUGS 30000/24, COOLANT 40000/24, AC_FILTER 15000/12, WIPER_BLADES 20000/12, BATTERY 36 months.
- Hyundai India (i20, Creta, Venue, Verna, Grand i10, etc.): ENGINE_OIL 10000 km / 1 year, OIL_FILTER 10000/12, AIR_FILTER 20000-30000/12, BRAKE_FLUID 45000/3y, SPARK_PLUGS 60000-160000 (model dependent), AC_FILTER 20000/2y.
- Tata (Nexon, Harrier, Punch, Tiago, Safari): ENGINE_OIL 10000/6-12, OIL_FILTER 10000, AIR_FILTER 20000, BRAKE_PADS 30000-40000.
- Mahindra (XUV700, Thar, XUV500, Scorpio): ENGINE_OIL 10000/12, AIR_FILTER 20000, similar to above for brakes and filters.
- Honda India (City, Amaze, Elevate): ENGINE_OIL 10000/12, filters and brakes per manual (typically 20k-30k km).
If make/model not in list, use generic: ENGINE_OIL 10000/6, OIL_FILTER 10000/6, AIR_FILTER 15000/12, BRAKE_PADS 30000/24, BATTERY 36/-, SPARK_PLUGS 30000/24, COOLANT 40000/24, AC_FILTER 15000/12, WIPER_BLADES 20000/12.
`;

const PART_TYPES =
  "ENGINE_OIL, OIL_FILTER, AIR_FILTER, BRAKE_PADS, BRAKE_DISCS, BATTERY, TYRES_FRONT, TYRES_REAR, CLUTCH_PLATE, SPARK_PLUGS, COOLANT, TIMING_BELT, AC_FILTER, WIPER_BLADES, HEADLIGHT_BULB, OTHER_PART";

/**
 * Use AI to suggest parts replacement intervals for a vehicle based on public OEM knowledge (Indian market).
 * Returns structured intervals that can be saved to PartReplacementInterval with source = 'AI_SUGGESTED'.
 */
export async function suggestIntervalsFromAI(
  make: string,
  model: string,
  year: number | null,
): Promise<SuggestedInterval[]> {
  if (!genAI) {
    logger.warn("Gemini not configured, cannot suggest OEM intervals");
    return [];
  }

  const modelInstance = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const yearStr = year ? String(year) : "unknown";

  const prompt = `
You are an expert in Indian vehicle service schedules. Using ONLY the reference data below (from public OEM manuals), return replacement intervals for this vehicle.

Vehicle: Make="${make}", Model="${model}", Year=${yearStr}

${OEM_REFERENCE_INTERVALS}

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
    const result = await modelInstance.generateContent(prompt);
    const text = result.response.text();
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
      await db.partReplacementInterval.upsert({
        where: {
          make_model_yearMin_yearMax_partType: {
            make,
            model,
            yearMin,
            yearMax,
            partType: p.partType as any,
          },
        },
        create: {
          make,
          model,
          yearMin,
          yearMax,
          partType: p.partType as any,
          intervalMonths: p.intervalMonths,
          intervalKm: p.intervalKm,
          defaultWarrantyMonths: 0,
          source: p.source || "AI_SUGGESTED",
        },
        update: {
          intervalMonths: p.intervalMonths,
          intervalKm: p.intervalKm,
          source: p.source || "AI_SUGGESTED",
        },
      });
      saved++;
    } catch (e: any) {
      errors.push(`${p.partType}: ${e?.message || "failed"}`);
    }
  }

  return { saved, errors };
}

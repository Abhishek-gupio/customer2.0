/**
 * Seed DEFAULT part replacement intervals into PartReplacementInterval.
 * Run after migration. Uses the same values as warranty.service fallback.
 *
 * Usage: from repo root:
 *   pnpm --filter Backend exec ts-node -r tsconfig-paths/register src/scripts/seed-part-intervals.ts
 * Or with dotenv: node -r dotenv/config dist/scripts/seed-part-intervals.js
 */
import { dbInstances } from "@repo/db-customer";

const PART_LIFECYCLE: Record<
  string,
  { months: number; km: number; defaultWarrantyMonths: number }
> = {
  ENGINE_OIL: { months: 6, km: 10000, defaultWarrantyMonths: 0 },
  OIL_FILTER: { months: 6, km: 10000, defaultWarrantyMonths: 0 },
  AIR_FILTER: { months: 12, km: 15000, defaultWarrantyMonths: 0 },
  BRAKE_PADS: { months: 24, km: 30000, defaultWarrantyMonths: 6 },
  BRAKE_DISCS: { months: 36, km: 60000, defaultWarrantyMonths: 12 },
  BATTERY: { months: 36, km: 80000, defaultWarrantyMonths: 24 },
  TYRES_FRONT: { months: 36, km: 40000, defaultWarrantyMonths: 12 },
  TYRES_REAR: { months: 36, km: 40000, defaultWarrantyMonths: 12 },
  CLUTCH_PLATE: { months: 48, km: 60000, defaultWarrantyMonths: 6 },
  SPARK_PLUGS: { months: 24, km: 30000, defaultWarrantyMonths: 0 },
  COOLANT: { months: 24, km: 40000, defaultWarrantyMonths: 0 },
  TIMING_BELT: { months: 48, km: 60000, defaultWarrantyMonths: 6 },
  AC_FILTER: { months: 12, km: 15000, defaultWarrantyMonths: 0 },
  WIPER_BLADES: { months: 12, km: 20000, defaultWarrantyMonths: 3 },
  HEADLIGHT_BULB: { months: 24, km: 50000, defaultWarrantyMonths: 6 },
  OTHER_PART: { months: 12, km: 20000, defaultWarrantyMonths: 0 },
};

const db = dbInstances as any;

// Use non-null placeholders so PostgreSQL unique constraint works (nulls are distinct)
const DEFAULT_PLACEHOLDER = {
  make: "DEFAULT",
  model: "",
  yearMin: 0,
  yearMax: 9999,
};

async function seed() {
  console.log("Seeding DEFAULT part replacement intervals...");
  let count = 0;
  for (const [partType, lifecycle] of Object.entries(PART_LIFECYCLE)) {
    await db.partReplacementInterval.upsert({
      where: {
        make_model_yearMin_yearMax_partType: {
          make: DEFAULT_PLACEHOLDER.make,
          model: DEFAULT_PLACEHOLDER.model,
          yearMin: DEFAULT_PLACEHOLDER.yearMin,
          yearMax: DEFAULT_PLACEHOLDER.yearMax,
          partType,
        },
      },
      create: {
        ...DEFAULT_PLACEHOLDER,
        partType,
        intervalMonths: lifecycle.months,
        intervalKm: lifecycle.km,
        defaultWarrantyMonths: lifecycle.defaultWarrantyMonths,
        source: "GENERIC",
      },
      update: {
        intervalMonths: lifecycle.months,
        intervalKm: lifecycle.km,
        defaultWarrantyMonths: lifecycle.defaultWarrantyMonths,
        source: "GENERIC",
      },
    });
    count++;
  }
  console.log(`Upserted ${count} DEFAULT intervals.`);
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

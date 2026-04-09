/**
 * Demo: OEM interval scraper (Hyundai PMS from website).
 *
 * 1. Finds first customer and creates/uses a Hyundai Creta demo vehicle.
 * 2. Calls fetchAndSaveIntervalsForVehicle (scrapes Hyundai PMS HTML, saves to PartReplacementInterval).
 * 3. Prints saved intervals.
 *
 * Prerequisites:
 *   - DATABASE_URL in Backend/.env (or env).
 *   - At least one Customer in DB (e.g. from app signup).
 *   - PartReplacementInterval table exists (run: pnpm prisma:migrate:dev).
 *
 * Usage (from Backend directory):
 *   npx ts-node -r dotenv/config src/scripts/demo-oem-scraper.ts
 * With cleanup (removes demo vehicle and OEM_WEBSITE intervals for Hyundai/Creta):
 *   npx ts-node -r dotenv/config src/scripts/demo-oem-scraper.ts --cleanup
 */
import "dotenv/config";
import { dbInstances } from "@repo/db-customer";
import { fetchAndSaveIntervalsForVehicle } from "../services/oem-scraper.service";

const db = dbInstances as any;

const DEMO_REG = "DEMO-TVS-JUPITER-01";
const DEMO_MAKE = "Tvs Motor Company Ltd";
const DEMO_MODEL = "Jupiter";
const DEMO_YEAR = 2021;

async function run(cleanup: boolean) {
  if (cleanup) {
    await doCleanup();
    return;
  }

  let customer = await db.customer.findFirst({ orderBy: { id: "asc" } });
  if (!customer) {
    console.error("No customer in DB. Create a customer first (e.g. via app signup).");
    process.exit(1);
  }

  let vehicle = await db.customerVehicle.findUnique({
    where: { registrationNumber: DEMO_REG },
  });

  if (!vehicle) {
    vehicle = await db.customerVehicle.create({
      data: {
        customerId: customer.id,
        registrationNumber: DEMO_REG,
        make: DEMO_MAKE,
        model: DEMO_MODEL,
        manufacturingMonthYear: `01/${DEMO_YEAR}`,
      },
    });
    console.log("Created demo vehicle:", vehicle.id, DEMO_MAKE, DEMO_MODEL, DEMO_YEAR);
  } else {
    console.log("Using existing demo vehicle:", vehicle.id, DEMO_MAKE, DEMO_MODEL);
  }

  console.log("\nFetching OEM intervals from OEM website...");
  const result = await fetchAndSaveIntervalsForVehicle(vehicle.id);
  console.log("Result:", result);

  let rows: any[] = [];
  try {
    rows = await db.partReplacementInterval.findMany({
      where: {
        make: DEMO_MAKE,
        model: DEMO_MODEL,
        source: "OEM_WEBSITE",
      },
      orderBy: [{ partType: "asc" }],
    });
  } catch (e: any) {
    if (e?.code === "P2021" || e?.message?.includes("PartReplacementInterval") || e?.message?.includes("does not exist")) {
      console.log("\nPartReplacementInterval table not found. Run migration first:");
      console.log("  pnpm prisma:migrate:dev   # or apply the PartReplacementInterval migration");
      console.log("  Then run this demo again.");
      console.log("\nScrape succeeded (intervals were parsed from Hyundai); only DB save was skipped.");
      console.log("Demo done.");
      return;
    }
    throw e;
  }

  console.log("\nSaved intervals (PartReplacementInterval, source=OEM_WEBSITE):");
  if (rows.length === 0) {
    console.log("  (none – check result.errors above; may be cached for 24h or migration not applied)");
  } else {
    rows.forEach((r: any) => {
      console.log(`  ${r.partType}: ${r.intervalKm} km / ${r.intervalMonths} months`);
    });
  }
  console.log("\nDemo done.");
}

async function doCleanup() {
  const v = await db.customerVehicle.findUnique({
    where: { registrationNumber: DEMO_REG },
  });
  if (v) {
    await db.customerVehicle.delete({ where: { id: v.id } }).catch(() => {});
    console.log("Deleted demo vehicle:", DEMO_REG);
  }

  const deleted = await db.partReplacementInterval.deleteMany({
    where: {
      make: DEMO_MAKE,
      model: DEMO_MODEL,
      source: "OEM_WEBSITE",
    },
  });
  console.log("Deleted OEM_WEBSITE intervals for Hyundai/Creta:", deleted.count);
  console.log("Cleanup done.");
}

const cleanup = process.argv.includes("--cleanup");
run(cleanup)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

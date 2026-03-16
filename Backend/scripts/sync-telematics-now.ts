/**
 * Run Damoov telematics sync immediately, bypassing rate-limit backoff.
 * Usage: pnpm exec ts-node scripts/sync-telematics-now.ts
 */
import path from "path";
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

import { telematicsService } from "../src/services/telematics.service";

telematicsService
  .syncTripsForAllDevices({ forceLogin: true })
  .then(() => {
    console.log("Sync finished.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

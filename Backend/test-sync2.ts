import { telematicsService } from "./src/services/telematics.service";

async function run() {
  console.log("------- STARTING MANUAL SYNC -------");
  try {
    await telematicsService.syncTripsForAllDevices();
    console.log("------- SYNC FINISHED SUCCESSFULLY -------");
  } catch (e: any) {
    console.error("------- SYNC FAILED -------", e.message || e);
  }
  process.exit(0);
}

run();

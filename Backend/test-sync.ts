import { telematicsService } from "./src/services/telematics.service";

async function main() {
  console.log("Triggering manual sync...");
  await telematicsService.syncTripsForAllDevices();
  console.log("Sync completed!");
  process.exit();
}

main().catch(console.error);

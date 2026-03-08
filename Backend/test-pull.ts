import "dotenv/config";
import { telematicsService } from "./src/services/telematics.service";

async function run() {
    console.log("Triggering manual Telematics Sync...");
    await telematicsService.syncTripsForAllDevices();
    console.log("Sync complete.");
}

run().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});

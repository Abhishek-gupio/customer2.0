import { settlementService } from "../src/modules/parking/settlement.service";

async function main() {
  console.log("Running manual settlements...");
  await settlementService.generateDailySettlements();
  console.log("Settlements completed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error running settlements", err);
  process.exit(1);
});

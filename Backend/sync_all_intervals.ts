import { dbInstances as prisma } from "@repo/db-customer";
import { fetchAndSaveIntervalsForVehicle } from "./src/services/oem-scraper.service";

async function syncAllVehicles() {
  const vehicles = await prisma.customerVehicle.findMany({
    where: { isActive: true },
    select: { id: true, make: true, model: true }
  });

  console.log(`Syncing ${vehicles.length} vehicles...`);
  for (const v of vehicles) {
    try {
      const result = await fetchAndSaveIntervalsForVehicle(v.id);
      console.log(`✅ [${v.make} ${v.model}] Result:`, result.source, `(Saved: ${result.saved})`);
    } catch (e: any) {
      console.error(`❌ [${v.make} ${v.model}] Error:`, e.message);
    }
  }

  await prisma.$disconnect();
}

syncAllVehicles();

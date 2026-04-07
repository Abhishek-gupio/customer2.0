import { dbInstances as prisma } from "@repo/db-customer";

async function inspectVehiclesAndIntervals() {
  console.log("--- VEHICLES ---");
  const vehicles = await prisma.customerVehicle.findMany({
    select: { id: true, make: true, model: true, registrationNumber: true }
  });
  console.log(JSON.stringify(vehicles, null, 2));

  console.log("\n--- OEM INTERVALS ---");
  const intervals = await prisma.partReplacementInterval.findMany({
    where: { source: "OEM_WEBSITE" }
  });
  console.log(JSON.stringify(intervals, null, 2));

  console.log("\n--- AI SUGGESTED INTERVALS ---");
  const aiIntervals = await prisma.partReplacementInterval.findMany({
    where: { source: "AI_SUGGESTED" }
  });
  console.log(JSON.stringify(aiIntervals, null, 2));

  await prisma.$disconnect();
}

inspectVehiclesAndIntervals();

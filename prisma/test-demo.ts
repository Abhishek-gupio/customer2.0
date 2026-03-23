import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const vehicle = await prisma.customerVehicle.findFirst({
    where: { isPrimary: true }
  });
  if (!vehicle) {
    console.log("No primary vehicle found.");
    return;
  }
  await prisma.telematicsDevice.upsert({
    where: { instanceId: "e331f9cd-e3e1-4a47-9d4b-67cf324ed300" },
    update: {
      vehicleId: vehicle.id,
      isActive: true,
    },
    create: {
      vehicleId: vehicle.id,
      instanceId: "e331f9cd-e3e1-4a47-9d4b-67cf324ed300",
      deviceToken: "test_token",
      platform: "android",
      isActive: true,
    }
  });
  console.log("Success! Vehicle linked to TelematicsDevice.");
}
run();

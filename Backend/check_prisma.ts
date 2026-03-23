import { dbInstances as prisma } from "@repo/db-customer";

async function check() {
  console.log("Checking DB Connection using Prisma from Backend...");
  try {
    const sosCount = await prisma.sOSRequest.count();
    console.log(`✅ Successfully connected! Found ${sosCount} SOSRequest records in the "customer" schema.`);
    
    const contactCount = await prisma.emergencyContact.count();
    console.log(`✅ Found ${contactCount} EmergencyContact records.`);
  } catch (error) {
    console.error('❌ Error querying tables:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

check();

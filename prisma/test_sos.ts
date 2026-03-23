import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Checking DB Connection...");
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

main();

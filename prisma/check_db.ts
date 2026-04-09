
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSING EMERGENCY CONTACTS ---');
  const contacts = await prisma.emergencyContact.findMany({
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      relation: true,
      customerId: true,
    }
  });

  console.log(`Found ${contacts.length} contacts:`);
  console.table(contacts);
  
  const customers = await prisma.customer.findMany({
    select: {
        id: true,
        fullName: true,
        email: true
    }
  });
  console.log(`\nFound ${customers.length} customers:`);
  console.table(customers);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

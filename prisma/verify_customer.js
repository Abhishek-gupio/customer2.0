require('dotenv').config();
const { PrismaClient } = require('./dist/generated/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching first customer...');
    const customer = await prisma.customer.findFirst();
    console.log('Success:', customer);
  } catch (err) {
    console.error('Error fetching customer:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

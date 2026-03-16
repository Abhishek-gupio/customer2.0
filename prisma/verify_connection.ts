import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Attempting to connect to database...');
    await prisma.$connect();
    console.log('Database connected successfully.');
    
    // Check if FAQ model exists and we can count
    const count = await (prisma as any).fAQ.count();
    console.log('Current FAQ count:', count);
  } catch (error) {
    console.error('Database connection or query failed:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking SupportTicket table...');
    const tickets = await prisma.supportTicket.findMany({ take: 1 });
    console.log('SupportTicket table exists.');

    console.log('Checking FAQ table...');
    const faqs = await prisma.faq.findMany({ take: 1 });
    console.log('FAQ table exists.');

    console.log('Database verification successful.');
  } catch (error) {
    console.error('Database verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

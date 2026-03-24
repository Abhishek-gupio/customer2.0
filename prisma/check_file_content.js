const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const docs = await prisma.vehicleDocument.findMany({
    where: {
      fileContent: { not: null }
    },
    select: {
      id: true,
      type: true,
      mimeType: true
    },
    take: 5
  });
  console.log('Documents with fileContent:', docs);
  await prisma.$disconnect();
}

main().catch(console.error);

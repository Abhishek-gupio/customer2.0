const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require&schema=customer"
});

async function run() {
  const users = await prisma.customer.findMany({
    where: {
      fullName: {
        contains: 'Zeenath',
        mode: 'insensitive'
      }
    }
  });
  console.log(JSON.stringify(users, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());

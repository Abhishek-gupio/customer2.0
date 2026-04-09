import { PrismaClient } from './prisma/generated/client';

const prisma = new PrismaClient();

async function main() {
  const assets = await (prisma as any).vehicleAsset.findMany({ take: 5 });
  console.log('Vehicle Assets:', JSON.stringify(assets, null, 2));

  const customers = await prisma.customer.findMany({ take: 5, select: { profilePic: true } });
  console.log('Customer profilePics:', JSON.stringify(customers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

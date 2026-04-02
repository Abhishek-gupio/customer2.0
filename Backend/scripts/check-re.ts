import { dbInstances } from "@repo/db-customer";

async function main() {
  const catalogs = await dbInstances.vehicleCatalog.findMany({
    where: {
      make: { contains: "royal", mode: "insensitive" }
    },
    select: {
      id: true,
      make: true,
      model: true,
      variant: true
    }
  });

  console.log(JSON.stringify(catalogs, null, 2));
}

main().finally(() => dbInstances.$disconnect());

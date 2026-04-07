import { PrismaClient } from '../prisma/generated/client';

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: "postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require&schema=customer"
  });

  try {
    const customer = await prisma.customer.findFirst({
        where: {
            OR: [
                { fullName: { contains: 'Zeenath', mode: 'insensitive' } },
                { phoneNumber: { contains: '9999999999' } }
            ]
        }
    });

    if (!customer) {
        console.log("No customer found");
        return;
    }

    console.log("Customer Found:", customer.fullName, customer.phoneNumber, customer.id);

    const docs = await prisma.vehicleDocument.findMany({
      where: { customerId: customer.id },
      include: { vehicle: true }
    });

    console.log(`Documents (${docs.length}):`);
    docs.forEach(doc => {
        console.log(`- Type: ${doc.type}, Reg: ${doc.vehicle?.registrationNumber || 'None'}, FileUrl: ${doc.fileUrl}`);
    });

    const vehicles = await prisma.customerVehicle.findMany({
        where: { customerId: customer.id }
    });
    console.log(`Vehicles (${vehicles.length}):`);
    vehicles.forEach(v => {
        console.log(`- Reg: ${v.registrationNumber}, Model: ${v.model}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

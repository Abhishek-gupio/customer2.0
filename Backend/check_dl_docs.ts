import { dbInstances } from "./src/config/db"; // Adjust path if needed
import { PrismaClient } from "@repo/db-customer";

async function main() {
    const db = new PrismaClient();
    const docs = await db.vehicleDocument.findMany({
        where: { type: 'DL' },
        take: 5
    });
    console.log(JSON.stringify(docs, null, 2));
    await db.$disconnect();
}

main();

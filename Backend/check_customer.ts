import { PrismaClient } from "@repo/db-customer";

async function main() {
    const db = new PrismaClient();
    const customer = await db.customer.findUnique({
        where: { id: "cmlj50qq00000ohti713c0bwy" }
    });
    console.log("Customer exists:", !!customer);
    if (customer) {
        console.log("Customer data:", JSON.stringify(customer, null, 2));
    }
    await db.$disconnect();
}

main().catch(console.error);

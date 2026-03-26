import { dbInstances } from "@repo/db-customer";

const db = dbInstances as any;

async function checkPrices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prices = await db.fuelPriceCache.findMany({
        where: {
            date: { gte: today }
        }
    });

    console.log(`Found ${prices.length} fuel prices for today (${today.toISOString().split('T')[0]})`);
    if (prices.length > 0) {
        console.log("Example prices:");
        prices.slice(0, 5).forEach((p: any) => {
            console.log(`- ${p.city} (${p.fuelType}): ₹${p.price} [Source: ${p.source}]`);
        });
    }
}

checkPrices().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

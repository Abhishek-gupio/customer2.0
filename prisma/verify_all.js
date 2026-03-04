const { PrismaClient } = require("./generated/client");
const dotenv = require("dotenv");
const path = require("path");

// Load .env
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function verify() {
    console.log("--- Verification Script ---");
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not Set");
    console.log("REDIS_URL:", process.env.REDIS_URL ? "Set" : "Not Set");

    const prisma = new PrismaClient();

    try {
        console.log("\n1. Testing Database Connection...");
        await prisma.$connect();
        console.log("✅ Database Connected.");

        console.log("\n2. Checking PostgreSQL Schemas...");
        const schemas = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata;`;
        console.log("Available Schemas:", schemas.map(s => s.schema_name).join(", "));

        const hasCustomer = schemas.some(s => s.schema_name === "customer");
        if (hasCustomer) {
            console.log("✅ 'customer' schema exists.");
        } else {
            console.log("❌ 'customer' schema NOT FOUND. You need to run migrations or db push.");
        }

        console.log("\n3. Testing Redis (via getRedis logic)...");
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            console.log("ℹ️ REDIS_URL is not set. Redis is disabled (Expected for local dev).");
        } else {
            console.log(`⚠️ REDIS_URL is set to: ${redisUrl}. Connecting...`);
            const Redis = require("ioredis");
            const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
            try {
                await redis.ping();
                console.log("✅ Redis Connected.");
            } catch (err) {
                console.log("❌ Redis Connection Failed:", err.message);
            } finally {
                await redis.quit();
            }
        }

    } catch (err) {
        console.log("❌ Verification Failed:", err.message);
        if (err.message.includes("P1001")) {
            console.log("\nTip: Ensure your PostgreSQL is running at localhost:5432 and credentials are correct.");
        }
    } finally {
        await prisma.$disconnect();
    }
}

verify();

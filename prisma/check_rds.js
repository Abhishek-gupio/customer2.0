const { Client } = require("pg");

const connectionString = "postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require";

async function checkRDS() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        console.log("✅ RDS Connected.");
        const res = await client.query("SELECT schema_name FROM information_schema.schemata;");
        console.log("Schemas:", res.rows.map(r => r.schema_name).join(", "));
    } catch (err) {
        console.log("❌ RDS Connection Failed:", err.message);
    } finally {
        await client.end();
    }
}

checkRDS();

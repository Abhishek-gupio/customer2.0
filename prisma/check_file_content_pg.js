const { Client } = require('pg');
const DB_URL = "postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query('SELECT id, type, "mimeType", octet_length("fileContent") as size FROM "customer"."VehicleDocument" WHERE "fileContent" IS NOT NULL LIMIT 5');
  console.log('Documents with fileContent:', res.rows);
  await client.end();
}

main().catch(console.error);

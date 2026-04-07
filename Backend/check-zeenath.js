process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require"
});

async function run() {
  await client.connect();
  console.log("Connected to RDS.");

  const resCust = await client.query('SELECT id, "fullName", "phoneNumber" FROM "customer"."Customer" WHERE "fullName" ILIKE \'%Zeenath%\' OR "phoneNumber" LIKE \'%9999999999%\'');
  if (resCust.rows.length === 0) {
    console.log("No Zeenath found.");
    await client.end();
    return;
  }

  const cust = resCust.rows[0];
  console.log("Customer:", cust.fullName, cust.phoneNumber, cust.id);

  const resDocs = await client.query('SELECT d.type, v."registrationNumber" FROM "customer"."VehicleDocument" d LEFT JOIN "customer"."CustomerVehicle" v ON d."vehicleId" = v.id WHERE d."customerId" = $1', [cust.id]);
  console.log("Documents Found:", resDocs.rows.length);
  resDocs.rows.forEach(r => {
    console.log(`- Type: ${r.type}, Reg: ${r.registrationNumber || 'GLOBAL'}`);
  });

  const resVeh = await client.query('SELECT "registrationNumber", model FROM "customer"."CustomerVehicle" WHERE "customerId" = $1', [cust.id]);
  console.log("Vehicles Found:", resVeh.rows.length);
  resVeh.forEach(v => {
      console.log(`- Reg: ${v.registrationNumber}, Model: ${v.model}`);
  });

  await client.end();
}

run().catch(console.error);

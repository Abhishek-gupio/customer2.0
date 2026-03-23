const { Client } = require('pg');
const client = new Client({ 
  connectionString: 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await client.connect();
    const res = await client.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'SOSRequest';`);
    console.log("Found Tables:", res.rows);
  } catch(e) {
    console.error("DB Error:", e);
  } finally {
    await client.end();
  }
}
check();

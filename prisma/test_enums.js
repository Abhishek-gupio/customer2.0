const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const url = 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require';

async function test() {
    const client = new Client({ connectionString: url });
    try {
        await client.connect();
        console.log('Connected to RDS');
        const res = await client.query("SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'customer' AND t.typtype = 'e';");
        console.log('Enums in customer schema:', res.rows.map(r => r.typname).join(', '));
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}
test();

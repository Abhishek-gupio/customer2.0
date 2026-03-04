const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const url = 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require';

async function test() {
    const client = new Client({ connectionString: url });
    try {
        await client.connect();
        console.log('Connected to RDS');
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
        console.log('Tables in public schema:', res.rows.map(r => r.table_name).join(', '));
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}
test();

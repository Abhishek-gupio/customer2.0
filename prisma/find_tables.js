const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const url = 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require';

async function test() {
    const client = new Client({ connectionString: url });
    try {
        await client.connect();
        console.log('Connected to RDS');
        const tablesToFind = ['Challan', 'OdometerLog', 'Expense', 'ExpenseBudget', 'FuelPriceCache', 'ServiceRecord', 'ServicePart', 'TelematicsDevice', 'DrivingTrip', 'DrivingEvent', 'SOSRequest', 'EmergencyContact'];
        const res = await client.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE ANY($1) ORDER BY table_name, table_schema;`, [tablesToFind.map(t => `%${t}%`)]);
        res.rows.forEach(r => console.log(`${r.table_schema}.${r.table_name}`));
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}
test();

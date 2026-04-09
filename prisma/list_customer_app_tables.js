const { Client } = require('pg');
const c = new Client({ 
  connectionString: 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db', 
  ssl: { rejectUnauthorized: false } 
});
c.connect().then(async () => { 
  const res = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'customer_app'");
  console.log('Tables in customer_app schema:');
  res.rows.forEach(r => console.log(' - ' + r.table_name));
  c.end(); 
}).catch(console.error);

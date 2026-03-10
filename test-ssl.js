const { Pool } = require('pg');
const url = 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db?sslmode=require&schema=customer';

const u = new URL(url);
const sslmode = u.searchParams.get('sslmode');
let ssl = false;
if (sslmode === 'require') ssl = { rejectUnauthorized: false };
u.searchParams.delete('sslmode');

const pool = new Pool({
  connectionString: u.toString(),
  ssl
});
pool.query('SELECT 1 as num', (err, res) => {
  if (err) console.error('ERROR:', err.message);
  else console.log('SUCCESS:', res.rows);
  pool.end();
});

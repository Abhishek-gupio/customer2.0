const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db',
  ssl: { rejectUnauthorized: false }
});
c.connect().then(async () => {
  // Check migration table in customer schema and public schema
  for (const schema of ['public', 'customer']) {
    const migs = await c.query(`
      SELECT migration_name, finished_at IS NULL as failed 
      FROM ${schema}._prisma_migrations ORDER BY finished_at DESC NULLS FIRST LIMIT 15
    `).catch(() => ({ rows: [] }));
    if (migs.rows.length > 0) {
      console.log(`\n=== _prisma_migrations in ${schema} schema ===`);
      migs.rows.forEach(m => console.log(`  ${m.failed ? '✗ FAILED' : '✓'} ${m.migration_name}`));
    }
  }

  // Specifically check if AdminUser table exists
  const adminCheck = await c.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name = 'AdminUser'
  `);
  console.log('\n=== AdminUser table ===');
  console.log(adminCheck.rows.length ? adminCheck.rows : 'NOT FOUND');

  c.end();
}).catch(e => { console.error('Error:', e.message); process.exit(1); });

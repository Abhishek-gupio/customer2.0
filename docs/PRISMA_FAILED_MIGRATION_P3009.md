# Fix Prisma error P3009 (failed migration)

If you see:

```text
Error: P3009
migrate found failed migrations in the target database...
The `YYYY..._migration_name` migration ... failed
```

Prisma will not apply **any** new migration until that row is resolved.

## 1. Decide what actually happened on the database

- **A) The migration did not apply** (transaction rolled back, or failed immediately)  
  → Use **rolled-back** (see below).

- **B) The migration partially or fully applied** (e.g. “relation already exists”, then you fixed things by hand)  
  → Inspect the DB, then either mark **applied** or **rolled-back** after you align schema with reality.

- **C) The DB already had all objects** and the migration failed only because of duplicates  
  → Often correct to mark **applied** so Prisma history matches the DB (only if you are sure).

## 2. Mark the failed migration (same `DATABASE_URL` as Backend)

From repo root (or `prisma/` with `DATABASE_URL` in `prisma/.env`):

**If the failed migration should be treated as not applied** (most common after a failed first run):

```bash
cd prisma
pnpm exec prisma migrate resolve --rolled-back "20260317190000_baseline_valet_tables"
```

**If you have manually brought the DB in line with that migration** and want Prisma to record it as done:

```bash
cd prisma
pnpm exec prisma migrate resolve --applied "20260317190000_baseline_valet_tables"
```

Then deploy the rest:

```bash
pnpm prisma:migrate:deploy
```

(From monorepo root: `pnpm prisma:migrate:deploy` if that script exists.)

## 3. If `baseline_valet_tables` is not in `prisma/migrations` anymore

Your database still remembers that name. After `migrate resolve`, either:

- Restore that migration folder from git/backup so `migrate deploy` stays consistent, or  
- Keep using only migrations that exist in the repo (resolve rolled-back, then never re-add the same name unless you know what you’re doing).

## 4. Inspect failure reason (optional)

In PostgreSQL:

```sql
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE migration_name LIKE '%baseline%'
ORDER BY started_at DESC;
```

Use `logs` / DB state to choose **rolled-back** vs **applied**.

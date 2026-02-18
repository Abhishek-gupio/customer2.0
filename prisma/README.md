# @repo/db-customer (Prisma)

Database client for the customer2.0 project. Uses PostgreSQL with a **dedicated schema** for full isolation from other projects that share the same DB URL.

## Isolation rules (same DB URL as another project)

1. **Every model must use `@@schema("customer")`**  
   All tables live in the PostgreSQL schema `customer`. Never add a model without this attribute, or it may be created in `public` and mix with the other app.

2. **Do not touch `public` (or other project schemas)**  
   Avoid raw SQL or any tooling that runs in `public`. Keep all DB changes in the `customer` schema.

3. **Separate migration history**  
   Run migrations only from this repo (`pnpm prisma:migrate:dev`, `prisma db push`, etc.). Do not run the other project’s migrations from this app, or this project’s migrations from the other app.

4. **Shared DB, not shared schema**  
   We share the same DB URL and instance (connection pool, CPU, disk). Schema and data are isolated via the `customer` schema.

## Commands

**From repo root** (`customer2.0/`): use `pnpm prisma:migrate:dev`, `pnpm prisma:generate`, `pnpm prisma:studio`, or `pnpm db:migrate` (same as prisma:migrate:dev).

**From `prisma/` directory:** use `pnpm prisma:generate`, `pnpm prisma:migrate:dev`, `pnpm prisma:studio`, or `pnpm prisma db push`.

- `pnpm prisma:generate` – generate Prisma Client
- `pnpm prisma:migrate:dev` – create/apply migrations (customer schema only)
- `pnpm prisma db push` – push schema without migration files (dev; run from `prisma/`)
- `pnpm prisma:studio` – open Prisma Studio

Ensure `prisma/.env` (or `DATABASE_URL` in the environment) is set and PostgreSQL is running before migrations.

## Prisma Studio and the “old” app’s models

Prisma Studio (v7+) **introspects the whole database**, so the sidebar lists **all tables in every schema** (e.g. `public` and `customer`). You will see both:

- **This project’s tables** – under the **`customer`** schema (e.g. `User`).
- **The old application’s tables** – usually in the **`public`** schema.

That’s expected: same DB URL means one connection, and Studio shows everything. **Use only the `customer` schema** for this app; ignore or avoid editing tables in `public`. There is no option in Studio to hide other schemas.

## Local database (Docker, then migrate)

From the **repo root** (`customer2.0/`):

1. **Start PostgreSQL** (requires [Docker](https://docs.docker.com/get-docker/) installed and running):

   ```bash
   pnpm db:up
   ```

   Or manually: `docker compose up -d`.

2. **Wait a few seconds** for Postgres to accept connections, then run migrations:

   ```bash
   pnpm db:migrate
   ```

   Or do both in one go: `pnpm db:setup` (starts Docker, waits 5s, then migrates).

3. Ensure `prisma/.env` uses the local URL (see `.env.local.example`). It should look like:
   ```bash
   DATABASE_URL=postgresql://abhishekkumar@localhost:5432/valet_db?schema=customer
   ```

**No Docker?** From repo root run:

- **`pnpm db:up:local`** – tries to start PostgreSQL via **Homebrew** (macOS). If you don’t have PostgreSQL yet, run:
  ```bash
  brew install postgresql@16 && brew services start postgresql@16
  ```
  Then run `pnpm db:up:local` again, then **`pnpm db:migrate`**.
- Or use [Postgres.app](https://postgresapp.com/): install, start it, then in **psql** run `CREATE USER abhishekkumar SUPERUSER;` and `CREATE DATABASE valet_db OWNER abhishekkumar;`, copy `prisma/.env.local.example` to `prisma/.env`, and run **`pnpm db:migrate`**.

## Troubleshooting

### `connect ECONNREFUSED 127.0.0.1:5432` or P1001 (Can't reach database server)

Prisma is trying to use **localhost** but no PostgreSQL is running there.

- **Option A – Use RDS:** Keep `prisma/.env` with your RDS `DATABASE_URL` (as in `prisma/env`). If you get **P1011 (TLS / bad certificate)** with RDS, use Option B.
- **Option B – Use local PostgreSQL (Docker or Postgres.app):**
  - **Docker:** From repo root run `pnpm db:up` (or `docker compose up -d`). Then `pnpm db:migrate` or from `prisma/`: `pnpm prisma:migrate:dev`.
  - **Postgres.app:** Install [Postgres.app](https://postgresapp.com/) and start it. In **psql** run:
    ```sql
    CREATE USER abhishekkumar SUPERUSER;
    CREATE DATABASE valet_db OWNER abhishekkumar;
    ```
    Then copy the local URL into `prisma/.env`: `cp prisma/.env.local.example prisma/.env`, and run `pnpm prisma:migrate:dev` from `prisma/`.
    In Prisma Studio, choose schema **`customer`** to see this app's tables.

### P1010 (User was denied access on the database)

PostgreSQL is running but the user `abhishekkumar` or database `valet_db` doesn't exist yet (common with Homebrew Postgres).

**Fix:** From repo root run **`pnpm db:up:local`** — it creates the user and database using Homebrew's `psql`. Then run **`pnpm db:migrate`**.

Or run these once (use Homebrew's psql if `psql` is not in PATH):

```bash
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE USER abhishekkumar WITH SUPERUSER;"
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE DATABASE valet_db OWNER abhishekkumar;"
```

Then run `pnpm db:migrate` again.

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

From repo root or from `prisma/`:

- `pnpm prisma:generate` – generate Prisma Client
- `pnpm prisma:migrate:dev` – create/apply migrations (customer schema only)
- `pnpm prisma db push` – push schema without migration files (dev)
- `pnpm prisma:studio` – open Prisma Studio

Ensure `prisma/.env` (or `DATABASE_URL` in the environment) is set before running any of these.

## Prisma Studio and the “old” app’s models

Prisma Studio (v7+) **introspects the whole database**, so the sidebar lists **all tables in every schema** (e.g. `public` and `customer`). You will see both:

- **This project’s tables** – under the **`customer`** schema (e.g. `User`).
- **The old application’s tables** – usually in the **`public`** schema.

That’s expected: same DB URL means one connection, and Studio shows everything. **Use only the `customer` schema** for this app; ignore or avoid editing tables in `public`. There is no option in Studio to hide other schemas.

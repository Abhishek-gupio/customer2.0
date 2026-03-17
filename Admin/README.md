# Customer Admin Dashboard

Web admin dashboard for the customer app. Theme matches the mobile app (dark background `#0a0a0a`, accent `#FFBF00`).

## Role-based access

- **SUPER_ADMIN / ADMIN**: Full access – dashboard stats, all customers, full customer detail (vehicles, expenses, documents, support tickets).
- **SUPPORT**: Can list customers and view customer detail with **support tickets only** (no vehicles/expenses/documents).

## Setup

1. **Apply migration** (from repo root; ensure DB has `customer` schema):
   ```bash
   pnpm db:migrate
   ```
   If that fails (e.g. shadow DB), run the SQL in `prisma/prisma/migrations/20260317000000_add_admin_user/migration.sql` manually against your DB.

2. **Create first admin** (from Backend folder):
   ```bash
   cd Backend
   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=YourSecurePassword pnpm exec ts-node scripts/seed-admin.ts
   ```

3. **Run backend** (port 4000):
   ```bash
   pnpm --filter Backend dev
   ```

4. **Run admin dashboard** (port 3001, proxies `/api` to backend):
   ```bash
   pnpm --filter admin-dashboard dev
   ```
   Or from this folder: `pnpm dev`

5. Open http://localhost:3001, sign in with the admin email/password.

## API (under `/api`)

- `POST /api/v1/admin/auth/login` – body: `{ email, password }`
- `GET /api/v1/admin/me` – current admin (Bearer)
- `GET /api/v1/admin/stats` – overview stats (SUPER_ADMIN, ADMIN only)
- `GET /api/v1/admin/customers?page=&limit=&search=` – list customers
- `GET /api/v1/admin/customers/:id` – customer detail (role-based fields)

All admin routes except login require header: `Authorization: Bearer <accessToken>`.

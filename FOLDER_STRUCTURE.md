# Folder structure

How this repo is organized and where to put new code.

## Repo layout (monorepo)

```
customer2.0/
├── .cursor/
│   └── rules/              # Cursor AI rules (e.g. prisma-isolation.mdc)
├── Backend/                 # API server (Express)
├── prisma/                  # Database package (@repo/db-customer)
├── MobileApp/               # React Native (Expo) app
├── package.json             # Root scripts: pnpm dev, build, lint, format
├── pnpm-workspace.yaml      # Workspace packages: Backend, prisma, MobileApp
├── turbo.json               # Turbo tasks for build/dev/lint
├── README.md
└── FOLDER_STRUCTURE.md      # This file
```

- **Root**: Monorepo config only. No app source code here.
- **Packages**: Each app or shared lib lives in its own folder and is listed in `pnpm-workspace.yaml`.

---

## Backend (API) – production-style structure

```
Backend/
├── src/
│   ├── app.ts              # Express app: middleware, mount routes
│   ├── server.ts           # Entry: load env, start server
│   ├── config/
│   │   ├── env.ts          # Env validation (zod)
│   │   └── logger.ts       # Pino logger
│   ├── modules/
│   │   └── user/
│   │       ├── user.controller.ts
│   │       ├── user.service.ts
│   │       ├── user.routes.ts
│   │       └── user.types.ts
│   ├── middlewares/
│   │   ├── error.middleware.ts
│   │   └── auth.middleware.ts
│   ├── utils/
│   │   └── asyncHandler.ts
│   └── routes.ts           # Aggregates modules: app.use('/api', apiRoutes)
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

**How to follow:**

| What you add | Where to put it |
|--------------|------------------|
| New feature (e.g. posts) | `Backend/src/modules/post/` with `post.controller.ts`, `post.service.ts`, `post.routes.ts`, `post.types.ts`; then in `routes.ts`: `router.use("/posts", postRoutes)` |
| New shared middleware | `Backend/src/middlewares/` and use in `app.ts` |
| New config | `Backend/src/config/` (e.g. `db.ts`) and import from `env` or logger where needed |
| Shared helpers | `Backend/src/utils/` |
| App-level route wiring | `Backend/src/routes.ts` – mount all module routes under `/api` (or other base path) |

- **config/env.ts**: Validates `process.env` with zod; fail fast on invalid env. Use `env` everywhere instead of `process.env`.
- **modules/***: One folder per domain (user, post, …). Each has routes (controller → service → DB). Use `asyncHandler` in controllers for async route handlers.
- **middlewares/error.middleware**: Global error handler; must be last middleware in `app.ts`.
- **middlewares/auth.middleware**: Placeholder; replace with real JWT/session auth when needed.

---

## Prisma (database package)

```
prisma/
├── .env                     # DATABASE_URL for CLI (migrate, studio) – do not commit
├── prisma.config.ts        # Prisma 7 config (schema path, datasource url)
├── prisma/
│   ├── schema.prisma       # Models (all with @@schema("customer"))
│   └── generated/          # Generated client (do not edit)
│       └── prisma/
├── src/
│   └── index.ts            # Exports: dbInstances, PrismaClient, models
├── dist/                   # Compiled output (from tsc)
├── package.json
├── tsconfig.json
└── README.md
```

**How to follow:**

| What you add | Where to put it |
|--------------|------------------|
| New models / enums | `prisma/prisma/schema.prisma` – **always** add `@@schema("customer")` to each model |
| Migrations | Created by Prisma in `prisma/prisma/migrations/` when you run `pnpm prisma:migrate:dev` |
| Custom DB helpers | `prisma/src/` and re-export from `prisma/src/index.ts` if needed |

- Do **not** put app/API code in the prisma package. It is a **shared DB client** used by Backend (and later mobile).
- Never add a model without `@@schema("customer")` (see `.cursor/rules/prisma-isolation.mdc` and `prisma/README.md`).

---

## Root scripts

From repo root:

| Command | What it does |
|---------|----------------|
| `pnpm install` | Install deps for all workspace packages |
| `pnpm dev` | Run `dev` in every package (e.g. Backend + any other with dev script) |
| `pnpm build` | Run `build` in every package (with dependency order) |
| `pnpm lint` | Run `lint` in every package |
| `pnpm format` | Prettier-format `**/*.{ts,tsx,md}` |

---

## MobileApp (React Native / Expo)

```
MobileApp/
├── app/                    # Expo Router: file-based routes and layouts
│   ├── _layout.tsx
│   ├── (tabs)/
│   └── ...
├── components/
├── constants/
├── assets/
├── app.json
├── package.json            # @repo/mobile-app; scripts: dev, build, lint
└── README.md
```

- **Run**: From root `pnpm dev` or from `MobileApp/`: `pnpm start`, `pnpm ios`, `pnpm android`, `pnpm web`.
- **Stack**: Expo ~54, Expo Router, React Native, TypeScript.

---

## Adding a new package

1. Create a new folder at root (e.g. `web/` or `MobileApp/`).
2. Add it to `pnpm-workspace.yaml`: `packages: [ "Backend", "prisma", "MobileApp", "web" ]`.
3. Put a `package.json` with a `name` and scripts (`build`, `dev`, `lint` as needed).
4. Turbo will pick it up for `pnpm dev` / `pnpm build` / `pnpm lint`.

---

## Summary

- **Backend**: Modular layout under `src/` – config, modules (controller/service/routes/types), middlewares, utils, and a single `routes.ts` to mount under `/api`.
- **Prisma**: Only schema and DB client; all models in `customer` schema; no app logic here.
- **MobileApp**: React Native (Expo) app with Expo Router; run via `pnpm start` in MobileApp or `pnpm dev` from root.
- **Root**: Monorepo config and scripts only.
- **New packages**: New folder + entry in `pnpm-workspace.yaml`.

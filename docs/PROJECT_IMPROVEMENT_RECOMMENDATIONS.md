# Project Improvement Recommendations (Gupio)

Recommendations for betterment of your project **beyond** the AI agent roadmap. Based on a scan of your Backend, Mobile, and repo structure. Ordered by impact and effort.

---

## 1. Testing

**Current state:** One Mobile test (`App.test.tsx`); no Backend tests.

| Recommendation | Why | How |
|----------------|-----|-----|
| **Backend: API integration tests** | Catch regressions on auth, expense create/parse, chat. | Add **Jest** (or Vitest) + **supertest**. One test file per module (e.g. `expense.routes.test.ts`) that hits real routes with a test DB or Prisma mock. Start with: `POST /api/v1/auth/otp`, `POST /api/v1/expenses`, `POST /api/v1/chat`. |
| **Backend: Unit tests for services** | Safe refactors; document behavior. | Test `ocrService.parseExpenseNotification` with fixed strings, `expenseIntelligenceService.isDuplicate`, and `vectorService.searchSimilar` with a test DB. |
| **Mobile: Expand tests** | Avoid UI/flow regressions. | Add tests for critical flows: AddExpense (manual submit), ExpenseList (empty vs list), navigation. Use React Native Testing Library (you already have Jest). |
| **E2E (optional later)** | Validate full stack. | Detox (React Native) or Maestro; or Playwright for a future web app. |

**Quick win:** Add `jest` + `supertest` + `ts-jest` to Backend, one integration test for `GET /health` and one for `POST /api/v1/chat` with a mocked Gemini response.

---

## 2. DevOps & Deployment

**Current state:** No Dockerfile; no GitHub Actions (or other CI).

| Recommendation | Why | How |
|----------------|-----|-----|
| **Dockerfile for Backend** | Same environment everywhere; easy deploy to Cloud Run, ECS, etc. | Multi-stage: `node` base → `pnpm install --frozen-lockfile` → `pnpm build` → run `node dist/server.js`. Expose `PORT`; use `ENV NODE_ENV=production`. |
| **CI pipeline** | Catch breaks before merge. | `.github/workflows/ci.yml`: on push/PR run `pnpm install`, `pnpm lint`, `pnpm build`, Backend tests (when you add them). Optional: Mobile `pnpm lint` and `jest`. |
| **CD (after CI)** | Deploy on merge to main. | Same workflow or a separate one: build Docker image, push to registry, deploy to your cloud (e.g. Cloud Run, ECS). Use env secrets from GitHub or cloud secrets manager. |
| **Health in CI** | Ensure app starts. | In CI, start Backend in background and `curl /health` (or use a smoke test script). |

**Quick win:** Add a minimal Dockerfile for Backend and a CI workflow that runs lint + build. No tests required initially.

---

## 3. Observability & Errors

**Current state:** Pino logger; Mobile has Sentry package but minimal config; Backend has no Sentry.

| Recommendation | Why | How |
|----------------|-----|-----|
| **Request ID** | Trace a request across logs and support. | Middleware: `req.id = req.headers['x-request-id'] || crypto.randomUUID()`; add `req.id` to every log line and response header `X-Request-Id`. |
| **Backend error reporting** | See production errors with stack and context. | Add **Sentry for Node** (`@sentry/node`). In `errorMiddleware`, call `Sentry.captureException(err)` and set user to `req.customer?.id`. Run `Sentry.init()` in `server.ts`. |
| **Mobile Sentry** | Real crash and error reports. | Finish `Mobile/src/lib/sentry.ts`: `Sentry.init({ dsn: '...' })`, wrap app in `Sentry.wrap()`, and call `Sentry.captureException` in error boundaries and API error handlers. |
| **Structured logs** | Easier search and alerting. | You already use Pino; ensure important fields (e.g. `customerId`, `sessionId`, `tool`, `expenseId`) are always in the log object. |

**Quick win:** Add request ID middleware and Backend Sentry with `captureException` in the error middleware.

---

## 4. Security

**Current state:** Env validated with Zod; Helmet; rate limit; JWT.

| Recommendation | Why | How |
|----------------|-----|-----|
| **Strict CORS in production** | Avoid unknown origins calling your API. | In production, set `CORS_ORIGIN` to your app’s exact origins (e.g. `https://app.gupio.com`, mobile deep link scheme). No `*` in prod. |
| **Secrets not in code** | Avoid leaking keys. | Keep using `.env` and never commit it. In production, use cloud secret manager (e.g. AWS Secrets Manager, GCP Secret Manager) and inject into the process. |
| **JWT in production** | Default `JWT_SECRET` is unsafe. | Fail fast if `NODE_ENV=production` and `JWT_SECRET` is missing or equals `dev-secret-change-in-production`. Add this check in `env.ts`. |
| **Audit sensitive actions** | Compliance and debugging. | Log (or write to an audit table) login, document upload, expense delete, and AI tool calls with `customerId` and timestamp. |

**Quick win:** Add a check in `env.ts`: in production, require a strong `JWT_SECRET` and a non-wildcard `CORS_ORIGIN`.

---

## 5. API & Data

| Recommendation | Why | How |
|----------------|-----|-----|
| **Pagination consistency** | Predictable list APIs. | Use a standard shape: `{ data: [], meta: { page, limit, total } }` for list endpoints (expenses, notifications, chat sessions). Document in Swagger. |
| **API versioning** | You already have `/api/v1`. Keep it. | When you introduce breaking changes, add `v2` and deprecate `v1` with headers or docs. |
| **DB indexes** | Faster queries. | Ensure indexes on: `Expense(customerId, date)`, `DocumentEmbedding(customerId)`, `ChatMessage(sessionId)`, `InAppNotification(customerId, createdAt)`. Check with Prisma or raw SQL. |
| **Idempotency for critical writes** | Avoid duplicate expenses from retries. | For `POST /api/v1/expenses` (and parse), accept optional `Idempotency-Key` header; store key + result; on replay return same result. |

**Quick win:** Review Prisma schema and add indexes for the most-used list filters (customerId + date, customerId + createdAt).

---

## 6. Mobile

**Current state:** React Native, Sentry package, FlashList, MMKV, Firebase (analytics/perf).

| Recommendation | Why | How |
|----------------|-----|-----|
| **Error boundary** | Graceful failure instead of white screen. | Wrap the app (or main navigator) in an error boundary that logs to Sentry and shows a “Something went wrong” screen with a “Retry” button. |
| **Offline / weak network** | Better UX when network fails. | For list screens, cache last response (e.g. in MMKV or React Query cache) and show it when offline; show a banner “You’re offline.” On submit, queue or show “Retry when online.” |
| **Deep linking** | Open app to a specific screen from notification or link. | Configure React Navigation deep links (e.g. `gupio://expense/123`, `gupio://notifications`). Use notification `link` from your backend. |
| **Sentry breadcrumbs** | Understand steps before a crash. | Add breadcrumbs for: screen focus, API request start/success/fail, button taps (e.g. “Add expense”, “Send chat”). |

**Quick win:** Add one global error boundary that shows a friendly message and calls `Sentry.captureException`.

---

## 7. Developer Experience

| Recommendation | Why | How |
|----------------|-----|-----|
| **Root README** | New devs onboard faster. | Expand `README.md`: project overview, how to run (Backend, Mobile, DB, Redis), env vars (point to `.env.example`), main scripts, link to `docs/`. |
| **.env.example** | Document required and optional env. | Backend: list every variable with a placeholder and one-line comment. Mobile: same for API base URL and feature flags if any. |
| **Pre-commit hooks** | Enforce lint/format before commit. | **Husky** + **lint-staged**: on commit run `pnpm lint` and `prettier --write` on staged files. |
| **Lint in CI** | Enforce quality. | Run `pnpm lint` (and `pnpm format --check` if you add it) in GitHub Actions. |

**Quick win:** Add a clear Backend `.env.example` and a short “Getting started” in the root README.

---

## 8. Documentation

| Recommendation | Why | How |
|----------------|-----|-----|
| **API docs** | You have Swagger; keep it accurate. | Ensure every route used by Mobile is in Swagger with request/response examples. Add “Requires auth” and error responses. |
| **Architecture overview** | Clarify how pieces fit. | One doc (e.g. `docs/ARCHITECTURE.md`): high-level diagram (text or Mermaid), Backend (Express, queues, workers), Mobile, DB, Redis, external APIs (Gemini, S3, etc.). |
| **Runbook** | Help when things break. | Short `docs/RUNBOOK.md`: how to run migrations, how to restart workers, how to inspect queues (e.g. Bull Board), where logs go, how to turn off AI or a cron. |

**Quick win:** Add `docs/ARCHITECTURE.md` with a Mermaid diagram of Backend → DB, Redis, Gemini, S3 and Mobile → Backend.

---

## 9. Performance (Backend)

| Recommendation | Why | How |
|----------------|-----|-----|
| **Cache hot reads** | Reduce DB load. | For per-user data that changes rarely (e.g. vehicle list, document status), cache in Redis with a short TTL (e.g. 60s) and invalidate on update. |
| **Lazy load heavy deps** | Faster cold start. | If you add more AI or PDF libs, require them only inside the routes that need them (e.g. dynamic `import()` in the expense parse route). |
| **Streaming for chat (optional)** | Perceived latency. | If chat response can be slow, use Gemini streaming and stream SSE to the client; Mobile can show tokens as they arrive. |

**Quick win:** Add Redis cache for `GET /api/v1/vehicles` (key: `vehicles:${customerId}`, TTL 60s); invalidate on vehicle create/update/delete.

---

## 10. Product / UX (short list)

| Idea | Why |
|------|-----|
| **Pull-to-refresh** | On expense list, notifications, chat sessions. |
| **Skeleton loaders** | Replace spinners with skeleton blocks for lists and detail screens. |
| **Haptic feedback** | Light haptic on button press (success, error) for key actions. |
| **App version in settings** | Show build number and API version; helps support. |

---

## Priority summary

| Priority | Focus | Examples |
|----------|--------|----------|
| **P0** | Reliability & security | Request ID, Backend Sentry, production JWT/CORS check, health in CI. |
| **P1** | Shipping confidence | Dockerfile, CI (lint + build), 2–3 Backend integration tests, root README + .env.example. |
| **P2** | Quality of life | Mobile error boundary, pagination consistency, DB indexes, ARCHITECTURE.md. |
| **P3** | Scale & polish | Redis cache for hot lists, offline handling, deep links, runbook. |

You don’t need to do everything at once. Start with P0 and one or two P1 items; then add tests and docs as you iterate.

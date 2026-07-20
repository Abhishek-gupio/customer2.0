# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

pnpm workspace + Turborepo monorepo ("Gupio" — a vehicle health/management app: vehicle profiles, documents/DigiLocker, RC/DL verification, telematics driving scores, fuel/expense tracking, service/warranty tracking, an AI assistant, SOS, sharing, support).

- `Backend/` — Express + TypeScript API (port 9000 by default)
- `Admin/` — React + Vite admin dashboard
- `Mobile/` — React Native 0.83 app
- `prisma/` (package `@repo/db-customer`) — the shared Prisma schema/client, at `prisma/prisma/schema.prisma`

`pnpm-workspace.yaml` also lists `MobileApp` and `Mobile-v2` — these directories don't exist; ignore those entries.

## Commands

```bash
# Install (from repo root)
pnpm install

# Local Postgres (Docker)
pnpm db:up                    # docker compose up -d
pnpm db:setup                 # db:up + migrate

# Prisma (operates on prisma/prisma/schema.prisma)
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:studio

# Backend (cd Backend/)
pnpm dev                      # nodemon src/server.ts, port from env.PORT (9000 by default)
pnpm build                    # tsc
pnpm lint                     # tsc --noEmit — this is a typecheck, NOT eslint; there is no lint rule config for Backend
# No test runner is configured for Backend — there are no automated tests here.

# Admin (cd Admin/, or `pnpm admin:dev` / `pnpm admin:build` from root)
pnpm dev                      # vite
pnpm lint                     # eslint .

# Mobile (cd Mobile/)
pnpm start                    # react-native start (Metro)
pnpm android / pnpm ios
pnpm lint                     # eslint .
pnpm test                     # jest (minimal coverage)
```

Typecheck a single Backend or Mobile file directly with `npx tsc --noEmit` from that package's directory — this is the fastest way to verify a change compiles; there's no per-file lint/test command otherwise.

If `EADDRINUSE: 0.0.0.0:9000` happens on restart: a previous `node` process is still holding the port. `lsof -nP -iTCP:9000 -sTCP:LISTEN` then `kill <pid>`. Graceful shutdown in `Backend/src/server.ts` closes Socket.IO explicitly before `httpServer.close()` for this reason — if it still hangs, an open WebSocket connection is the usual cause.

## Database — shared with another project, hard constraint

The Postgres database is **shared with an unrelated "valet" product** (see `.cursor/rules/prisma-isolation.mdc`). The Prisma schema has two datasource schemas: `customer` (this app) and `public` (the other app, ~40 unrelated models: `Client`, `Site`, `Pickup`, `Invoice`, etc.).

- Every model in `prisma/prisma/schema.prisma` **must** end with `@@schema("customer")`. Never add a model to `public` or omit the schema annotation.
- Never run raw SQL, migrations, or tooling against `public` or the other project's tables from this repo.
- The migration history is not fully trustworthy as a from-scratch source of truth — some of the baseline schema was applied outside `prisma migrate` (evidence: no `CREATE TABLE` for core models like `Customer`/`CustomerVehicle` in migration history, and `prisma/fix_enums.sql` shows past manual SQL patches). Don't assume `prisma migrate deploy` alone can rebuild the DB from zero.

## Backend architecture

Express app (`src/app.ts`) → `src/routes.ts` mounts one router per module under `src/modules/*` (auth, customer, vehicle, telematics, expense, fuel, trip-expense, document, chat, ai, sos, places, discovery, support, diy, admin, agent). Cross-module business logic lives in `src/services/*` (32 files: telematics, OCR, RC/DL verification, challans, warranty, notifications, storage/S3, weather, fuel-price, oem-scraper, etc.) — modules call into services, not into each other's internals.

Auth: OTP (SMS) + JWT for customers, email/bcrypt + JWT for admins (`src/modules/auth`, `src/modules/admin`). `authMiddleware` sets `req.customer`; admin routes use a separate `adminAuthMiddleware`. Redis-backed with an in-memory fallback when Redis is unavailable (`src/config/redis.ts`, `otpStore.ts`) — the fallback is per-process, so it isn't correct across multiple instances.

Background jobs run in the same process as the API (not a separate worker deployment): BullMQ (`src/jobs/workers.ts`, `src/services/scheduler.service.ts`) for the "safe under horizontal scaling" jobs (fixed job IDs, Redis-deduped), and `node-cron` (`notification.service.ts`'s `initCronJobs`) for a few notification jobs that are **not** dedup-safe across multiple instances.

### AI agent pipeline (`src/agent/`)

This is the newest, most structurally important part of the backend and spans many small files — read this before touching anything AI/voice/chat related.

Every request to `POST /v1/agent/message` (or `/message/stream` for SSE) goes through one pipeline in `src/agent/runtime.ts`:

1. **Pending workflow check** — if `agentMemoryStore` (Redis, `src/agent/memory.store.ts`) has an in-progress flow for this session, continue it — unless the new message is an explicit cancel phrase or clearly matches a *different* flow's own trigger, in which case the stale flow is abandoned instead of being force-fed the new message.
2. **Cheap keyword gate** — each `Flow` (`src/agent/flows/*.flow.ts`) has a `matches()` regex checked before any LLM call.
3. **Planner** (`src/agent/planner.ts`) — an LLM call that classifies intent into a known flow, a hand-curated direct-dispatch tool, or "chat", for messages the keyword gate misses (e.g. "I have some money saved for a trip" → `plan_trip`, despite no literal keyword match).
4. **Execution Engine** (`src/agent/executionEngine.ts`) — dispatches flow turns and direct tool calls. "Chat" (anything not resolved above) falls through to the pre-existing `ai.service.ts` (`aiService.chat`/`chatStream`) — the full RAG + Gemini/Groq tool-calling pipeline, unchanged and still the path for anything needing extracted arguments (amounts, categories, images) that the direct-dispatch allowlist deliberately excludes.

The agent **never navigates or mutates UI directly** — it only returns `UIEvent`s (`open_view`, `update_state`, `ask_user`, etc., defined in `src/agent/types.ts`). `src/agent/events.ts` is the one place that maps flow/tool results to events, including the tool→screen mapping for direct-dispatched tools (kept in sync by hand with the older chip-based mapping in `ai.service.ts`'s `buildNavigationActionsFromToolResults`, which still serves the general-chat path's `suggestedActions`).

Adding a new flow: create `src/agent/flows/<name>.flow.ts` implementing `Flow` (see existing ones for the pattern — `matches`, `slots`, `extract`, `commit`), add it to `src/agent/flows/index.ts`. A flow's `commit` returns plain data plus an optional `viewOverride` — it must never construct a `UIEvent` itself; the engine does that uniformly.

Adding a tool to direct-dispatch: only add it to `DIRECT_DISPATCH_TOOL_NAMES` in `runtime.ts` if it is read-only **and** every parameter is optional (no argument-extraction risk when called with `{}`). This is a hand-curated allowlist, not an automatic filter — e.g. `sync_challans` has all-optional params but is deliberately excluded because it hits a paid third-party API and should only fire on explicit user intent.

### Model routing — cost-driven, deliberately not automatic-fallback

`src/agent/modelRouter.ts` pins each AI capability to exactly one provider with **no cross-provider fallback**: `text` → Groq only, `vision` → Gemini only, `embedding` → Gemini only. If the assigned provider isn't configured, it throws rather than silently switching providers — this is intentional (cost predictability was prioritized over uptime), not a bug. The planner and every flow's `extract()` go through this router.

This is separate from `src/services/ai-provider.service.ts`'s `callAI()`, which still does Groq→Gemini fallback and is used only by `ai.service.ts`'s general-chat path (which also owns all Gemini-only capabilities that have no Groq equivalent in this codebase: tool-calling with function declarations, image/vision input, and RAG embeddings — `vector.service.ts`'s `gemini-embedding-001` calls, since Groq has no embeddings API at all).

## Mobile architecture (`Mobile/`)

State is split across three systems, not one:
- **Redux Toolkit** (`src/store/`) — only 2 real slices (`authSlice`, `documentsSlice`); several other slice/context files exist but are stub placeholders (`export {};`).
- **Zustand** — small, targeted cross-screen signal stores: `store/expenseStore.ts` (a version counter screens subscribe to after an expense is created/edited) and `agent/stateStore.ts` (keyed draft state per agent flow, e.g. `trip-plan`).
- **`agent/` directory** — the mobile half of the AI agent pipeline: `agentClient.ts` (the only client entrypoint to `/v1/agent/message[/stream]`), `eventBus.ts` (pub/sub for `UIEvent`s), `eventHandlers.ts` (default handling: `open_view` navigates only if that screen isn't already focused; `update_state` patches `stateStore`). `navigation/navigationRef.ts` holds a module-level nav ref (`createNavigationContainerRef`) specifically so this non-component code can navigate without a `useNavigation()` hook.

Two entry points call into the agent: `components/HeyGupioOverlay.tsx` (the floating voice assistant, always mounted) and `screens/Main/AIAssistant.tsx` (the full chat screen). Both run local, GPS-dependent checks (`tryResolveLocalEmergencyAlert`, `tryResolveLocalNearbyPlaces` in `services/chatService.ts`) before calling the agent, because SOS/nearby-places need live device location that the server-side agent has no channel for. **Always send the raw transcript/message to the agent** — do not wrap it in an instructional prompt first; a prior bug came from exactly this (a "speak naturally, no JSON" wrapper prepended client-side ended up fighting a flow's own "output JSON" extraction instruction).

## Admin architecture (`Admin/`)

Simpler: no Redux, a single `AuthContext` plus per-page local state, one typed API client (`src/api/client.ts`) with in-flight GET de-duplication. JWT stored in `localStorage` (not httpOnly) — be careful introducing any new way to render user-controlled content (the customer-detail view already renders uploaded documents in an `<iframe src={doc.fileUrl}>`, so any XSS there is a direct path to token theft).

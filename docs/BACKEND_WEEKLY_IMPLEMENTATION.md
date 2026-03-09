# Backend Implementation – Week-wise Plan

This document is a week-wise view of the Gupio Customer App backend implementation. For full detail (daily deliverables, schema, dependencies, checklists, risks), see **[GUPIO_BACKEND_PLAN.md](GUPIO_BACKEND_PLAN.md)**.

---

## Purpose

- Summarize the full backend in a compact, week-by-week structure.
- Integrate **Signup** explicitly into Week 1 (Auth) and the API list.
- Provide a quick reference and optional week-wise checklist.

---

## High-level Summary

| Item | Detail |
|------|--------|
| **Stack** | Node.js 18+, Express 5.1, TypeScript 5.3, Prisma 6.16, PostgreSQL, Redis, BullMQ, Socket.IO, OpenAI, AWS/Cloudinary |
| **Scope** | 200+ backend files, 30+ Prisma models, 120+ API endpoints |
| **Timeline** | 4 weeks (28 days) |
| **Folder structure** | `apps/api/src/` with `config/`, `controllers/`, `services/`, `routes/v1/`, `middlewares/`, `validators/`, `jobs/`, `integrations/`, `utils/`, `types/`, `tests/` — see [GUPIO_BACKEND_PLAN.md](GUPIO_BACKEND_PLAN.md) for full tree |

**Main milestones**

- **Week 1:** Foundation, DB, Auth (including Signup), routing, Redis, logging, file upload, testing setup
- **Week 2:** Vehicle, document, expense APIs (CRUD, health score, DigiLocker, parser, budgets)
- **Week 3:** AI assistant, valet tracking, RTO, SOS, analytics
- **Week 4:** Performance, queues, full testing, security, docs, go-live

---

## Signup Design (Option A – Explicit Signup)

**Placement:** Week 1, same day as “Authentication & Authorization”.

- **POST /api/v1/auth/signup**
  - Body: `phoneNumber` (required), optional `email`, `fullName`.
  - Validate phone format; ensure phone not already registered; create Customer (minimal fields); trigger “send OTP” (same as login); return `{ message, requiresOtpVerification: true }`.
  - No JWT until OTP is verified.
- **POST /api/v1/auth/send-otp** (or keep as part of login)
  - Used by both login and signup; idempotent for same phone within rate limit.
- **POST /api/v1/auth/verify-otp** (existing, extend as needed)
  - Accept `phoneNumber` + `otp`. If customer exists → login (return tokens). If not (e.g. signup abandoned and retried) → either create customer then login or return error; keep behavior consistent with signup flow.

**Artifacts**

- Endpoint: `POST /api/v1/auth/signup`
- Validators: signup body (phone, optional email, fullName); reuse OTP validators
- Controller: `authController.signup` (or `customerAuthController.signup`)
- Service: e.g. `authService.signup` → create Customer, call OTP send, return `requiresOtpVerification`

---

## Week 1: Foundation & Infrastructure

- **DB & schema:** Design 30+ Prisma models, migrations, dev DB, seed data (see [GUPIO_BACKEND_PLAN.md](GUPIO_BACKEND_PLAN.md) schema section).
- **Auth & Signup:** Customer auth service; OTP login; **Signup:** POST /auth/signup, validators, auth service + controller; JWT and refresh; auth middleware, RBAC, API key auth, webhook verification, rate limiting.
- **API architecture:** Base controller/service, standardized responses, error hierarchy; route modules (customer, vehicle, document, expense, AI, etc.); Swagger/OpenAPI and Postman.
- **Redis & queues:** Redis config, cache wrapper, session cache; BullMQ, job processors, retry logic, Bull Board.
- **Logging & monitoring:** Winston, structured logs; Prometheus, health checks, APM, Sentry.
- **File upload & storage:** Multer, validation, size/type limits; AWS S3/Cloudinary, signed URLs, image optimization.
- **Testing:** Jest, Supertest, fixtures, integration examples.

**Week 1 deliverable:** Schema and migrations; Auth (login + send-otp + verify-otp + **signup** + refresh + logout); middleware and routing; Redis and queues; logging and monitoring; file pipeline; testing framework ready.

---

## Week 2: Vehicle, Document & Expense APIs

- **Vehicle:** CRUD, validation, duplicate check, registration verification, Parivahan/RC verification; health score algorithm, recommendations, maintenance part tracking, schedule calculator, overdue detection.
- **Documents:** Upload, type validation, storage, thumbnails; Tesseract OCR, field extraction (RC/Insurance/PUC/DL); verification, duplicate detection.
- **DigiLocker:** OAuth 2.0, token storage, document list/fetch/sync, smart reminders.
- **Expense:** CRUD, filters, auto-categorization, merchant matching; NLP parser (voice/notification); budget management, tracking, alerts.
- **Maintenance reminders:** Date/km scheduling, notification queue; service history API, cost tracking, smart reminders.

**Week 2 deliverable:** Vehicle CRUD and health; document upload, OCR, DigiLocker; expense CRUD, parser, budgets; maintenance scheduler and service history.

---

## Week 3: AI Assistant & Advanced Features

- **AI assistant:** OpenAI integration, chat completion, streaming; vector DB (Pinecone/pgvector), embeddings, semantic search; session management, context loading, function calling, intent/entity handling.
- **Voice & multilingual:** Speech-to-text, text-to-speech, language detection, translation.
- **Valet tracking:** WebSocket rooms, location updates, Google Maps ETA, traffic-aware routing, ratings, notifications.
- **RTO:** Service types, requirements, document checklist, fee calculation; request lifecycle, form validation, document upload; Razorpay, webhooks, e-sign.
- **SOS & emergency:** SOS creation, location capture, nearby help (Google Places), emergency contacts, resolution flow.
- **Analytics:** Aggregation jobs, rollups, pattern/anomaly detection, analytics API, dashboard data, exports.

**Week 3 deliverable:** AI chat and context; voice and multilingual; real-time valet; RTO API; SOS and nearby help; analytics engine.

---

## Week 4: Optimization & Production

- **Performance:** Query optimization, indexes, N+1 fixes; compression, caching, CDN; connection tuning; load testing (Artillery/k6).
- **Background jobs:** All job processors (maintenance, document, expense, budget, health, RTO, analytics); cron, retry, dead letter, monitoring.
- **Testing:** Integration and E2E for major flows, contract/schema validation.
- **Security:** OWASP-style audit, auth/data review, headers, signature verification, pen testing.
- **Documentation & DevOps:** Swagger, runbooks, CI/CD, deployment and rollback procedures.
- **Go-live:** Staging validation, production setup, migrations, health checks, rollback plan.

**Week 4 deliverable:** Production-ready API, performance targets met, tests and security sign-off, docs and CI/CD in place.

---

## API Endpoints (Condensed)

### Authentication (9 endpoints)

```
POST   /api/v1/auth/signup              # Register; send OTP (no JWT until verify-otp)
POST   /api/v1/auth/login               # Customer login (OTP)
POST   /api/v1/auth/send-otp            # Send OTP (login/signup)
POST   /api/v1/auth/verify-otp          # Verify OTP; issue tokens
POST   /api/v1/auth/refresh             # Refresh access token
POST   /api/v1/auth/logout              # Logout & invalidate token
GET    /api/v1/customer/profile         # Get customer profile
PUT    /api/v1/customer/profile         # Update profile
POST   /api/v1/customer/device          # Register device for notifications
```

### Other areas (reference)

- **Vehicles:** CRUD, health, maintenance, service history, verify-rc (see [GUPIO_BACKEND_PLAN.md](GUPIO_BACKEND_PLAN.md)).
- **Documents:** Upload, list, get, update, delete, download; DigiLocker connect/callback/sync/disconnect; expiring.
- **Expenses:** CRUD, parse, summary, analytics, budgets, categories.
- **RTO:** Services, requests, submit, documents, payment, status.
- **AI:** Chat, sessions, voice, suggestions, feedback.
- **Valet:** Active, history, job details, location, ETA, rating, feedback, invoice.
- **SOS:** Create, get, resolve, nearby-help; emergency contacts.
- **Notifications:** List, read, delete; reminders snooze/dismiss; preferences.
- **Analytics:** Dashboard, expenses, driving, vehicle, insights.
- **Webhooks:** Payment, DigiLocker, Parivahan, notifications.
- **Health:** `/api/health`, `/api/health/detailed`, `/api/metrics`.

**Total:** 120+ endpoints (full list in [GUPIO_BACKEND_PLAN.md](GUPIO_BACKEND_PLAN.md)).

---

## Week-wise Checklist

- [ ] **Week 1:** DB schema and migrations done; Auth (login + send-otp + verify-otp + **signup** + refresh + logout) done; middleware and routing base done; Redis and queues done; logging and monitoring done; file upload and storage done; testing infrastructure in place.
- [ ] **Week 2:** Vehicle CRUD and health done; document upload, OCR, DigiLocker done; expense CRUD, parser, budgets done; maintenance reminders and service history done.
- [ ] **Week 3:** AI assistant (OpenAI, vectors, sessions) done; valet tracking done; RTO API done; SOS and nearby help done; analytics and insights done.
- [ ] **Week 4:** Performance and caching tuned; all background jobs and queues running; integration/E2E and security audit done; docs and CI/CD done; go-live checklist and rollback plan ready.

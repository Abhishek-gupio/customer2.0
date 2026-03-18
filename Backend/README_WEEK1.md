# Week 1 – Auth & Customer API

## Overview

- **Auth:** Signup, send OTP, verify OTP, login, refresh, logout.
- **Customer:** Profile (GET/PUT), device registration (POST).
- **Infra:** JWT (access + refresh), Redis (OTP + refresh blacklist, optional), Prisma Customer/CustomerDevice.

## Environment

Optional for local dev:

- `REDIS_URL` – if unset, OTP and refresh blacklist use in-memory fallback.
- `JWT_SECRET` – default dev secret; set in production.
- `JWT_ACCESS_EXPIRY` – default `15m`.
- `JWT_REFRESH_EXPIRY` – default `30d`.
- `OTP_EXPIRY_SEC` – default 300.
- `OTP_RATE_LIMIT_WINDOW_SEC` – default 60 (one OTP per phone per minute).

## API (base: `/api`)

### Auth (no token)

- `POST /api/v1/auth/signup` – Body: `{ phoneNumber, email?, fullName? }`. Creates customer, sends OTP. Response: `{ success, data: { message, requiresOtpVerification: true } }`.
- `POST /api/v1/auth/send-otp` – Body: `{ phoneNumber }`. Sends OTP (login or resend).
- `POST /api/v1/auth/verify-otp` – Body: `{ phoneNumber, otp }`. Returns `accessToken`, `refreshToken`, `expiresIn`.
- `POST /api/v1/auth/login` – Body: `{ phoneNumber }`. Same as send-otp (sends OTP).
- `POST /api/v1/auth/refresh` – Body: `{ refreshToken }` or header `x-refresh-token`. Returns new tokens.
- `POST /api/v1/auth/logout` – Body: `{ refreshToken }` or header. Blacklists refresh token.

### Customer (Bearer token required)

- `GET /api/v1/customer/profile` – Current customer profile.
- `PUT /api/v1/customer/profile` – Body: `{ email?, fullName?, profilePic? }`.
- `POST /api/v1/customer/device` – Body: `{ platform: "ios"|"android", deviceToken?, deviceInfo? }`.

### Health

- `GET /health` – `{ ok, timestamp, env }`.
- `GET /health/detailed` – `{ ok, timestamp, env, services: { database, redis } }`.

## Database

From repo root, run migrations (when DB is configured):

```bash
pnpm --filter @repo/db-customer prisma:migrate:dev
```

## Module layout

- `src/modules/auth/` – auth.types, auth.validators, auth.service, auth.controller, auth.routes, jwt, otpStore.
- `src/modules/customer/` – customer.types, customer.validators, customer.service, customer.controller, customer.routes.
- `src/config/` – env, logger, redis.
- `src/utils/` – AppError, apiResponse, asyncHandler.
- `src/middlewares/` – auth.middleware (JWT), error.middleware (AppError).

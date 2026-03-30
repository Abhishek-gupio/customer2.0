# Backend rate limits

This doc explains where rate limits apply and how to avoid or fix "rate limit" / "again rate limit" issues.

---

## 1. Global API rate limit (express-rate-limit)

- **Where:** All routes except `/health`, `/health/detailed`, and **`/api-docs`** (Swagger UI + spec).
- **Rule:** `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS` **per user or per IP**:
  - **Authenticated requests** (valid `Authorization: Bearer <token>`): limit is **per user** (customer or admin ID from JWT). Each user has their own quota.
  - **Unauthenticated requests** (login, send OTP, etc.): limit is **per IP**.
- **Env:** `RATE_LIMIT_MAX` (default 300), `RATE_LIMIT_WINDOW_MS` (default 900000 = 15 min).
- **Response:** HTTP 429 when exceeded.

**Why the "full system" seemed to stop after using API docs:**

- Browsing https://customerapi.gupio.tech/api-docs/ loads the page and spec; each "Try it out" sends a request to `/api/v1/...`. All of these used to count. With strict settings (for example 100/15 min), **every** request from that IP got 429, so the API looked completely down for that user.
- **Now:** Loading `/api-docs` and `/api-docs.json` is **skipped** so the docs page doesn’t burn the limit. Health checks are also skipped. Default is 300/15 min, and you can tune both max and window.

**What to do:**

- Set `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` in production based on traffic (example: `100` + `60000` for 100/minute). Requests from Swagger "Try it out" still count toward the limit; only the docs page/spec load is excluded.

---

## 2. OTP rate limit

- **Where:** Send OTP (auth) – one OTP per phone per time window.
- **Rule:** 1 OTP per phone per `OTP_RATE_LIMIT_WINDOW_SEC` (default: 60 seconds).
- **Env:** `OTP_RATE_LIMIT_WINDOW_SEC` (default 60).
- **Storage:** Redis or in-memory fallback (per process).
- **Response:** Service returns "rate limited"; client should show "Wait before requesting another OTP".

**Why it might trigger "again":**

- User or client retrying OTP request too soon (e.g. multiple taps, or retry logic without delay).

**What to do:**

- In the app, disable "Resend OTP" for 60 seconds after sending.
- Optionally increase `OTP_RATE_LIMIT_WINDOW_SEC` if product allows.

---

## 3. Damoov (telematics) rate limit

- **Where:** `telematics.service.ts` – Damoov Admin API login and trip fetch.
- **Rule:** External API returns 429; we then **skip login for 2 hours** and skip that sync run.
- **Constants:** `RATE_LIMIT_BACKOFF_MS = 2 * 60 * 60 * 1000`, admin token cached 50 min to reduce logins.

**Why it might trigger "again":**

- Hourly sync job (`sync-telematics`) runs for all devices; many devices or frequent runs can hit Damoov’s limits.
- Manual "sync now" during backoff still skips (unless `forceLogin: true`).

**What to do:**

- Rely on the 2-hour backoff; next run after that will try again.
- For immediate sync, use `scripts/sync-telematics-now.ts` with care (it can pass `forceLogin`).
- Avoid running multiple backend instances all doing telematics sync at the same time.

---

## 4. Gemini (Google AI) rate limit

- **Where:** Any call to Gemini: chat (AI service), voice/expense parsing (OCR service), expense service (bill parsing, notifications), vector/embedding, proactive chat, etc.
- **Rule:** Google returns 429 or "resource exhausted" / "quota exceeded"; we detect it and return **429** with a clear message instead of 500.

**Why it might trigger "again":**

- High usage of chat, voice expense, or other Gemini features.
- Free-tier or low quota (RPM/RPD) on the Gemini API key.

**What to do:**

- **Backend:** We now detect Gemini rate-limit errors and respond with HTTP 429 and `code: "GEMINI_RATE_LIMIT"` and message like "AI is busy. Please try again in a moment." so the app can show a retry message instead of a generic error.
- **Product:** In the app, show "AI is busy, try again in a moment" and optionally retry with backoff.
- **Infra:** Increase Gemini quota in Google Cloud (AI Studio / Vertex) or use a key with higher limits.

---

## Summary

| Source        | Config / env              | Skip / reduce triggers                          |
|---------------|---------------------------|--------------------------------------------------|
| Global API    | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` (default 300 / 900000ms) | Per **user** (when Bearer token) or per **IP** (when no token); health + `/api-docs` skipped |
| OTP           | `OTP_RATE_LIMIT_WINDOW_SEC` | Throttle "Resend OTP" in UI                    |
| Damoov        | Backoff 2 h after 429     | Single hourly job; avoid duplicate syncs        |
| Gemini        | Google quota              | 429 returned with clear message; increase quota |

If you see "rate limit" or "again rate limit" in logs or client:

1. Check whether it’s **429** and the `error.code` (e.g. `RATE_LIMIT`, `GEMINI_RATE_LIMIT`).
2. For **global:** increase `RATE_LIMIT_MAX` or reduce request rate per IP.
3. For **OTP:** respect the 1-OTP-per-window in the client.
4. For **Damoov:** wait for backoff or reduce sync frequency.
5. For **Gemini:** show "try again later" and/or increase API quota.

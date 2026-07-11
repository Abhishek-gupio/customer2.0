# Parking (Locate + Booking) & Customer Payments — Architecture Plan

Phase 1 features #1 and #2 from `gupio-phase1-plan.md`, combined into one build plan. Neither feature is usable alone: Parking booking has no way to charge a customer today, and Payments has nothing to charge for until Parking exists. This doc treats them as one 135-hour build, sequenced so Payments' core lands first — the reverse of the backlog's own ordering.

Grounded in the actual current state of the codebase (verified by direct investigation, not assumption) as of this writing.

## 1. Why these ship as one plan

- A parking booking that can't be paid for isn't a booking — it's a hold with no way to confirm it. `ParkingBooking`'s first lifecycle transition is `PENDING_PAYMENT → CONFIRMED`, which requires a working payment gateway to exist.
- Confirmed by codebase search: **there is no Razorpay SDK, no payment env vars, and no payment controller/service anywhere in `Backend/src`.** The only "Payment" code that exists is a set of Prisma models under the `public` schema (`Payment`, `Invoice`, `RazorpayOrder`, `Refund`) that belong to the unrelated B2B valet product and are off-limits per `CLAUDE.md`'s hard database-isolation rule.
- Payments is deliberately built **generic** from day one (a `purpose` field, not a `parkingBookingId` field) because the backlog names two more future consumers — Accessories Marketplace and Rental Marketplace — that will check out through the same gateway. Building it parking-specific now means rebuilding it twice.

**Decision:** build Payments' core (schema, order creation, webhook) *before* Parking's booking-create endpoint, even though the backlog orders them the other way. See §12.

## 2. Scope & user stories

### In scope
- Customer searches parking **near a destination** (not just current GPS) and sees dealer-listed spots with real hourly/daily pricing.
- Customer books a time window, pays via Razorpay in-app, gets a confirmation.
- Sold-out listings surface at the top of results with a "Notify me" waitlist action instead of disappearing.
- Customer cancels a booking within policy and is refunded automatically.
- A dealer (parking-lot operator) can list a lot, set capacity/pricing, and see their bookings.
- Payments: order creation, Razorpay checkout, webhook-verified confirmation, refunds, receipts — built generic enough for reuse.

### Explicitly out
- Physical bay-level IoT/sensor occupancy detection — availability is dealer-declared capacity per time window, not sensor-verified.
- ANPR-based automatic entry/exit (Phase 2 feature #6, hard-dependent on Phase 4's ANPR service).
- A dedicated dealer-facing mobile app — see §8 for why this is recommended to live in `Admin/` instead.
- Subscription/recurring billing (Razorpay mandates) — this build is one-time order/refund only.

### Representative user stories
- As a customer driving to a mall, I search parking near *the mall*, not my current location, and see dealer lots with live prices.
- As a customer, when my preferred lot is full for my time window, I still see it (top of list) with a "Notify me" button instead of it vanishing.
- As a customer, I pay for a slot in-app and get a push notification the moment payment clears — not just when I tap "Done" on the checkout screen.
- As a dealer, I list my lot once with capacity per hour, and stop taking phone-call bookings.
- As a customer, cancelling more than 1 hour before start time refunds me automatically without a support ticket.

## 3. System overview

Two new Backend modules sit alongside the existing 19. Payments is called **in-process** by Parking (and, later, by other checkout flows) — never over HTTP between modules, matching the existing rule that "modules call into services, not into each other's internals."

```
 MOBILE (React Native)                                   RAZORPAY (external)
 ┌───────────────────────────┐                             ┌───────────────┐
 │ ParkingSearchScreen        │                             │ Orders API     │
 │ ParkingListingDetailScreen │                             │ Checkout SDK   │
 │ Razorpay Checkout (native) │──── native SDK call ───────▶│ Webhooks       │
 │ MyParkingBookingsScreen    │                             └───────┬───────┘
 └──────────────┬─────────────┘                                     │
                │ HTTPS  /v1/*                                       │ webhook POST
                ▼                                                    ▼
 ┌──────────────────────────────────────── Backend (Express) ───────────────────────────┐
 │  modules/parking/            modules/payments/                                        │
 │  ├─ parking.routes.ts        ├─ payments.routes.ts                                     │
 │  ├─ parking.controller.ts    ├─ payments.controller.ts                                 │
 │  ├─ parking.service.ts ──────▶ payments.service.ts  ◀── razorpay.webhook.controller.ts │
 │  ├─ dealer.controller.ts     └─ payments.validators.ts                                 │
 │  └─ parking.validators.ts                                                              │
 │           │                              │                                             │
 │           │        payment-events emitter (in-process pub/sub, new)                    │
 │           └──────────────────────────────┘                                             │
 │                        │                          │                                    │
 │                        ▼                          ▼                                    │
 │        services/notification.service.ts   services/storage.service.ts (listing photos) │
 │        services/places.service.ts (nearby-search pattern reused)                        │
 └──────────────────────────────────────────┬───────────────────────────────────────────┘
                                             ▼
                                Postgres · schema "customer"
                                (ParkingDealer, ParkingListing, ParkingSlotWindow,
                                 ParkingBooking, ParkingWaitlistEntry,
                                 CustomerOrder, CustomerPaymentAttempt, CustomerRefund)
```

**Key architectural call:** Payments never imports Parking's service, and Parking never imports Razorpay directly. The only coupling is a `purpose` string + a "payment succeeded/failed" event — this is what lets Accessories and Rentals reuse Payments later without touching Parking's code (§10).

## 4. Data model (Prisma)

All new models go in `prisma/prisma/schema.prisma` under `@@schema("customer")`, following the existing convention exactly: `id String @id @default(cuid())`, explicit `createdAt`/`updatedAt`, indexes declared before the trailing `@@schema(...)` line.

> **Naming collision to avoid:** the `public` schema already has models named `ParkingSlot` and `Site` (the unrelated B2B valet product). Prisma model names must be unique across the whole schema file regardless of which DB schema they map to — hence `ParkingSlotWindow` and `ParkingListing` below, not `ParkingSlot`/`Site`. Also: those existing tables use `String @id` with **no default** (IDs assigned by the B2B app layer) — don't copy that pattern; new customer-schema models use `cuid()` like every other customer-schema model.

### Payments

```prisma
model CustomerOrder {
  id              String            @id @default(cuid())
  customerId      String
  purpose         PaymentPurpose            // PARKING_BOOKING for now; extend enum later
  referenceId     String                    // e.g. ParkingBooking.id — loose ref, not a hard FK
  amountPaise     Int                       // integer paise, not Float — avoids rounding drift
  currency        String            @default("INR")
  status          OrderStatus       @default(CREATED)
  razorpayOrderId String?           @unique
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  customer        Customer          @relation(fields: [customerId], references: [id], onDelete: Cascade)
  attempts        CustomerPaymentAttempt[]
  refunds         CustomerRefund[]

  @@index([customerId])
  @@index([referenceId])
  @@schema("customer")
}

model CustomerPaymentAttempt {
  id                 String    @id @default(cuid())
  orderId            String
  razorpayPaymentId  String?   @unique
  razorpaySignature  String?
  method             String?
  status             PaymentAttemptStatus @default(INITIATED)
  failureReason      String?
  paidAt             DateTime?
  createdAt          DateTime  @default(now())
  order              CustomerOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@schema("customer")
}

model CustomerRefund {
  id               String   @id @default(cuid())
  orderId          String
  amountPaise      Int
  status           RefundStatus @default(INITIATED)
  razorpayRefundId String?  @unique
  reason           String?
  processedAt      DateTime?
  createdAt        DateTime @default(now())
  order            CustomerOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@schema("customer")
}

model WebhookEvent {                       // idempotency + audit log for inbound Razorpay events
  id             String   @id @default(cuid())
  provider       String   @default("razorpay")
  eventType      String
  payload        Json
  signatureValid Boolean
  processedAt    DateTime?
  createdAt      DateTime @default(now())

  @@index([eventType])
  @@schema("customer")
}

enum PaymentPurpose        { PARKING_BOOKING                                   @@schema("customer") }
enum OrderStatus           { CREATED ATTEMPTED PAID FAILED CANCELLED           @@schema("customer") }
enum PaymentAttemptStatus  { INITIATED SUCCESS FAILED                          @@schema("customer") }
enum RefundStatus          { INITIATED PROCESSED FAILED                       @@schema("customer") }
```

### Parking

```prisma
model ParkingDealer {
  id           String       @id @default(cuid())
  ownerName    String
  phoneNumber  String       @unique
  email        String?
  passwordHash String                       // bcrypt — dealer auth mirrors admin's pattern, not customer OTP
  status       DealerStatus @default(PENDING_VERIFICATION)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  listings     ParkingListing[]

  @@schema("customer")
}

model ParkingListing {
  id                  String   @id @default(cuid())
  dealerId            String
  name                String
  addressLine         String
  city                String
  latitude            Float
  longitude           Float
  fourWheelerCapacity Int      @default(0)
  twoWheelerCapacity  Int      @default(0)
  hourlyRatePaise     Int
  dailyRatePaise      Int?
  photos              String[]
  status              ListingStatus @default(ACTIVE)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  dealer              ParkingDealer @relation(fields: [dealerId], references: [id], onDelete: Cascade)
  slotWindows         ParkingSlotWindow[]
  bookings            ParkingBooking[]
  waitlist            ParkingWaitlistEntry[]

  @@index([dealerId])
  @@index([latitude, longitude])
  @@schema("customer")
}

model ParkingSlotWindow {                   // declared capacity for one hour-block on one date
  id        String   @id @default(cuid())
  listingId String
  date      DateTime @db.Date
  startHour Int                             // 0-23
  endHour   Int
  capacity  Int
  booked    Int      @default(0)
  listing   ParkingListing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([listingId, date, startHour])
  @@index([listingId, date])
  @@schema("customer")
}

model ParkingBooking {
  id          String        @id @default(cuid())
  customerId  String
  listingId   String
  vehicleId   String?
  startTime   DateTime
  endTime     DateTime
  amountPaise Int
  status      BookingStatus @default(PENDING_PAYMENT)
  orderId     String?                       // CustomerOrder.id, set once checkout starts
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  customer    Customer       @relation(fields: [customerId], references: [id], onDelete: Cascade)
  listing     ParkingListing @relation(fields: [listingId], references: [id])

  @@index([customerId])
  @@index([listingId, startTime])
  @@schema("customer")
}

model ParkingWaitlistEntry {
  id          String   @id @default(cuid())
  customerId  String
  listingId   String
  desiredDate DateTime @db.Date
  notified    Boolean  @default(false)
  createdAt   DateTime @default(now())
  customer    Customer       @relation(fields: [customerId], references: [id], onDelete: Cascade)
  listing     ParkingListing @relation(fields: [listingId], references: [id])

  @@index([listingId, desiredDate])
  @@schema("customer")
}

enum DealerStatus   { PENDING_VERIFICATION VERIFIED SUSPENDED                 @@schema("customer") }
enum ListingStatus  { ACTIVE PAUSED REMOVED                                   @@schema("customer") }
enum BookingStatus  { PENDING_PAYMENT CONFIRMED CANCELLED COMPLETED NO_SHOW   @@schema("customer") }
```

**Migration note:** add `parkingBookings`, `waitlistEntries`, and `orders` back-relations to the existing `Customer` model.

## 5. Backend module layout

Both modules follow the existing `<module>.routes.ts / .controller.ts / .service.ts / .validators.ts` convention seen in `modules/vehicle` and `modules/document`.

```
Backend/src/modules/payments/
  payments.routes.ts
  payments.controller.ts
  payments.service.ts
  payments.validators.ts
  razorpay.webhook.controller.ts     — separate; no authMiddleware, raw-body signature check

Backend/src/modules/parking/
  parking.routes.ts
  parking.controller.ts
  parking.service.ts
  parking.validators.ts
  dealer.controller.ts               — dealer-facing CRUD, separate auth
  parking-dealer.middleware.ts       — new dealerAuthMiddleware
```

`Backend/src/routes.ts` — two new lines, existing pattern:
```ts
router.use("/v1/payments", paymentsRoutes);
router.use("/v1/parking", parkingRoutes);
```

> **Verify before building:** Razorpay webhook signature verification needs the *raw* request body. Confirm `app.ts`'s global body parser doesn't consume it first — `/v1/payments/webhook` needs its own `express.raw({ type: "application/json" })` mounted ahead of the global `express.json()`, scoped to that one path only.

**Reused as-is, no changes needed:** `notificationService.notifyCustomer()` for booking/payment alerts, `storageService.uploadFile(file, "parking", true)` for listing photos, and `placesService`'s haversine `distanceKm` helper pattern for ranking search results.

## 6. API contract

### Payments

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/payments/orders` | Customer | Create a `CustomerOrder` + Razorpay order for a given `purpose`/`referenceId`/`amountPaise` |
| GET | `/v1/payments/orders/:id` | Customer, owner-only | Poll order + latest attempt status |
| POST | `/v1/payments/orders/:id/verify` | Customer | Optional immediate client-side verify for snappy UI (webhook remains source of truth) |
| POST | `/v1/payments/webhook` | None — Razorpay signature only | Signature-verified, idempotent order/refund status updates |
| GET | `/v1/payments/history` | Customer | Paid/refunded order history + receipts |

### Parking — customer-facing

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/parking/search?lat=&lng=&date=&startHour=&endHour=` | Customer | Listings near a destination; sold-out ones ranked first with `waitlistAvailable: true` |
| GET | `/v1/parking/listings/:id` | Customer | Listing detail |
| GET | `/v1/parking/listings/:id/availability?date=` | Customer | Slot-window capacity for a date |
| POST | `/v1/parking/bookings` | Customer | Reserve capacity (tx) → `PENDING_PAYMENT` → calls `paymentsService.createOrder()` in-process |
| GET | `/v1/parking/bookings` | Customer | My bookings |
| POST | `/v1/parking/bookings/:id/cancel` | Customer, owner-only | Cancel within policy → releases capacity → triggers refund |
| POST | `/v1/parking/waitlist` | Customer | Join waitlist for a sold-out listing/date |

### Parking — dealer-facing

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/parking/dealer/auth/login` | None (issues dealer JWT) | Email + password login |
| POST | `/v1/parking/dealer/listings` | Dealer | Create listing (+ photo upload via storageService) |
| PATCH | `/v1/parking/dealer/listings/:id` | Dealer, owner-only | Update pricing/capacity/status |
| POST | `/v1/parking/dealer/listings/:id/slots` | Dealer, owner-only | Bulk-create slot-window capacity for a date range |
| GET | `/v1/parking/dealer/bookings` | Dealer | Bookings across the dealer's own listings |

Create-booking request/response example:
```
POST /v1/parking/bookings
{ "listingId": "cl...", "vehicleId": "cl...", "startTime": "2026-07-20T09:00:00Z", "endTime": "2026-07-20T11:00:00Z" }

201 →
{ "booking": { "id": "cl...", "status": "PENDING_PAYMENT", "amountPaise": 15000 },
  "payment": { "orderId": "cl...", "razorpayOrderId": "order_...", "keyId": "rzp_live_..." } }
```

## 7. Sequence flows

### Flow A — search, book, pay, confirm

```
MOBILE               PARKING SVC            PAYMENTS SVC          RAZORPAY
  │──GET /search────────▶│                       │                     │
  │◀─listings+avail──────│                       │                     │
  │──GET availability───▶│                       │                     │
  │◀─slot windows────────│                       │                     │
  │──POST /bookings─────▶│                       │                     │
  │                      │─reserve capacity (tx) │                     │
  │                      │─createOrder(purpose,  │                     │
  │                      │  referenceId, amount)▶│                     │
  │                      │                       │─Orders API─────────▶│
  │                      │                       │◀─razorpayOrderId────│
  │◀─booking + orderId + keyId───────────────────│                     │
  │──open Razorpay checkout (native SDK)────────────────────────────────▶│
  │◀─paymentId + signature (client-side)───────────────────────────────│
  │                      │                       │◀───webhook POST─────│
  │                      │◀─payment-events:      │
  │                      │  PARKING_BOOKING.PAID │
  │                      │─confirm booking,──────┤
  │                      │  release hold,        │
  │                      │  notifyCustomer()      │
```

### Flow B — sold-out → waitlist
1. Search returns a listing with 0 remaining capacity for the requested window.
2. It's pinned to the top of results with a "Notify me" action (not hidden).
3. `POST /v1/parking/waitlist` records the request.
4. On a cancellation or dealer capacity increase, the handler scans `ParkingWaitlistEntry` for that listing/date and calls `notifyCustomer()` per match, then flips `notified: true`.

### Flow C — cancel & refund
1. `POST /bookings/:id/cancel` checks the cancellation-policy window.
2. Booking → `CANCELLED`; `ParkingSlotWindow.booked` decremented; waitlist notified.
3. Parking calls `paymentsService.refund(orderId, amountPaise)` in-process.
4. `CustomerRefund(INITIATED)` → Razorpay Refunds API → webhook confirms → `PROCESSED` → customer notified.

> **Concurrency risk to design for now, not later:** two customers booking the last slot at once needs a DB transaction with a row-level check-and-increment on `ParkingSlotWindow.booked` (or a unique constraint + retry) — a plain "check then write" from application code will double-book under load.

## 8. Mobile architecture

**Confirmed existing state:** `Mobile/src/screens/ServiceAndWarrenty/NearbyPlaces.tsx` already does a Google-Places "find nearby parking on a map" view — no price, no booking. Separately, `ServicesHub.tsx` has a "Smart Parking" tile and grid entry, but its `onServicePress` switch has **no `case 'Parking'`** — it silently falls through to `default: break;`. That tile is a dead tap target today, not a working flow. Also distinct: `ValetService.tsx` is a real, already-shipped B2B valet-tracking screen (different feature entirely — don't conflate the two "parking-adjacent" screens).

**New screens:**
- `ParkingSearchScreen` — destination picker + map/list (reuses `react-native-maps`, already installed)
- `ParkingListingDetailScreen` — date/time/slot picker, price, Book CTA
- Razorpay checkout — native modal via `react-native-razorpay`
- `MyParkingBookingsScreen` — list + cancel

**Wiring changes to make:**
- Fix the dead `'Parking'` case in `ServicesHub.tsx` to navigate into the new flow
- Register screens in `ServiceNavigator.tsx`, same pattern as `NearbyPlaces`
- New service files: `parkingService.ts`, `paymentsService.ts` — thin wrappers mirroring `placesService.ts`
- New Zustand store `parkingStore.ts` — a "version bump" store like `expenseStore.ts`, not Redux (Redux is nearly unused for new features)

> **One native dependency, not just JS:** `react-native-razorpay` is not currently installed and requires native linking on both iOS and Android — this is the one piece of this build that needs a native rebuild, not a hot-reloadable JS change. No QR/maps libraries need adding beyond this.

> **Recommend: no dealer screens in the consumer app.** Build dealer-facing listing/booking management as a new section of `Admin/` (React + Vite) instead of inside the React Native app. It already has a typed API client with in-flight GET de-duplication that fits internal CRUD tooling better, and it keeps business-operator tooling out of the consumer app bundle. This reallocates the backlog's "6h dealer-facing mobile screens" line to an Admin/ web task instead — flag this reallocation to the team before estimating.

## 9. Dealer role & auth

Grepped the entire backend for `dealer`/`vendor` (any case) — **zero hits**, in code or schema. Only two roles exist today: `CustomerPayload {id, phoneNumber}` (OTP+JWT) and `AdminPayload {id, email, name, role}` (email+bcrypt+JWT). A dealer role is being introduced from nothing.

**Design:**
- `ParkingDealer.passwordHash` + email/password login, mirroring the **admin** pattern (bcrypt) — dealers are business operators, not app end-users, so OTP-by-SMS doesn't fit the way it does for `Customer`.
- New `dealerAuthMiddleware`, structurally identical to `adminAuthMiddleware`: verifies a dealer-scoped JWT, sets `req.dealer = { id, phoneNumber }`.
- New `DealerPayload` type added to `Backend/src/types/global.d.ts` alongside the existing `CustomerPayload`/`AdminPayload` declarations.

> **Not an engineering decision:** who "dealers" actually are operationally — existing parking-operator partners being onboarded manually vs. a self-serve signup flow — is a business/ops call this plan can't resolve. It changes whether `DealerStatus.PENDING_VERIFICATION` needs an admin approval screen on day one or can launch with dealers pre-seeded by ops.

## 10. Where this gets reused later

**Payments — build generic now.** The backlog names Accessories Marketplace and Rental Marketplace as future checkouts through this same gateway. That's the one place upfront generality is justified — the `purpose` enum and polymorphic `referenceId` exist specifically so those two features add an enum value and call `createOrder()`, with zero changes to `payments.service.ts`.

**Dealer + Listing — don't generalize yet.** Phase 3's "Dealer Listings" feature later generalizes `Dealer` into a cross-category entity, and Rent a Car/Bike (Phase 1 #8) reuses the same Dealer+Listing+Booking shape. Don't build that generalized multi-category model now — just avoid parking-specific naming on core identity fields (`ownerName`, `phoneNumber`, `passwordHash`) so the later generalization is a rename/extend, not a rewrite.

## 11. Risks & open questions

| Risk | Detail | Owner |
|---|---|---|
| Razorpay KYC | Merchant account approval is outside engineering's control and can add days-to-weeks before webhooks can go live. Start this in parallel with schema/backend work, not after. | Business/ops |
| Dealer onboarding | Who operationally becomes a "dealer" — existing partners vs. self-serve — is undecided and shapes the verification workflow. | Product |
| Abandoned holds | `PENDING_PAYMENT` bookings that never complete checkout hold capacity indefinitely without a cleanup job. | Engineering |
| Double-booking race | Concurrent bookings against the last slot need a transactional capacity check, not check-then-write. | Engineering |
| Two "find parking" UIs | `NearbyPlaces.tsx`'s existing Google-Places "parking" pin type will coexist with real dealer listings unless explicitly retired for the parking case. | Product |
| Webhook raw body | Needs confirming `app.ts`'s body-parser order won't break Razorpay signature verification. | Engineering |

Mitigation for abandoned holds:
```ts
// BullMQ job, same pattern as existing services/scheduler.service.ts
// every N minutes: cancel ParkingBooking where status=PENDING_PAYMENT
// and createdAt older than 10 min → release ParkingSlotWindow.booked
```

## 12. Build sequence

The backlog's own two tables total 67h (Parking) + 68h (Payments) = **135h** — about 68% of a single engineer's 198h window, or 34% of a two-engineer 396h window. Fully buildable inside Phase 1's fixed Jul 15–Aug 30 window if prioritized, unlike the full 952h Phase 1 scope. Resequenced so Payments' core exists before Parking needs it:

| Milestone | Work | Hours |
|---|---|---|
| 1 | Payments foundation — schema/migration, Razorpay SDK+env setup, order-creation service/endpoint, webhook signature verification + idempotent processing + audit log, payment-events emitter | ~30h |
| 2 | Parking core — schema/migration (dealer/listing/slot-window/booking/waitlist), seed data, dealer CRUD API, destination-search endpoint, availability engine, booking create/cancel wired to Payments in-process | ~35h |
| 3 | Payments completion — status/history endpoints, refund flow, receipt generation, backend tests, mobile SDK integration + checkout UI + success/failure handling + history screen, sandbox testing, go-live checklist | ~38h |
| 4 | Parking completion — waitlist endpoint, notification wiring, mobile search/detail/booking/my-bookings UI, sold-out surfacing, dealer management screens (Admin/ web, reallocated from mobile), design, full QA (incl. payment-failure × cancellation matrix) | ~32h |
| **Total** | | **135h** |

**Why Payments goes first despite the backlog's ordering:** Milestone 2's booking-create endpoint calls `paymentsService.createOrder()` — it cannot be tested end-to-end without Milestone 1 existing. Building Parking first would mean stubbing a payment call and re-testing later; building Payments' core first means Parking is testable the first time it's written.

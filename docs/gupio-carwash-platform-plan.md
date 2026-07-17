# Vehicle Care Platform (Car Wash) — Right-Sized Architecture Plan

A phased roadmap for doorstep wash, visit-center wash, pickup & drop, subscriptions, a partner/technician app, AI-driven reminders, and a vehicle care timeline — right-sized to this app's actual architecture (a single Express monolith on Postgres + Redis) instead of the 16-microservice/Kafka/Elasticsearch/Kubernetes/multi-region stack the original brief specified.

Three items from the brief are folded into decisions already made elsewhere in this app rather than duplicated: **Marketplace** stays parked (same call made for the Community Platform plan), **Roadside Assistance/Jump Start/Tow/Fuel Delivery** extends the existing SOS module instead of a second dispatch system, and **Reviews** reuses the Review model already planned (not yet built) for the Community Platform instead of a wash-specific fork.

## 1. Reality check

The brief specifies 16 microservices (Auth, Vehicle, Booking, Subscription, Partner, Location, Tracking, Payment, Notification, Media, Chat, Call, Recommendation, Analytics, Admin, API Gateway), Kafka, Elasticsearch, multi-region deployment, and a 10M-user/100M-booking design target. A direct investigation of this codebase before writing this plan found:

- **One Express process** runs everything — no separate worker fleet, no Kafka, no Elasticsearch, no Kubernetes anywhere in this monorepo.
- The Postgres database is **shared with an unrelated B2B product**, migration history not fully trustworthy from scratch.
- A **near-identical shape already exists and works**: the Parking module (dealer-listed slots, customer bookings, lifecycle states) is architecturally almost the same problem as Visit Wash Center booking.
- A **separate-role auth pattern already exists and works**: `ParkingDealer` with its own JWT (`signDealerAccess`/`verifyDealerAccess`) and its own Admin auth context (`DealerAuthContext.tsx`) — exactly the shape a wash-technician "Partner App" needs.
- **Payments is one-time-order only** — `PaymentPurpose` currently has a single value (`PARKING_BOOKING`); there is zero subscription/recurring-billing infrastructure anywhere.
- **No** `Garage`, `Mechanic`, `WashCenter`, `Review`, `CarWash`, `Technician`, `Partner`, or `Subscription` model exists yet — the wash domain itself is greenfield.

A 16-microservice split for a monolith with no measured concurrent load solves a problem that doesn't exist yet, at the cost of a real one: shipping a working wash booking flow. The Parking/Dealer/Payments trio isn't just a precedent to learn from — it's close enough in shape to copy directly for Visit Wash Center + Partner App + one-time payment. Subscriptions (Wash Plans) are the one piece with no existing shortcut — genuine new billing engineering, scoped honestly as Phase B.

The product idea is strong: doorstep/visit-center/pickup-drop wash, AI-driven reminders, and a unified vehicle care timeline all extend what Gupio already is — a vehicle-health app. The specified FAANG-scale architecture is what doesn't fit; this plan builds the same functionality without it.

## 2. Phased scope

| Phase | Ships |
|---|---|
| **A — Core** | Visit Wash Center + Doorstep Wash booking (one-time payment only), Partner/Technician app (accept job, before/after photos, mark complete), Wash Center & slot management (mirrors Parking), Vehicle Timeline v1 (wash-completed events), rule-based AI wash reminder (weather + last-wash-date) |
| **B — Subscriptions** | Wash Plans (weekly/monthly/quarterly/yearly/unlimited/family/corporate), pause/resume/freeze/skip, auto-renewal, subscription billing engine |
| **C — Logistics** | Pickup & Drop (executive assignment, digital inspection with photos + signature), Live Tracking (GPS over existing Socket.io), real-time chat with technician |
| **D — Retention** | Reviews (wash centers/technicians, via Community's Review model), loyalty/streaks (via Community's reputation system), deeper AI (ceramic coating / detailing upsell recommendations), personalized offers |
| **Later** | Marketplace (parked, same decision as Community Platform), Corporate Fleet Washing at scale, voice call with technician (flagged, not assumed), Emergency Wash SLA tier |

**Why Doorstep Wash ships in Phase A, not later:** unlike Community's Clubs/Events (genuinely optional add-ons), Doorstep Wash without a partner/technician flow isn't a smaller version of the feature — it's not the feature at all. Visit-Center booking and the Partner app ship together in Phase A because one is meaningless without the other.

## 3. System overview

Car Wash becomes `Backend/src/modules/carwash/` — a peer to `parking/`, `payments/`, and `sos/`, copying the Parking/Dealer split directly: a customer-facing controller/service and a separate partner-facing controller/service sharing one Prisma-backed core.

```
 MOBILE (customer)                    MOBILE/ADMIN (partner)             ADMIN (ops)
 ┌────────────────────────┐            ┌───────────────────────┐         ┌───────────────────┐
 │ WashSearchScreen         │           │ Partner job queue      │         │ Wash centers CRUD   │
 │ WashCenterDetailScreen   │           │ Accept / navigate       │         │ Partner onboarding  │
 │ DoorstepBookingScreen    │           │ Before/after photos     │         │ Payouts, analytics  │
 │ MyWashBookingsScreen     │           │ Mark complete           │         └──────────┬──────────┘
 └──────────┬───────────────┘           └──────────┬─────────────┘                    │
            │ HTTPS /v1/carwash/*                   │ HTTPS /v1/carwash/partner/*        │ HTTPS /v1/admin/carwash/*
            ▼                                       ▼                                    ▼
 ┌───────────────────────────────── Backend (Express, same process) ─────────────────────────────────┐
 │  modules/carwash/                                                                                    │
 │  ├─ carwash.routes.ts / .controller.ts / .service.ts / .validators.ts   (booking, centers, slots)    │
 │  ├─ partner.controller.ts / partner.jwt.ts   (mirrors parking's dealer.controller.ts / parking.jwt)  │
 │  ├─ admin-partner.controller.ts              (mirrors admin-dealer.controller.ts)                    │
 │  ├─ timeline.service.ts     (wash-completed events → Vehicle Timeline, §10)                           │
 │  ├─ reminder.service.ts     (rule-based AI reminder, §9)                                              │
 │  └─ subscription.service.ts (Phase B)                                                                 │
 │           │                    │                    │                    │                            │
 │           ▼                    ▼                    ▼                    ▼                            │
 │   services/payments      services/storage     services/weather     socket.ts (rooms,                  │
 │   (extend PaymentPurpose) (S3, before/after)   (rain → reminder)     hardened, reused for tracking)    │
 └──────────────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                             ▼
                                Postgres · schema "customer"  +  Redis (rank/cache/rate-limit)
```

Nearly everything on the right side already exists and already works — Payments, S3 storage, weather service, and the hardened Socket.io room system were all built for Parking, Payments, or Vehicle Messaging. The Partner/Dealer auth split is a direct copy, not a new design.

## 4. Data model — Phase A (core booking)

Field-for-field, this is the Parking model family with wash-specific vocabulary. Where Parking has a `ParkingSlotWindow`, this has a `WashSlot`; the one real structural difference is `serviceModel` (visit-center vs doorstep) and an assigned `technicianId` for doorstep jobs.

```prisma
model WashPartner {
  id          String            @id @default(cuid())
  name        String
  phoneNumber String            @unique
  status      WashPartnerStatus @default(PENDING)   // PENDING | ACTIVE | SUSPENDED
  rating      Float?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  centers      WashCenter[]
  technicians  WashTechnician[]
  bookings     WashBooking[]

  @@schema("customer")
}

/// A technician is a person; WashPartner is the business entity that employs them.
/// Doorstep jobs assign a WashTechnician, not just a WashPartner.
model WashTechnician {
  id          String   @id @default(cuid())
  partnerId   String
  name        String
  phoneNumber String   @unique
  photoUrl    String?
  isActive    Boolean  @default(true)
  rating      Float?
  createdAt   DateTime @default(now())

  partner  WashPartner   @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  bookings WashBooking[]

  @@index([partnerId])
  @@schema("customer")
}

model WashCenter {
  id           String   @id @default(cuid())
  partnerId    String
  name         String
  address      String
  latitude     Float
  longitude    Float
  supportsBike Boolean  @default(true)
  supportsCar  Boolean  @default(true)
  supportsEV   Boolean  @default(true)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  partner WashPartner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  slots   WashSlot[]

  @@index([partnerId])
  @@index([latitude, longitude])
  @@schema("customer")
}

model WashSlot {
  id           String   @id @default(cuid())
  centerId     String
  startsAt     DateTime
  endsAt       DateTime
  capacity     Int      @default(1)
  bookedCount  Int      @default(0)

  center   WashCenter    @relation(fields: [centerId], references: [id], onDelete: Cascade)
  bookings WashBooking[]

  @@index([centerId, startsAt])
  @@schema("customer")
}

model WashBooking {
  id            String            @id @default(cuid())
  customerId    String
  vehicleId     String
  partnerId     String
  centerId      String?                              // null for doorstep — no fixed center
  slotId        String?                               // null for doorstep — no fixed slot
  technicianId  String?                               // set once a doorstep job is assigned
  serviceModel  WashServiceModel                       // VISIT_CENTER | DOORSTEP
  washType      WashType                               // EXTERIOR, INTERIOR, FOAM, STEAM, CERAMIC_COATING, etc.
  addressLine   String?                                // doorstep only
  latitude      Float?
  longitude     Float?
  status        WashBookingStatus @default(PENDING_PAYMENT)
  priceRupees   Int
  beforePhotoUrls String[]        @default([])
  afterPhotoUrls  String[]        @default([])
  scheduledAt   DateTime?                              // null = "book now"
  completedAt   DateTime?
  idempotencyKey String?          @unique
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  customer   Customer        @relation(fields: [customerId], references: [id], onDelete: Cascade)
  partner    WashPartner     @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  center     WashCenter?     @relation(fields: [centerId], references: [id])
  slot       WashSlot?       @relation(fields: [slotId], references: [id])
  technician WashTechnician? @relation(fields: [technicianId], references: [id])

  @@index([customerId, createdAt])
  @@index([partnerId, status])
  @@index([technicianId])
  @@schema("customer")
}

enum WashPartnerStatus  { PENDING ACTIVE SUSPENDED                                    @@schema("customer") }
enum WashServiceModel   { VISIT_CENTER DOORSTEP                                        @@schema("customer") }
enum WashType           { EXTERIOR INTERIOR FOAM PRESSURE STEAM WATERLESS DETAILING CERAMIC_COATING WAX_POLISH ENGINE_CLEAN TYRE_POLISH GLASS_TREATMENT UNDERCARRIAGE SANITIZATION BIKE_WASH EV_SAFE_WASH @@schema("customer") }
enum WashBookingStatus  { PENDING_PAYMENT CONFIRMED TECHNICIAN_ASSIGNED IN_PROGRESS COMPLETED CANCELLED REFUNDED @@schema("customer") }
```

**Why no waitlist model:** Parking's waitlist exists because a specific lot has hard physical capacity and demand clusters at commute hours. Wash capacity is softer — a full slot just means "pick another slot or center," so Phase A skips a `WashWaitlistEntry` model entirely. Add it later only if real usage shows people repeatedly hitting fully-booked centers.

## 5. Data model — Phase B (subscriptions)

Unlike Phase A, nothing in this codebase does recurring billing today — `PaymentPurpose` is one-time-order only. This is real new infrastructure.

```prisma
model WashPlan {
  id            String       @id @default(cuid())
  name          String                                 // "Monthly Unlimited", "Family Plan"
  cadence       WashPlanCadence                        // WEEKLY MONTHLY QUARTERLY YEARLY
  washesIncluded Int?                                   // null = unlimited
  priceRupees   Int
  maxVehicles   Int          @default(1)                // >1 for Family/Corporate plans
  isActive      Boolean      @default(true)

  subscriptions WashSubscription[]
  @@schema("customer")
}

model WashSubscription {
  id                String                @id @default(cuid())
  customerId        String
  planId            String
  status            WashSubscriptionStatus @default(ACTIVE)  // ACTIVE PAUSED FROZEN CANCELLED EXPIRED
  washesUsedThisCycle Int                  @default(0)
  washesCarriedOver Int                    @default(0)
  autoRenew         Boolean                @default(true)
  currentPeriodEnd  DateTime
  pausedAt          DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  plan     WashPlan @relation(fields: [planId], references: [id])

  @@index([customerId])
  @@schema("customer")
}

enum WashPlanCadence         { WEEKLY MONTHLY QUARTERLY YEARLY                @@schema("customer") }
enum WashSubscriptionStatus  { ACTIVE PAUSED FROZEN CANCELLED EXPIRED          @@schema("customer") }
```

**Billing approach:** rather than Razorpay recurring mandates (a real integration project on its own), Phase B starts with a BullMQ periodic job (same pattern as the existing abandoned-booking sweep) that charges each active subscription's `currentPeriodEnd` via the same one-time Payments flow already built — recurring behavior from repeated one-time charges, not a new payment-gateway integration. Upgrade to true mandates only if churn from manual re-auth becomes a measured problem.

## 6. Data model — Phase C (pickup & drop)

```prisma
/// One row per inspection event (pickup AND drop each create one) — not a
/// single mutable row — so the before/after comparison is always two
/// immutable records, never one row overwritten in place.
model WashInspection {
  id            String            @id @default(cuid())
  bookingId     String
  type          WashInspectionType                     // PICKUP | DROP
  photoUrls     String[]          @default([])          // front, rear, left, right, interior, odometer
  odometerReading Int?
  fuelLevelPct  Int?
  existingDamageNotes String?
  signatureUrl  String?                                  // customer's digital signature image
  createdAt     DateTime          @default(now())

  booking WashBooking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([bookingId])
  @@schema("customer")
}

enum WashInspectionType { PICKUP DROP @@schema("customer") }
```

Live GPS tracking during pickup/drop needs no new model — it's a Socket.io event stream (`technician_location`, §12), not persisted row-by-row. Only the inspection snapshots and the final booking status are durable.

## 7. Reviews & loyalty — reuse, don't fork

**Do not build a second Review model.** The Community Platform plan (`docs/gupio-community-platform-plan.md` §6, Phase C — not yet built) already designs a `Review` model with a `ReviewTarget` enum intended to cover garages, mechanics, and similar targets. Phase D of this plan simply adds `CAR_WASH` and `WASH_TECHNICIAN` as two more `ReviewTarget` values when that model gets built — not a parallel `WashReview` table. Same logic for loyalty: badges/streaks/XP reuse Community's planned `ReputationProfile`/`Badge` models rather than a wash-specific points system.

Two independent review systems (one for garages/community content, one for car washes) would fragment trust signals exactly where a unified "is this service provider good?" signal is most valuable.

## 8. Booking workflows

**Doorstep flow:**
```
PENDING_PAYMENT ──pay──▶ CONFIRMED ──partner assigns technician──▶ TECHNICIAN_ASSIGNED
       │                                                                   │
       │                                                     technician arrives, uploads
       │                                                     before-photos, starts wash
       │                                                                   ▼
       │                                                              IN_PROGRESS
       │                                                                   │
       │                                                     after-photos, marks complete
       │                                                                   ▼
       └──cancel (before technician assigned)──▶ CANCELLED          COMPLETED
                                                                            │
                                                                  Vehicle Timeline event
                                                                  (§10) fires here
```

**Visit Wash Center flow** (mirrors Parking's booking lifecycle almost exactly):
```
PENDING_PAYMENT ──pay──▶ CONFIRMED ──customer checks in at center (QR)──▶ IN_PROGRESS ──▶ COMPLETED
```

**Pickup & Drop flow (Phase C):**
```
CONFIRMED ──executive assigned──▶ pickup WashInspection created (photos + signature)
    ──▶ TECHNICIAN_ASSIGNED (vehicle in transit, live tracking) ──▶ vehicle at wash center
    ──▶ IN_PROGRESS (wash + detailing) ──▶ quality check ──▶ drop WashInspection created
    ──▶ vehicle returned, customer verifies ──▶ COMPLETED ──▶ rating
```

## 9. AI wash recommendations

The brief asks for weather/dust/mileage/parking-location/festival-season-aware predictions. A real ML recommendation service is a project of its own with no training data yet (no wash history exists before Phase A ships). Phase A ships the useful 80% with a scheduled rule, not a model:

```
// reminder.service.ts — BullMQ daily job, same shape as autoCloseIdleConversations
for each active vehicle:
  daysSinceLastWash = today - vehicle.lastWashCompletedAt
  weather = weatherService.getCurrentWeather(vehicle.lastKnownLat, lastKnownLon)

  shouldRemind =
       daysSinceLastWash >= 14
    OR (weather?.precip_mm > 5 AND daysSinceLastWash >= 5)   // rained recently + a few dusty days after
    OR (weather?.condition includes "dust"/"haze" AND daysSinceLastWash >= 7)

  if shouldRemind: notificationService.notifyCustomer(customerId, {
    title: "Your vehicle should be washed",
    body: "It's been N days since your last wash" | "Rain left your car dusty — time for a wash?",
    type: "WASH_REMINDER",
    link: "/carwash/book"
  })
```

**Growth path to real ML:** once Phase A has been running long enough to accumulate real wash-frequency data per vehicle/region, the same job's rule-based `shouldRemind` boolean is swapped for a score from a proper model — the event/notification plumbing around it doesn't change. "Premium detailing / ceramic coating" upsell recommendations (Phase D) follow the same pattern.

## 10. Vehicle Health Timeline

This app already has the raw material for a timeline — it's scattered across existing tables, never unified into one view. Phase A adds exactly one thing: a wash-completed event source, then reads across what already exists.

| Source | Gives the timeline |
|---|---|
| `ServiceRecord` + `ServicePart` | Service completed, parts replaced (battery, tyres) with dates |
| `VehicleDocument` | Insurance renewed, RC/DL events, expiry dates |
| `OdometerLog` | Mileage-over-time points |
| `Challan` | Violation/fine events |
| `WashBooking.completedAt` (new, Phase A) | Wash completed — the one new event type this plan adds |

`timeline.service.ts` is a read-only aggregator: query each source scoped to a vehicle, normalize into `{type, label, occurredAt, meta}`, merge-sort by date. No new "Timeline" table, no dual-write risk — the timeline is always a live projection of tables that already exist.

## 11. Partner app

**Direct copy from Parking's Dealer stack:**
- `partner.jwt.ts` — same shape as `parking.jwt.ts`'s `signDealerAccess`/`verifyDealerAccess`, renamed for partners.
- `partnerAuthMiddleware` — same shape as `parking-dealer.middleware.ts`.
- Admin: a `PartnerAuthContext.tsx` alongside the existing `DealerAuthContext.tsx` — same "separate role, same app" pattern already proven.

**What's actually new:**
- Technician-level auth (a person under a partner business), not just partner-level — Parking's Dealer has no analogous "employee" tier.
- Job-queue UI: accept/reject a job, navigate, upload before/after photos, mark complete — new screens, but the same request/response shape as the Dealer booking list.
- Route optimization / "today's jobs" — Phase A ships a simple chronological list; real route optimization is deferred (§17), it needs real job-density data to be worth building.

## 12. Realtime & tracking

| Event | Room | Fires on |
|---|---|---|
| `booking_status_changed` | `<customerId>` | Any `WashBookingStatus` transition |
| `technician_location` | `booking:<id>` | Technician's app pushes GPS every few seconds during an active doorstep/pickup-drop job (Phase C) |
| `new_message` / `typing` | `booking:<id>` | Customer↔technician chat — same relay pattern as `messaging.socket.ts`'s typing-indicator relay |

All three reuse the already-hardened, JWT-verified Socket.io room system — no new realtime infrastructure, just new room names and event types registered via the existing `onSocketConnection()` extensibility hook.

## 13. Payments & billing

**Phase A — one-time (extend, don't rebuild):**
```prisma
enum PaymentPurpose {
  PARKING_BOOKING   // existing
  CAR_WASH_BOOKING  // add this one value
}
```
Order creation, Razorpay checkout, webhook confirmation, refunds — all reused as-is from the existing Payments module. Zero new payment code in Phase A beyond wiring a new purpose through.

**Phase B — subscriptions (genuinely new):**
- A BullMQ job charges each `WashSubscription` at `currentPeriodEnd` via a new one-time order with purpose `CAR_WASH_SUBSCRIPTION_RENEWAL` — reuses the payment rails, not the billing logic.
- Failed renewal → subscription moves to a grace-period state before `EXPIRED`; retried once via the same job the next day.

## 14. API & module layout

| Method | Path | Phase |
|---|---|---|
| GET | `/v1/carwash/centers/nearby` | A |
| GET | `/v1/carwash/centers/:id/slots` | A |
| POST | `/v1/carwash/bookings` (visit-center or doorstep) | A |
| GET | `/v1/carwash/bookings` / `/v1/carwash/bookings/:id` | A |
| POST | `/v1/carwash/bookings/:id/cancel` | A |
| GET | `/v1/carwash/partner/jobs` | A |
| POST | `/v1/carwash/partner/jobs/:id/accept` | A |
| POST | `/v1/carwash/partner/jobs/:id/photos` (before/after) | A |
| POST | `/v1/carwash/partner/jobs/:id/complete` | A |
| GET | `/v1/vehicles/:id/timeline` | A |
| POST/PATCH | `/v1/carwash/subscriptions` / `.../pause` / `/resume` / `/freeze` | B |
| POST | `/v1/carwash/bookings/:id/inspections` | C |

## 15. Mobile architecture

- Customer screens under `Mobile/src/screens/CarWash/`: `WashSearchScreen`, `WashCenterDetailScreen`, `DoorstepBookingScreen`, `MyWashBookingsScreen` — same conventions as the existing Parking screens (Zustand version-bump store, dark theme, `wp()`/`hp()` units).
- Vehicle picker reuses the "My Vehicles" auto-fetch pattern already established — never re-ask for registration/model/fuel type the app already has.
- Partner surface: given Parking's dealer portal lives in Admin (not a separate mobile app) for the same reason, evaluate whether wash technicians — who are in the field, not at a desk — actually need a lightweight React Native partner screen instead. A real decision point, not a silent default either way.

## 16. Admin

Wash Center/Partner management mirrors the existing Parking dealer-portal pages (`DealerListings`, `DealerBookings` → `PartnerCenters`, `PartnerBookings`). Analytics (revenue, retention, technician performance) extends the same tile-based Card pattern already used in `Messaging.tsx`'s analytics row and the Community moderation tab — one more tab in the same growing ops surface.

## 17. Deferred, on purpose

| Item | Why it waits / where it actually lives |
|---|---|
| Marketplace (cleaning products, tyres, oil, accessories) | Same decision already made for the Community Platform — stays parked. Not rebuilt under a different name here. |
| Roadside Assistance, Jump Start, Emergency Tow, Fuel Delivery | Extends the existing SOS module, not a second dispatch system. Already the plan in Community Platform's Phase C — one feature, one home. |
| Reviews (wash centers/technicians) | Folds into Community's planned Review model (§7) — new `ReviewTarget` values, not a new table. |
| Voice call with technician | Flagged, not assumed. A near-identical "audio calling" ask was explicitly declined for QR messaging this session — different context here, needs its own yes/no. |
| Route optimization for technicians | Needs real job-density data to be worth the engineering — Phase A ships a simple chronological job list first. |
| Corporate Fleet Washing at scale | The booking primitives (Phase A) support it structurally, but bulk scheduling/billing UX for fleets is its own scoping exercise. |
| Kafka, Elasticsearch, Kubernetes, microservices, multi-region, disaster recovery | Nothing in this app currently needs them — see §18 for the actual triggers. |

## 18. Scaling triggers

| Signal | Then introduce |
|---|---|
| Live GPS tracking events measurably strain the single Socket.io process | Horizontal scaling of that same process behind a sticky-session load balancer — still not microservices |
| Booking search/nearby-center queries slow down at real row counts | Postgres geo-indexing tuning first (PostGIS), Elasticsearch only if insufficient |
| Subscription billing volume makes the daily BullMQ sweep too slow | Shard the sweep by customer-id range across the existing worker, before reaching for Kafka |
| Photo/video storage grows enough that S3 costs or latency matter | Lifecycle policies + CDN in front of S3 — already partially true today |
| One specific workload needs independent scaling/deploy cadence | *That one* workload peels off — not all sixteen at once |
| Uptime/on-call requirements justify it and there are ≥2 independently-scaling services | Kubernetes |

## 19. Roadmap

| Phase | Scope | Est. hours |
|---|---|---:|
| A | Schema + migration, WashPartner/Technician/Center/Slot/Booking CRUD, Visit-Center + Doorstep booking, one-time payment, Partner app, Vehicle Timeline v1, rule-based reminder, Mobile + Admin screens | ~180h |
| B | WashPlan/WashSubscription schema, subscription CRUD, pause/resume/freeze/skip, BullMQ renewal-billing job, Mobile screens | ~90h |
| C | Pickup & Drop flow, WashInspection, live GPS tracking, customer↔technician chat, Mobile screens | ~110h |
| D | Reviews (extend Community's Review model), loyalty tie-in, AI upsell recommendations, Admin analytics extension | ~70h |
| **Total, A–D** | | **~450h** |
| Later | Marketplace, Corporate Fleet at scale, voice call, route optimization — not estimated, not scheduled | — |

~450h across Phases A–D is comparable to the Community Platform's ~365h and smaller than the Phase-4 Garage Platform backlog (1,022h) already scoped for this app. Start with Phase A alone (~180h) — it's fully self-contained and has the strongest existing precedent (Parking/Dealer/Payments) to build from, making it the lowest-risk place to start.

# GUPIO Phase 1–4 — Build Plan for What's Not Yet Done

*Full build plan across all four GUPIO roadmap phases, cross-checked against `gupio-build-backlog.md` (the source-of-truth, 16-agent audit of what's actually built vs. not). Every Partial/Not-built feature — Phase 1 (User Acquisition), Phase 2 (Revenue Services), Phase 3 (Automotive Ecosystem), and Phase 4 (GUPIO Garage Platform, B2B) — gets a 2–3 line summary, a task breakdown with hour estimates by layer, and `Shared with` / `Hard dependency` / `Risk` notes. Already-built features are excluded — see the backlog for those.*

**Capacity assumption (stated once, applies throughout — rescale if your team differs):** 1 full-stack engineer at ~6 productive hrs/day, or a 2-engineer scenario at ~12 hrs/day combined.

**Scheduling method:** Phase 1's window (Wed Jul 15 – Sun Aug 30, 2026) is a *fixed* input — and at 198h (1-eng) or 396h (2-eng) of capacity against ~952h of raw workload across its 13 features, it doesn't actually fit everything in-window at either staffing level; that's a pre-existing gap in the Phase 1 plan, not something this doc re-solves. Phases 2–4 instead each get a window *sized to their own total hours*, starting the next weekday after the prior phase ends — i.e. this assumes Phase 1 is treated as "however long it actually takes," and Phase 2 begins immediately after. Recompute the actual start date once Phase 1's real finish date is known; treat everything below as relative durations, not calendar commitments.

## Cross-phase timeline summary

| Phase | Raw hours | 1-engineer window | 2-engineer window |
|---|---|---|---|
| Phase 1 — User Acquisition | ~952h | Jul 15 – Aug 30, 2026 (fixed, under-capacity — see above) | same fixed window |
| Phase 2 — Revenue Services | 428h | Aug 31 – Dec 8, 2026 (72 weekdays, ~14.4 wks) | Aug 31 – Oct 19, 2026 (36 weekdays, ~7.2 wks) |
| Phase 3 — Automotive Ecosystem | 267h | Dec 9, 2026 – Feb 9, 2027 (45 weekdays, ~9 wks) | Oct 20 – Nov 19, 2026 (23 weekdays, ~4.6 wks) |
| Phase 4 — Garage Platform (B2B) | 1,022h | Feb 10 – Oct 6, 2027 (171 weekdays, ~34.2 wks / ~8 months) | Nov 20, 2026 – Mar 19, 2027 (86 weekdays, ~17.2 wks / ~4 months) |
| **Total, Phase 2–4** | **1,717h** | **Aug 31, 2026 – Oct 6, 2027 (~13.5 months)** | **Aug 31, 2026 – Mar 19, 2027 (~6.7 months)** |

**Read this before the per-feature detail:** two features are numbered into an earlier phase by the roadmap document but have a hard engineering dependency on a *later* phase's infrastructure — Phase 2's ANPR-based Parking Entry/Exit needs Phase 4's ANPR Vehicle Recognition, and Phase 3's Shareable Vehicle Certification Report needs Phase 4's Vehicle Digital Twin. Under strict sequential ordering neither can actually ship on the schedule its phase number implies; see each feature's `Hard dependency` note. Phase 4 is also a genuinely different product surface (an operator-facing garage OS, not the consumer app) with zero shared code today — everything in it is scoped assuming it may run on a separate team/track rather than literally after Phase 3 finishes; the sequential dates above are a default, not a recommendation.

---

# Phase 1 — User Acquisition (Park+-style core)
*(952h raw across the 13 Partial/Not-built features below — already-built Phase 1 features, e.g. Search Hotels/Malls, Service History, Vehicle Expense Tracker, Emergency SOS, Driving Behavior, Check Challan, AI Maintenance Reminders, are excluded per the backlog. Window: Wed, Jul 15 – Sun, Aug 30, 2026 — 47 calendar days, 33 weekdays across 7 weeks (Jul 15–19 is a partial 3-day week; the rest are full 5-day weeks). At 198h (1-eng) / 396h (2-eng) of capacity against this phase's 952h of raw workload, not everything below fits in-window at either staffing level — see the Cross-phase timeline summary above.)*

## 1. Parking — Locate + Booking
*(67h)*

Public parking-spot search & booking — genuinely new: search for and reserve a parking spot near a *destination* (not just current location), sourced from dealer/operator-listed inventory rather than a Google Places lookup. When a searched location has no open slots, it surfaces at the top of results with a "notify me / join waitlist" action instead of disappearing — that's my read of "if booking not available they can see add in top"; flag it if you meant something more specific.

| Task | Layer | Hours |
|---|---|---|
| ParkingDealer + ParkingListing (location, capacity, hourly/daily rate) + Booking models + migration | data-model | 4 |
| Seed/fixture data for parking dealers/listings | data-model | 2 |
| Dealer listing CRUD API (dealer-role auth) | backend | 6 |
| Destination-based nearby search endpoint (search near where you're going, not just current GPS) | backend | 4 |
| Real-time availability engine (slot check for a date/time range) | backend | 5 |
| Booking create/confirm/cancel endpoints | backend | 5 |
| "Notify me / join waitlist" endpoint for sold-out locations | backend | 3 |
| Wire booking confirmation + waitlist alerts into notification service | backend | 2 |
| Update parking search UI to search near a chosen destination | mobile | 4 |
| Listing detail + booking flow UI (date/time picker, price, confirm) | mobile | 8 |
| "My Parking Bookings" screen | mobile | 4 |
| Sold-out listings surfaced at top with "Notify Me" CTA | mobile | 3 |
| Dealer-facing listing management screens | mobile | 6 |
| Design: destination search results (available/sold-out/waitlist states), booking flow, dealer management | design | 5 |
| End-to-end QA: destination search, booking, no-availability/waitlist flow, cancellation | qa | 6 |
| **Total** | | **67h** |

**Shared with:** this introduces the same Dealer + Listing + Availability + Booking pattern that Rent a Car/Bike (#8) needs — whichever of the two gets built first should own the generic version, and the other reuses it (same style of saving as the Booking Core shared between Book Car Servicing and Rentals). Not deducted here since build order isn't fixed yet.
**Risk:** depends on who "dealers" are operationally (parking-lot owners/operators onboarding into the app) — a business/ops dependency, not just engineering time.

---

## 2. Parking Payments *(shipped as "Customer Payments" — shared gateway)*
*(68h)*

There is currently no way to charge a customer for anything in the app. The Payment/Invoice/Razorpay tables in the database all belong to the B2B operator side and can't be reused as-is — this is a ground-up build of a real customer-facing payment module, which will also be the shared foundation Accessories Marketplace and Rental Marketplace check out through.

| Task | Layer | Hours |
|---|---|---|
| Customer-scoped payment schema (Payment/Transaction/Order/Refund keyed to customerId) + migration | data-model | 4 |
| Razorpay account/env/SDK setup | backend | 2 |
| Order creation service + endpoint | backend | 4 |
| Webhook endpoint: signature verification, idempotent processing, audit log | backend | 6 |
| Payment status + history endpoints | backend | 3 |
| Refund initiation + webhook-driven status updates | backend | 4 |
| Minimal receipt generation | backend | 3 |
| Ownership checks, auth wiring, rate limiting | backend | 2 |
| Backend tests (order creation, signature verification, idempotency, refunds) | qa | 6 |
| `react-native-razorpay` SDK integration + native linking (iOS/Android) | mobile | 4 |
| Checkout screen UI | mobile | 4 |
| Success/failure/cancel handling + retry UX | mobile | 4 |
| Payment history/receipts screen | mobile | 4 |
| Checkout/receipt/history design | design | 4 |
| Sandbox integration testing (test cards) | integration | 4 |
| Webhook registration + go-live checklist | integration | 2 |
| Mobile QA (iOS/Android, native SDK quirks) | qa | 4 |
| Full regression QA: failure paths, duplicate webhooks, refund reconciliation, tampering, network drop | qa | 8 |
| **Total** | | **68h** |

**Shared with:** Accessories Marketplace and Rental Marketplace both check out through this — build once.
**Risk:** Razorpay merchant KYC/account approval is outside engineering's control and can add days-to-weeks before webhooks can even go live.

---

## 3. Book Car Servicing (Appointment Booking)
*(60h, incl. a 13h reusable Booking Core)*

Today the app can only locate a garage on a map and show past service history — there's no way to actually book a slot. This is a full new booking system: an appointment model, garage availability, and a confirmation flow, none of which exist today.

| Task | Layer | Hours |
|---|---|---|
| Appointment/Booking Prisma model + migration | data-model | 3 |
| ServiceSlot/Availability model (garage, date, windows, capacity) | data-model | 3 |
| Seed/fixture data for garage slots | data-model | 1 |
| Create-booking endpoint w/ conflict check | backend | 4 |
| List/filter bookings endpoint | backend | 2 |
| Cancel/reschedule endpoint | backend | 3 |
| Garage availability endpoint (open slots by date range) | backend | 4 |
| Wire booking confirmation into notification service | backend | 3 |
| Auth/ownership + validation | backend | 2 |
| "Book Service" screen (garage/date/time selection) | mobile | 6 |
| Slot picker/calendar component | mobile | 3 |
| Confirmation screen | mobile | 2 |
| "My Appointments" screen (view/cancel/reschedule) | mobile | 5 |
| Add "Book Service" CTA into existing garage locator | mobile | 2 |
| Link completed booking → ServiceRecord creation | integration | 3 |
| End-to-end push/email confirmation wiring | integration | 2 |
| UI mockups (select, slot picker, confirmation, appointments) | design | 4 |
| Functional QA: conflicts, cancel/reschedule, timezone edge cases | qa | 6 |
| Regression QA on garage locator/service-history screens | qa | 2 |
| **Total** | | **60h** |

**Shared with:** this is where the reusable Booking/Reservation Core (13h of the above) gets built — Rental Marketplace and Outstation Driver reuse it afterward.
**Risk:** no garage has real slot/availability data today (Places gives location only) — garages likely need manual onboarding or a placeholder fixed-slot model, which could shift scope.

---

## 4. Roadside Assistance (Towing/Mechanic Dispatch)
*(50h adjusted / 53h raw)*

SOS alerting itself already works — a real backend fires SMS/voice/email and looks up nearby help via Google Places. What's missing is dispatch: no vendor database, no way to actually assign and track a tow truck or mechanic. "Nearby Help" today is just a tap-to-call list (and can even show a fabricated fake listing when Places returns nothing).

| Task | Layer | Hours |
|---|---|---|
| ServiceProvider + DispatchRequest models, linked to SOSRequest | data-model | 4 |
| Vendor management API (CRUD + seed list) | backend | 4 |
| Nearest-available-vendor matching engine w/ timeout/reassignment | backend | 9 |
| Job-status lifecycle API w/ Socket.io events + push | backend | 6 |
| Vendor SMS notification w/ accept/reject link | integration | 4 |
| Fix safety bug: remove fake hospital/police fallback in `getMockHelp()` | backend | 2 |
| Mobile: "Book roadside assistance" flow | mobile | 6 |
| Mobile: live dispatch tracking screen | mobile | 6 |
| Design: booking + live tracking UX | design | 4 |
| QA: full dispatch flow, no-vendor/reject/timeout/cancel edge cases, push/socket reliability | qa | 8 |
| **Total** | | **53h** |

**Shared with:** reuses the generic accept/dispatch pattern from Valet — saves 3h.
**Risk:** assumes no dedicated vendor-facing app (ops manually flips status); a real vendor portal would add 40+ hours. Vendor contracts/coverage/vetting are a business dependency outside engineering hours.

---

## 5. Trip & Travel — Real Weather, Rates & Itinerary
*(31h)*

The trip planner already does real work — live toll/route costing and real hotel/transport search via Google Places. Three specific pieces are fake: weather is hardcoded/random despite a working weather service sitting unused nearby, hotel "Live Rates" are synthetic markup math instead of real quotes, and the daily itinerary is one identical template for every destination.

| Task | Layer | Hours |
|---|---|---|
| Wire existing weather service into trip planner, replace hardcoded/random weather | backend | 5 |
| Map weather response shape to what the UI expects, handle API failure | integration | 2 |
| Fix hotel list: replace synthetic "Live Rates" markup with an honestly-labeled estimate | mobile | 4 |
| Rebuild itinerary generator: real per-destination, per-day plan via Places | mobile | 8 |
| Loading states for now-async itinerary generation, price-label polish | design | 3 |
| QA: weather across routes/toll points, real vs. random variation, API-failure fallback | qa | 3 |
| QA: itinerary across varied destinations, multi-day trips | qa | 3 |
| QA: full trip planner regression | qa | 3 |
| **Total** | | **31h** |

**Risk:** if "Live Rates" needs to mean true real-time third-party pricing (not an honest Places-based estimate), that's a separate, unbounded vendor-integration project (Booking.com/Amadeus-class), not included here.

---

## 6. Hire Driver (local, on-demand)
*(107h)*

Lets a customer book a vetted driver for their own car locally. Zero code exists for this anywhere — no driver profile, matching, or dispatch mechanism exists yet for any feature in the app, so this build also has to produce the first version of that shared dispatch pattern.

| Task | Layer | Hours |
|---|---|---|
| Driver profile model (vehicle-class, license, rating, vetting) extending existing KYC model | data-model | 3 |
| DriverAvailability model | data-model | 2 |
| Extend generic request model for driver-hire bookings | data-model | 3 |
| Shared provider accept/dispatch pattern (reused by Valet + SOS) | backend | 8 |
| Driver onboarding/vetting endpoints | backend | 5 |
| Availability toggle + schedule endpoints | backend | 4 |
| Matching/dispatch logic (nearest vetted driver, timeout/no-match) | backend | 8 |
| Booking endpoints (create/assign/accept/reject/complete/cancel/fare) | backend | 6 |
| Push notification hookup for driver alerts | backend | 3 |
| Mobile: request-a-driver screen | mobile | 6 |
| Mobile: matching status + confirmed + trip tracking | mobile | 7 |
| Mobile: driver profile/document upload UI | mobile | 6 |
| Mobile: driver availability toggle | mobile | 3 |
| Mobile: driver incoming-request accept/reject UI | mobile | 5 |
| Mobile: driver active/complete-trip screen | mobile | 4 |
| End-to-end wiring (request→match→notify→accept→status→complete) | integration | 10 |
| UX/wireframes, both customer and driver sides | design | 8 |
| QA: booking/matching/accept flow, decline/timeout/no-drivers/cancel edge cases | qa | 10 |
| QA: vetting/admin approval + regression | qa | 6 |
| **Total** | | **107h** |

**Risk:** the shared accept/dispatch pattern doesn't exist yet anywhere (not even for Valet) — building it here first absorbs the schedule risk of getting it right.

---

## 7. Hire Driver for Trip (outstation/multi-day)
*(77h adjusted / 80h raw)*

A driver for multi-day, distance-priced trips, meant to sit inside the Trip & Travel flow as an add-on rather than duplicate local Hire Driver's matching logic. Scoped as an **incremental build on top of #6**, assuming that feature ships first.

| Task | Layer | Hours |
|---|---|---|
| Extend driver schema with outstation rates (per-km/day/night-halt) + multi-day calendar | data-model | 4 |
| OutstationBooking model (date range, distance, fare breakdown, trip link) | data-model | 4 |
| Fare/pricing engine (distance + day + night-halt, rate overrides) | backend | 8 |
| Extend matching/availability for date-range queries | backend | 8 |
| Booking endpoints: quote/create/extend/cancel/status | backend | 8 |
| Booking notifications (reuse existing service) | backend | 3 |
| Pull route distance/dates from Trip Planner to prefill quote | integration | 4 |
| Mobile: "Hire outstation driver" add-on entry point in trip flow | mobile | 5 |
| Mobile: outstation booking screen (dates, fare breakdown, driver list) | mobile | 10 |
| Mobile: wire selection into trip state + summary | mobile | 7 |
| Mobile: adapt Hire Driver's chat/tracking screens for multi-day context | mobile | 4 |
| Design: quote, confirmation, entry-point screens | design | 4 |
| QA: pricing accuracy, date-range edge cases, booking lifecycle, trip planner regression | qa | 8 |
| QA: iOS/Android pass | qa | 3 |
| **Total** | | **80h** |

**Hard dependency:** #6 (Hire Driver) must ship first — this is not independently schedulable.

---

## 8. Rent a Car/Bike — Dealer Listings, Booking & Locate
*(80h adjusted / 88h raw)*

Today the app can find nearby rental shops via Google Places with a rough price estimate from a hardcoded lookup table — no real inventory, no real prices, no way to reserve. Needs a dealer/inventory system and a real booking flow to replace today's "estimate only" locator.

| Task | Layer | Hours |
|---|---|---|
| Dealer + RentalListing + Booking models + migration | data-model | 4 |
| Seed/fixture data for dealers/listings | data-model | 2 |
| Dealer listing CRUD API (dealer-role auth) | backend | 8 |
| Availability engine (date-range overlap vs. existing bookings) | backend | 5 |
| Replace synthetic pricing with real geo-radius query against listings | backend | 5 |
| Wire booking confirmation/cancellation into notifications | backend | 3 |
| API tests + docs | qa | 2 |
| Update rental locator UI to consume real listings | mobile | 4 |
| Listing detail + booking flow UI (dates, price, confirm) | mobile | 10 |
| "My Bookings" screen | mobile | 6 |
| Dealer-facing listing management screens | mobile | 8 |
| Payment hookup for deposit/payment | integration | 6 |
| Dealer + booking-flow UX (empty/error/no-inventory/confirmed/cancelled states) | design | 6 |
| End-to-end QA: booking, double-booking prevention, cancellation, timezone | qa | 8 |
| Regression QA comparing new real pricing vs. old synthetic estimate | qa | 3 |
| **Total** | | **88h** |

**Shared with:** reuses the Booking/Reservation Core from Book Car Servicing — saves 8h.
**Risk:** biggest open question is who "dealers" are operationally (existing partners vs. self-serve signup) — onboarding logistics sit outside engineering time.

---

## 9. Car Owner Reviews
*(41h)*

No first-party review or rating exists anywhere — only raw, unmoderated Google ratings for mechanic/car-wash results. A ground-up build: model, submission UI, and basic anti-abuse since it's public user-generated content.

| Task | Layer | Hours |
|---|---|---|
| Review/Rating model + migration | data-model | 3 |
| CRUD API (create/list/edit own/delete own) | backend | 6 |
| Aggregate rating calculation per target | backend | 3 |
| Rate limiter on submission (extend existing config) | backend | 2 |
| Report/flag endpoint + admin hide endpoint | backend | 4 |
| Submission UI (star picker + text) | mobile | 5 |
| Review list/display UI w/ average + empty state | mobile | 4 |
| Report-review UI + my-reviews management | mobile | 3 |
| Star component, review card, report modal design | design | 3 |
| Wire screens to endpoints, error/loading/empty states | integration | 3 |
| QA: submit/edit/delete/report, rate-limit behavior, admin hide, cross-device | qa | 5 |
| **Total** | | **41h** |

**Risk:** scope grows fast if moderation needs to go beyond report+hide, or if reviews must be gated to verified completed bookings (which needs an order-history model not fully built yet).

---

## 10. Message Vehicle Owner (QR Code — Anonymous Contact Relay)
*(64h core / +20h optional masked-calling stretch)*

Not generic person-to-person chat — a QR code displayed on the vehicle that **anyone**, even someone without the app, can scan to reach the owner (car's blocking them, minor accident, found something) without either side ever seeing the other's real phone number. Nothing here is built yet: `Mobile/src/screens/Other/QRCode.tsx` is an empty placeholder with no navigation reference, and no QR generation or scanning library is installed anywhere. The one real asset to build on: `Backend/src/modules/customer/customer.routes.ts` already has two routes deliberately placed *outside* auth middleware and keyed only by vehicle identifier (used for valet location) — exactly the "a stranger with no account can hit this, safely" shape this feature needs.

| Task | Layer | Hours |
|---|---|---|
| `VehicleQRToken` model (per-vehicle opaque token, rotatable) + migration | data-model | 3 |
| `QRContactMessage` model (token, message text, optional photo, status) + migration | data-model | 2 |
| Token generate/rotate endpoint (owner-authenticated) | backend | 3 |
| Public endpoint: resolve token → confirm the vehicle exists, no owner PII returned — reuses the existing no-auth-middleware route pattern | backend | 2 |
| Public endpoint: accept a contact message against a token | backend | 4 |
| Rate limiting / abuse prevention on both public (unauthenticated) endpoints | backend | 3 |
| Wire owner push/in-app notification when a new contact message arrives | backend | 2 |
| Add a QR-generation library + "My QR Code" screen (display/download/print per vehicle) | mobile | 5 |
| Add a QR/barcode-scanning library (native linking) + in-app scanner screen | mobile | 6 |
| In-app "Contact Owner" composer (message + optional photo) | mobile | 4 |
| Owner-side "Vehicle Messages" inbox screen | mobile | 5 |
| Public web fallback page for scanners without the app (mobile-responsive, no login, message form) | integration | 8 |
| Deep-link handling: QR opens the app if installed, else falls back to the web page | integration | 4 |
| Design: QR display card, scan flow, contact form (web + app), owner inbox | design | 5 |
| End-to-end QA: generate→print→scan-in-app; scan-with-bare-camera→web fallback; message delivery; token rotation/security (can't be guessed/enumerated); abuse/rate-limit testing | qa | 8 |
| **Total (core, message-only)** | | **64h** |

**Optional stretch — masked calling** (scanner can also *call* the owner, neither side sees the real number): no Twilio Proxy / number-masking exists anywhere today — only plain send-SMS/send-call to a number you already have — so this is genuinely new integration, not reuse. Adds **~20h** (Twilio Proxy session setup, call-bridging endpoint, webhook handling for call state, UI, QA). Recommend deferring to a fast-follow rather than folding into this window.

**Risk:** the public web fallback page is real new surface area — there's no existing public-facing (non-admin) web frontend anywhere in this codebase to extend, so it's a small standalone build, not a config tweak. Token security matters here more than most features: a guessable/enumerable token would let a stranger message any vehicle's owner, not just the one they scanned.

---

## 11. Accessories Marketplace
*(121h)*

"Accessories" is currently just an expense-tracking label. This is a full e-commerce build from scratch — catalog, cart, checkout, vendor/inventory management — with checkout reusing the payment gateway from #2 rather than a second integration.

| Task | Layer | Hours |
|---|---|---|
| Vendor/Product/Category/Inventory/Cart/Order schema | data-model | 6 |
| Migration + seed data | data-model | 3 |
| Vendor CRUD (admin-facing) | backend | 6 |
| Product/catalog CRUD + search/filter | backend | 8 |
| Inventory/stock tracking (reserve/decrement) | backend | 5 |
| Cart APIs | backend | 6 |
| Checkout/order creation + status machine | backend | 8 |
| Wire checkout to shared payment gateway | integration | 4 |
| Order history/tracking endpoints | backend | 4 |
| Admin order management | backend | 5 |
| Catalog/product/cart/checkout/tracking design | design | 10 |
| Mobile: catalog browse (grid, filter, search) | mobile | 8 |
| Mobile: product detail | mobile | 5 |
| Mobile: cart UI | mobile | 6 |
| Mobile: checkout flow | mobile | 8 |
| Mobile: order history/tracking | mobile | 5 |
| Mobile payment checkout integration | integration | 5 |
| Order status push notifications | integration | 3 |
| QA: full browse→cart→checkout→order flow | qa | 8 |
| QA: out-of-stock, payment failure/retry, inventory races | qa | 5 |
| **Total** | | **121h** |

**Hard dependency:** #2 (Customer Payments) must ship first, or this loses its "integration only" assumption and absorbs full gateway build time.

---

## 12. Sell Used Cars (Vehicle Marketplace)
*(102h)*

Lets users list a car for sale and buyers browse/search/inquire — a used-car marketplace inside the app. Only make/model/variant reference data and some vehicle-detail UI patterns are reusable; listings, valuation, browse/search, and buyer contact are all new.

| Task | Layer | Hours |
|---|---|---|
| Listing/ListingPhoto/Inquiry models + migration | data-model | 4 |
| Marketplace search indexing on reference data | data-model | 2 |
| Listing CRUD (draft/publish/mark-sold, ownership checks) | backend | 8 |
| Photo upload handling (multi-image) | backend | 5 |
| Public browse/search/filter endpoint | backend | 6 |
| Rule-based valuation estimate endpoint (no ML) | backend | 6 |
| Lightweight buyer-seller inquiry model + endpoints | backend | 6 |
| "Sell Your Car" listing creation flow | mobile | 10 |
| My Listings management screen | mobile | 5 |
| Public marketplace browse screen | mobile | 8 |
| Listing detail screen (photos, price, contact seller) | mobile | 6 |
| Inquiry/contact-seller UI + seller inbox | mobile | 6 |
| Valuation estimate UI | mobile | 4 |
| Wire screens to endpoints, upload progress | integration | 6 |
| Listing card, browse grid, filters, sell-flow, inbox design | design | 8 |
| QA: create/edit/delete, search accuracy, valuation edge cases, inquiry, upload | qa | 8 |
| QA: basic abuse/moderation checks | qa | 4 |
| **Total** | | **102h** |

**Risk:** if photo/upload infra doesn't already exist in the backend, add 6-8h. Valuation here is a simple rule-based estimate — real market-data pricing is a separate, larger project.

---

## 13. Community
*(70h)*

No community/feed/forum exists at all. Recommend an MVP: a single vehicle-model-specific feed (text + photo posts, likes, comments, basic reporting) rather than a full social network.

| Task | Layer | Hours |
|---|---|---|
| Post/Comment/Like/Report models + migration | data-model | 3 |
| Post CRUD (feed scoped to vehicle model) | backend | 6 |
| Comment endpoints | backend | 3 |
| Like/unlike + count aggregation | backend | 2 |
| Wire post images to existing upload infra | backend | 2 |
| Report/flag + admin hide endpoint | backend | 4 |
| Feed pagination | backend | 2 |
| Basic spam/rate-limit guard | backend | 2 |
| Backend tests | qa | 4 |
| Community tab + navigation | mobile | 2 |
| Feed list (infinite scroll, pull-to-refresh, states) | mobile | 6 |
| Create Post screen | mobile | 4 |
| Post detail + comment thread | mobile | 5 |
| Like button (optimistic UI) | mobile | 2 |
| Report/flag modal | mobile | 2 |
| API wiring/hooks | mobile | 3 |
| End-to-end image upload flow | integration | 2 |
| Push notification hook for comments/likes | integration | 2 |
| Feed card, composer, thread, report modal design | design | 6 |
| Full functional + moderation QA, iOS/Android | qa | 8 |
| **Total** | | **70h** |

---

# Phase 2 — Revenue Services
*(428h across 11 in-scope features — Garage Finder and Warranty Management are already built and excluded, per the backlog.)*

## 1. Insurance
*(56h)*

No policy, quote, or claim model exists — only a document-upload slot and a dead "Insurance Help" tile that does nothing when tapped. This builds policy management, a rule-based/manual quote request, and claim submission + tracking; a live multi-insurer price-comparison engine is a separate, unbounded integration (see Risk).

| Task | Layer | Hours |
|---|---|---|
| Policy/Quote/Claim models + migration | data-model | 4 |
| Link to existing document-upload slot | data-model | 2 |
| Policy CRUD API (add/renew/view) | backend | 5 |
| Quote-request endpoint (rule-based estimate / manual aggregator routing) | backend | 5 |
| Claim submission + status-tracking endpoints | backend | 6 |
| Renewal-reminder cron job | backend | 3 |
| Wire "Insurance Help" tile to the real flow | mobile | 2 |
| Add-policy screen (view/add/upload) | mobile | 5 |
| Quote-request UI | mobile | 4 |
| Claim submission + tracking UI | mobile | 5 |
| Renewal-reminder notification wiring | integration | 2 |
| Design: policy dashboard, quote flow, claim flow | design | 5 |
| QA: policy CRUD, quote, claim lifecycle, renewal reminders | qa | 6 |
| Regression QA on existing document-upload slot | qa | 2 |
| **Total** | | **56h** |

**Risk:** real insurer-API price comparison (live multi-insurer quotes) is out of scope here — this delivers policy management, manual/estimate quotes, and claims tracking; a real aggregator integration is a separate vendor-partnership project.

---

## 2. FASTag (real NETC/NPCI balance & recharge)
*(44h)*

What exists today is bank-account penny-drop verification wearing a FASTag label — there's no tag ID or balance field in the database at all. This replaces it with a real NETC/FASTag aggregator integration: tag linking, live balance, and recharge.

| Task | Layer | Hours |
|---|---|---|
| FastagAccount model (tag ID, vehicle link, cached balance) + migration | data-model | 3 |
| NETC/FASTag aggregator API account + SDK setup | backend | 3 |
| Tag-linking endpoint (replaces penny-drop verification) | backend | 4 |
| Balance-check endpoint (live call + cache) | backend | 4 |
| Recharge order + webhook endpoint | backend | 5 |
| Low-balance alert job | backend | 3 |
| Remove penny-drop verification flow | backend | 2 |
| Mobile: link-tag screen (replaces bank-verification UI) | mobile | 4 |
| Mobile: balance + recharge screen | mobile | 5 |
| Mobile: low-balance push notification handling | mobile | 2 |
| Design: tag-link, balance, recharge screens | design | 3 |
| QA: linking, balance accuracy, recharge, webhook idempotency | qa | 6 |
| **Total** | | **44h** |

**Shared with:** recharge checkout reuses the Customer Payments gateway (Phase 1 #2) rather than a second payment integration.
**Risk:** entirely dependent on getting NETC/FASTag aggregator API access — an NPCI-side vendor onboarding process outside engineering's control, similar in shape to the Razorpay KYC risk in Phase 1.

---

## 3. Challan Payment
*(29h)*

Challan *checking* is already built and real (Phase 1 #16). Paying one isn't: "Pay Now" is an empty function, and the backend's mark-as-paid endpoint has no payment verification or ownership check.

| Task | Layer | Hours |
|---|---|---|
| Extend Challan model with payment/transaction linkage | data-model | 2 |
| Wire "Pay Now" to real order creation via Customer Payments gateway | backend | 3 |
| Payment verification + ownership check on mark-as-paid endpoint | backend | 3 |
| Webhook-driven challan-status update | backend | 3 |
| Government challan-payment gateway/aggregator integration | integration | 6 |
| Mobile: wire Pay Now button to checkout | mobile | 3 |
| Mobile: payment status/receipt on challan screen | mobile | 2 |
| Design: payment-flow additions to existing challan screen | design | 2 |
| QA: payment success/failure, ownership-bypass attempts, webhook idempotency | qa | 5 |
| **Total** | | **29h** |

**Shared with:** reuses the Customer Payments gateway (Phase 1 #2).
**Risk:** most state e-challan/Parivahan portals require a specific licensed aggregator to actually collect payment — that vendor relationship is a business dependency that can block go-live independent of the code being done.

---

## 4. RTO Services
*(37h)*

All three RTO screens and the service file are one-line placeholder stubs, never wired in, with zero backend routes. Scoped here as a request-tracking + document-relay workflow (RC transfer, duplicate RC, address change, etc.) backed by manual back-office processing — there's no direct RTO/Parivahan API for most of these services.

| Task | Layer | Hours |
|---|---|---|
| RTOServiceRequest model (type, documents, status) + migration | data-model | 3 |
| Service-type catalog config (RC transfer/duplicate/address-change, etc.) | data-model | 2 |
| Request creation + document-attach endpoint | backend | 4 |
| Status tracking + admin status-update endpoint | backend | 4 |
| Notification wiring on status change | backend | 2 |
| Mobile: wire the 3 existing stub screens to the real flow | mobile | 6 |
| Mobile: request-status tracking screen | mobile | 4 |
| Mobile: document-upload UI | mobile | 3 |
| Design: request flow, status tracker | design | 4 |
| QA: request lifecycle, document upload, status notifications | qa | 5 |
| **Total** | | **37h** |

**Risk:** if the expectation is a real automated Parivahan/RTO API rather than a manually-processed request-and-track workflow, that's a different (and likely blocked-on-government-access) project, not this one.

---

## 5. Car Washing (booking)
*(30h)*

A working locator tab already exists in one screen, but the home screen separately labels Car Wash "Coming Soon" — and there's no booking either way. This adds real slot booking and reconciles the two inconsistent entry points.

| Task | Layer | Hours |
|---|---|---|
| CarWashSlot/Booking model (reusing Booking Core where possible) + migration | data-model | 3 |
| Seed wash-provider slot data | data-model | 1 |
| Booking create/cancel endpoints | backend | 4 |
| Availability endpoint | backend | 3 |
| Wire booking confirmation into notifications | backend | 2 |
| Remove "Coming Soon" label, unify with the working locator tab | mobile | 2 |
| Booking flow UI (slot picker, confirm) | mobile | 5 |
| "My Wash Bookings" screen | mobile | 3 |
| Design: booking flow, unified home-screen entry point | design | 3 |
| QA: booking lifecycle, home-screen/locator consistency | qa | 4 |
| **Total** | | **30h** |

**Shared with:** reuses the Booking/Reservation Core built for Book Car Servicing (Phase 1 #3) — already reflected in the lower hour count above vs. a standalone booking build.

---

## 6. ANPR-based Parking Entry/Exit
*(30h)*

No number-plate-recognition code exists anywhere in the app. This is the consumer-facing half only — automatic entry/exit sessions and billing — and assumes the ANPR recognition service itself (Phase 4, AI & automation) already exists and is emitting plate-read events.

| Task | Layer | Hours |
|---|---|---|
| ParkingSession model (plate, entry/exit timestamp, linked booking) + migration | data-model | 3 |
| Entry/exit webhook endpoint consuming ANPR recognition events | backend | 4 |
| Auto-match session to an active booking, fallback for unmatched plates | backend | 5 |
| Auto-billing/fare-calc on exit for un-prebooked sessions | backend | 4 |
| Mobile: live "vehicle checked in/out" notification | mobile | 3 |
| Mobile: parking-session receipt screen | mobile | 3 |
| Design: entry/exit notification, session receipt | design | 2 |
| QA: matched/unmatched plate, misread edge cases, billing accuracy | qa | 6 |
| **Total** | | **30h** |

**Hard dependency:** Phase 4's ANPR Vehicle Recognition must exist first — this consumes that event stream and isn't independently buildable. Also depends on Phase 1 Parking (#1) for booking-session matching. Under the sequential ordering in this doc, Phase 4 ships *after* Phase 2 — so despite its Phase 2 number, this feature can't actually complete until a slice of Phase 4 lands. Treat it as a Phase-4-adjacent feature, not a Phase-2 one, if build order matters to you.

---

## 7. Car Loan
*(39h)*

No EMI calculator, lender integration, or loan flow exists — "EMI" today is only an expense-category label. Scoped as an EMI calculator plus an application/quote-routing flow; without a real lending-partner API, "quote" here means manual/estimate routing, not live approval.

| Task | Layer | Hours |
|---|---|---|
| LoanApplication/LenderQuote model + migration | data-model | 3 |
| EMI calculator endpoint (rate/tenure/principal math) | backend | 3 |
| Loan application submission + document endpoints | backend | 5 |
| Lender-quote stub / manual-partner routing | backend | 4 |
| Application status-tracking endpoint | backend | 3 |
| Mobile: EMI calculator UI | mobile | 4 |
| Mobile: loan application form + document upload | mobile | 5 |
| Mobile: application status-tracking screen | mobile | 3 |
| Design: calculator, application flow, status tracker | design | 4 |
| QA: EMI math accuracy, application lifecycle, document upload | qa | 5 |
| **Total** | | **39h** |

**Risk:** real lender integration (a bank/NBFC partner API for live approval) is a separate business/vendor project — this delivers calculation + application-routing infrastructure, not automated underwriting.

---

## 8. Digital Invoice History
*(30h)*

Service history and expense records are real, but no formal invoice is ever generated — the Invoice DB model exists and sits unpopulated.

| Task | Layer | Hours |
|---|---|---|
| Wire existing Invoice model to Service History + Expense completion events | backend | 5 |
| Invoice-numbering/sequencing + PDF generation service | backend | 6 |
| Invoice list/detail endpoints | backend | 3 |
| Mobile: invoice list screen | mobile | 4 |
| Mobile: invoice detail/download/share | mobile | 4 |
| Design: invoice list, PDF template | design | 3 |
| QA: invoice generation accuracy across service/expense sources, PDF rendering, missing-data edge cases | qa | 5 |
| **Total** | | **30h** |

---

## 9. Fleet Dashboard
*(52h)*

No multi-vehicle B2B billing code exists, and the underlying billing models aren't wired to anything. This is effectively a small B2B feature bolted onto the consumer app — including a fleet-manager role that doesn't exist today.

| Task | Layer | Hours |
|---|---|---|
| FleetAccount/FleetVehicle/FleetBilling models + migration | data-model | 4 |
| Wire existing (unused) billing models into the fleet account | data-model | 3 |
| Fleet-account CRUD + multi-vehicle linking endpoints | backend | 6 |
| Aggregate usage/cost rollup endpoint across linked vehicles | backend | 6 |
| Consolidated billing/invoice generation for fleet accounts | backend | 5 |
| Admin/fleet-manager role + permission model | backend | 4 |
| Fleet dashboard UI (vehicle list, aggregate cost, alerts) | mobile | 8 |
| Fleet billing/invoice screen | mobile | 4 |
| Design: fleet dashboard, billing screens | design | 5 |
| QA: multi-vehicle aggregation accuracy, billing consolidation, permission boundaries | qa | 7 |
| **Total** | | **52h** |

**Risk:** who's allowed to manage a fleet account (role/permission model) is a product decision that doesn't exist yet and will shape the backend more than the estimate above assumes if it's more complex than a single "fleet manager" role.

---

## 10. PUC Certificate Tracking & Renewal Reminders
*(28h)*

PUC status today is a one-time byproduct field from RC verification — never re-checked, no reminder job.

| Task | Layer | Hours |
|---|---|---|
| PUCCertificate model (separate from the one-time byproduct field) + migration | data-model | 3 |
| Backfill existing byproduct field into the new model | data-model | 2 |
| Periodic PUC-status recheck job (re-query verification source on interval) | backend | 5 |
| Renewal-reminder scheduling logic | backend | 3 |
| Manual PUC-upload/update endpoint (fallback when auto-recheck unavailable) | backend | 2 |
| Mobile: PUC status card + history | mobile | 4 |
| Mobile: renewal reminder notification + manual-update UI | mobile | 3 |
| Design: PUC status card, reminder notification | design | 2 |
| QA: recheck-job accuracy, reminder timing, manual-update fallback | qa | 4 |
| **Total** | | **28h** |

**Risk:** recurring automated recheck assumes the same government verification source used for one-time RC checks supports repeat/periodic queries at acceptable cost and rate limits — unconfirmed.

---

## 11. Subscription Plans
*(53h)*

No paywall, plan/tier logic, or recurring-billing handling exists anywhere.

| Task | Layer | Hours |
|---|---|---|
| Plan/Subscription/Entitlement models + migration | data-model | 4 |
| Plan-tier config (which features are gated per tier) | data-model | 2 |
| Subscription create/renew/cancel endpoints, wired to Customer Payments gateway | backend | 6 |
| Recurring billing via Razorpay subscriptions/mandates | backend | 6 |
| Entitlement-check middleware (gate features by active plan) | backend | 5 |
| Webhook handling for renewal/failure/dunning | backend | 5 |
| Mobile: plan comparison/upgrade screen | mobile | 5 |
| Mobile: subscription management screen (cancel/change plan) | mobile | 4 |
| Mobile: paywall/upsell prompts on gated features | mobile | 4 |
| Design: plan comparison, paywall, management screens | design | 5 |
| QA: entitlement-gating accuracy, renewal/dunning/cancellation, webhook idempotency | qa | 7 |
| **Total** | | **53h** |

**Shared with:** billing/webhook plumbing reuses the Customer Payments gateway (Phase 1 #2).
**Risk:** what's actually gated behind a paywall is a product decision — this estimate assumes that list is already decided going in.

---

# Phase 3 — Automotive Ecosystem
*(267h across all 7 features — 0 built, 0 partial per the backlog, so all 7 are in scope.)*

## 1. Buy New Cars
*(55h)*

No listings or purchase flow exists anywhere. Scoped as a new-car catalog sourced from dealer inventory plus a test-drive/inquiry request — not in-app checkout, since actual car purchases are financed/dealer-handled, not a cart transaction.

| Task | Layer | Hours |
|---|---|---|
| NewCarListing (dealer-sourced, variant/trim/price) model + migration | data-model | 4 |
| Dealer new-car inventory CRUD API (dealer-role auth) | backend | 6 |
| Public browse/search/filter (make/model/variant/price/location) | backend | 5 |
| Test-drive/inquiry request endpoint | backend | 4 |
| Mobile: new-car browse/catalog screen | mobile | 8 |
| Mobile: new-car detail screen (variants, specs, price) | mobile | 6 |
| Mobile: test-drive/inquiry request UI | mobile | 4 |
| Dealer-facing inventory management screens | mobile | 6 |
| Design: catalog, detail, inquiry, dealer management | design | 6 |
| QA: browse/search accuracy, inquiry flow, dealer CRUD | qa | 6 |
| **Total** | | **55h** |

**Shared with:** establishes the Dealer + Listing pattern reused by Dealer Listings (#2) and Vehicle Marketplace (#3) below.

---

## 2. Dealer Listings
*(37h)*

No dealer feed exists anywhere. Scoped as generalizing the Dealer model (first introduced by Buy New Cars, above) into a first-class entity with self-serve onboarding and a cross-category profile page, rather than a second one-off dealer table.

| Task | Layer | Hours |
|---|---|---|
| Generalize Dealer model into a shared entity (profile, category, verification status) + migration | data-model | 4 |
| Dealer self-serve signup/onboarding endpoint | backend | 5 |
| Dealer verification/admin-approval workflow | backend | 4 |
| Public dealer-profile endpoint (listings across categories) | backend | 4 |
| Mobile: dealer profile page (all listings across categories) | mobile | 6 |
| Mobile: dealer self-serve signup flow | mobile | 5 |
| Design: dealer profile, signup/onboarding flow | design | 4 |
| QA: onboarding, verification, cross-category profile aggregation | qa | 5 |
| **Total** | | **37h** |

**Shared with:** generalizes the Dealer entity already introduced by Buy New Cars (and, in Phase 1, by Parking and Rent a Car/Bike) — building this after those means less rework than building it first.

---

## 3. Vehicle Marketplace
*(36h)*

"Vehicle Search" today only searches vehicles you've already registered — not a marketplace. This is a unified discovery layer spanning new-car inventory (#1, above) and the used-car listings already built in Phase 1's Sell Used Cars (#12).

| Task | Layer | Hours |
|---|---|---|
| Unified search index spanning new-car and used-car listing models | data-model | 4 |
| Combined browse/search/filter endpoint (type=new\|used, cross-model) | backend | 6 |
| Ranking/sort logic (price, distance, recency) | backend | 3 |
| Mobile: unified marketplace home/browse screen | mobile | 8 |
| Mobile: filter UI (new vs. used, price, location, make/model) | mobile | 5 |
| Design: unified marketplace browse, filter UI | design | 5 |
| QA: cross-source search accuracy, filter correctness, performance at scale | qa | 5 |
| **Total** | | **36h** |

**Hard dependency:** Buy New Cars (#1) and Phase 1's Sell Used Cars must exist first — this is a discovery layer on top of both, not independently buildable.

---

## 4. AI Vehicle Recommendations
*(33h)*

The only existing "AI" in this space is a deterministic if/else point-penalty system nudging maintenance on a car you already own — not a purchase-decision engine. Scoped as a rule/heuristic-based v1, consistent with how the rest of the app implements "AI" features; a trained ML recommendation model is a separate, larger data-science project.

| Task | Layer | Hours |
|---|---|---|
| Define recommendation feature set (usage, budget, existing vehicle, browse history) | data-model | 3 |
| Recommendation-request/result logging model + migration | data-model | 2 |
| Rule/heuristic-based recommendation engine v1 | backend | 8 |
| Recommendation API endpoint | backend | 4 |
| Mobile: "Recommended for you" surface on marketplace home | mobile | 5 |
| Mobile: recommendation reasoning UI ("why this car") | mobile | 3 |
| Design: recommendation cards, reasoning UI | design | 3 |
| QA: relevance spot-checks, edge cases (no history, new user) | qa | 5 |
| **Total** | | **33h** |

**Risk:** "AI" here means rule/heuristic, not a trained model — flag explicitly if a real ML recommendation system is expected instead.

---

## 5. Personalized Upgrade Recommendations
*(23h)*

Same underlying gap as #4 above — no upgrade/purchase recommendation engine exists. Scoped as reusing that engine in a different mode: recommending accessories/upgrades for a vehicle you already own.

| Task | Layer | Hours |
|---|---|---|
| Extend the recommendation engine with an "owned vehicle → upgrade" mode | backend | 5 |
| Map upgrade recommendations to the Accessories Marketplace catalog | integration | 4 |
| Recommendation-surfacing endpoint | backend | 3 |
| Mobile: "Upgrades for your car" surface (vehicle detail / home) | mobile | 5 |
| Design: upgrade recommendation cards | design | 2 |
| QA: relevance, catalog-linkage correctness | qa | 4 |
| **Total** | | **23h** |

**Shared with:** reuses the recommendation engine built for AI Vehicle Recommendations (#4) — build that first.
**Hard dependency:** Accessories Marketplace (Phase 1 #11) must exist to have anything to recommend.

---

## 6. AI Instant Vehicle Valuation
*(42h)*

A genuinely different tier from Phase 1's rule-based valuation inside Sell Used Cars — this is meant to be a real market-data-backed estimate, not a formula. The dominant cost and risk here is licensing a real used-car pricing feed, not the model itself.

| Task | Layer | Hours |
|---|---|---|
| Market-data source integration (used-car pricing feed/aggregator) | integration | 8 |
| Valuation model v1: regression on make/model/year/km/condition + market data | backend | 8 |
| Valuation-request/result caching model + migration | data-model | 3 |
| Valuation API endpoint | backend | 4 |
| Mobile: "Instant Valuation" flow (enter details → estimate) | mobile | 6 |
| Mobile: valuation-history/comparison UI | mobile | 3 |
| Design: valuation flow, result screen | design | 4 |
| QA: accuracy spot-checks vs. market comps, edge cases (rare models, no data) | qa | 6 |
| **Total** | | **42h** |

**Risk:** depends on licensing a real used-car pricing/market-data feed — a vendor/data contract, not just engineering time, and the main driver of both cost and timeline here.

---

## 7. Shareable Vehicle Certification Report
*(41h)*

Depends on a Vehicle Digital Twin concept that doesn't exist yet either — nothing to make shareable without it.

| Task | Layer | Hours |
|---|---|---|
| CertificationReport model (compiled from service/inspection/warranty/valuation data) + migration | data-model | 4 |
| Report-generation service pulling from the Vehicle Digital Twin | backend | 6 |
| PDF/shareable-link generation + expiry/access control | backend | 5 |
| Public report-view endpoint (no-login, token-based) | backend | 3 |
| Mobile: "Generate Certification Report" flow | mobile | 5 |
| Mobile: share/download UI | mobile | 3 |
| Public web view page for shared report link | integration | 6 |
| Design: report layout, share flow | design | 4 |
| QA: report accuracy, link security/expiry, public-view rendering | qa | 5 |
| **Total** | | **41h** |

**Hard dependency:** Vehicle Digital Twin (Phase 4, Core job workflow group) must exist first — this cannot be built until that data model exists. Not independently schedulable within Phase 3; it's effectively blocked until a slice of Phase 4 ships, the same cross-phase issue flagged for Phase 2's ANPR Parking Entry/Exit.
**Shared with:** the public token-based view reuses the no-auth-route + opaque-token pattern from Message Vehicle Owner (Phase 1 #10).

---

# Phase 4 — GUPIO Garage Platform (B2B)
*(1,022h across 36 features, all not built. This is an operator-facing garage OS — a different product surface from the consumer app, confirmed absent at the schema level. "Web" below means a staff/garage-facing dashboard; "mobile" means a mechanic-facing handheld/tablet app — neither is the consumer Mobile app used elsewhere in this codebase. Given the scale and the fact that nothing here shares code with the consumer app, seriously consider running this as a separate team/track rather than literally sequencing it after Phase 3; the dates in the summary table are a default assumption, not a recommendation.)*

## Core job workflow (14 features, 402h)

### 1. Vehicle Check-in
*(33h)*

| Task | Layer | Hours |
|---|---|---|
| CheckIn model (vehicle, timestamp, odometer, fuel level, condition photos, bay) + migration | data-model | 3 |
| Check-in creation endpoint | backend | 4 |
| Photo/condition capture endpoint | backend | 3 |
| Bay/queue assignment on check-in | backend | 3 |
| Web: check-in kiosk/staff screen (odometer, photos, condition notes) | web | 8 |
| Mobile: customer check-in confirmation view | mobile | 3 |
| Design: check-in flow, condition capture UI | design | 4 |
| QA: check-in flow, photo capture, bay assignment | qa | 5 |
| **Total** | | **33h** |

---

### 2. Digital Job Cards
*(48h — foundational; almost everything else in this group hangs off it)*

| Task | Layer | Hours |
|---|---|---|
| JobCard model (linked to check-in, status lifecycle, line items) + migration | data-model | 5 |
| Job card creation/update/status-transition endpoints | backend | 8 |
| Job card line-item (labor/parts) sub-model + endpoints | backend | 6 |
| Job card list/filter/search endpoints | backend | 4 |
| Web: job card creation/detail screen | web | 8 |
| Web: job card list/queue view | web | 5 |
| Design: job card detail, list/queue views | design | 5 |
| QA: full job-card lifecycle, status transitions, line-item accuracy | qa | 7 |
| **Total** | | **48h** |

---

### 3. Vehicle Inspection
*(36h)*

| Task | Layer | Hours |
|---|---|---|
| Inspection model (checklist items, findings, photos) + migration | data-model | 4 |
| Configurable inspection-checklist template engine | backend | 6 |
| Inspection submission endpoint (findings + photos) | backend | 5 |
| Link inspection findings → job card line-item suggestions | integration | 4 |
| Mobile (mechanic tablet): inspection checklist UI | mobile | 8 |
| Design: checklist UI, findings capture | design | 4 |
| QA: checklist completeness, findings→estimate linkage, photo capture | qa | 5 |
| **Total** | | **36h** |

---

### 4. Repair Estimation
*(37h)*

| Task | Layer | Hours |
|---|---|---|
| Estimate model (line items, labor rate, parts cost, tax, versioning) + migration | data-model | 4 |
| Estimate generation from job card + inspection findings | backend | 6 |
| Estimate versioning/revision endpoints | backend | 4 |
| Labor-rate/parts-price lookup (integrates with Spare Parts Management) | integration | 4 |
| Web: estimate builder UI | web | 6 |
| Mobile: customer-facing estimate view | mobile | 4 |
| Design: estimate builder, customer estimate view | design | 4 |
| QA: estimate accuracy, versioning, price-lookup integration | qa | 5 |
| **Total** | | **37h** |

---

### 5. Customer Approval Workflow
*(28h)*

| Task | Layer | Hours |
|---|---|---|
| ApprovalRequest model (estimate link, status, customer response) + migration | data-model | 3 |
| Approval-request send + response endpoints | backend | 4 |
| Partial-approval (line-item-level accept/reject) logic | backend | 4 |
| Push/SMS notification on estimate-ready | integration | 3 |
| Mobile: approve/reject estimate screen (line-item level) | mobile | 6 |
| Design: approval screen, partial-approval UX | design | 3 |
| QA: full/partial approval flows, notification delivery | qa | 5 |
| **Total** | | **28h** |

---

### 6. Mechanic Workflow
*(32h)*

| Task | Layer | Hours |
|---|---|---|
| MechanicTask model (job-card line-item assignment, time tracking) + migration | data-model | 3 |
| Task assignment/accept/complete endpoints | backend | 5 |
| Time-tracking (clock in/out per task) endpoint | backend | 3 |
| Mobile: mechanic task list (assigned/in-progress/done) | mobile | 6 |
| Mobile: task detail + time-tracking UI | mobile | 5 |
| Design: mechanic task list, task detail | design | 4 |
| QA: assignment flow, time-tracking accuracy, offline/spotty-connectivity handling | qa | 6 |
| **Total** | | **32h** |

---

### 7. Smart Job Allocation
*(40h)*

| Task | Layer | Hours |
|---|---|---|
| Mechanic skill/specialty + availability model + migration | data-model | 4 |
| Allocation engine (match task → best-available mechanic by skill/load/bay) | backend | 10 |
| Re-allocation on mechanic unavailability/overload | backend | 5 |
| Allocation-override endpoint (manager manual reassign) | backend | 3 |
| Web: allocation board (drag-drop / auto-suggest) | web | 8 |
| Design: allocation board UX | design | 4 |
| QA: allocation correctness, rebalancing, manual override, load edge cases | qa | 6 |
| **Total** | | **40h** |

---

### 8. Repair Progress Tracking
*(24h)*

| Task | Layer | Hours |
|---|---|---|
| Progress-event model (status timeline per job card) + migration | data-model | 3 |
| Progress-update endpoint (mechanic/staff triggered) | backend | 3 |
| Real-time push of progress events (Socket.io) | backend | 4 |
| Mobile: customer-facing progress timeline screen | mobile | 6 |
| Design: progress timeline UI | design | 3 |
| QA: real-time update delivery, timeline accuracy | qa | 5 |
| **Total** | | **24h** |

---

### 9. Photo & Video Updates
*(24h)*

| Task | Layer | Hours |
|---|---|---|
| Media attachment model (linked to job card/inspection/progress event) + migration | data-model | 2 |
| Media upload endpoint (photo + short video, storage) | backend | 5 |
| Mobile (mechanic): capture + attach media to job card | mobile | 5 |
| Mobile (customer): media gallery/viewer on job card | mobile | 4 |
| Design: media capture UI, customer gallery | design | 3 |
| QA: upload reliability, large-file/video handling, gallery rendering | qa | 5 |
| **Total** | | **24h** |

---

### 10. Quality Control Checklist
*(19h)*

| Task | Layer | Hours |
|---|---|---|
| QC checklist template + submission model + migration | data-model | 3 |
| QC submission endpoint; gate job-card completion on QC pass | backend | 4 |
| Mobile: QC checklist UI for reviewing mechanic | mobile | 5 |
| Design: QC checklist UI | design | 2 |
| QA: checklist enforcement, gating logic, failed-QC re-open flow | qa | 5 |
| **Total** | | **19h** |

---

### 11. Vehicle Digital Twin
*(38h — foundational; feeds Customer Transparency Dashboard, AI Maintenance Prediction, and Phase 3's Shareable Certification Report)*

| Task | Layer | Hours |
|---|---|---|
| Digital Twin schema aggregating check-ins/job cards/inspections/warranty/service history per vehicle | data-model | 6 |
| Twin-build/refresh service (event-driven aggregation) | backend | 8 |
| Twin query API (timeline, current condition, full history) | backend | 5 |
| Mobile/web: vehicle digital twin viewer | mobile | 8 |
| Design: twin timeline/viewer UI | design | 5 |
| QA: aggregation accuracy across event types, historical backfill, query performance | qa | 6 |
| **Total** | | **38h** |

**Shared with:** Phase 3's Shareable Vehicle Certification Report and this group's AI Maintenance Prediction both depend on this record — sequence it early within Phase 4, not late.

---

### 12. Customer Transparency Dashboard
*(23h)*

| Task | Layer | Hours |
|---|---|---|
| Aggregation endpoint combining job-card status, estimate, approval, progress, QC | backend | 6 |
| Mobile: "what's happening with my car right now" dashboard screen | mobile | 8 |
| Design: dashboard layout | design | 4 |
| QA: cross-feature data accuracy, real-time-ness | qa | 5 |
| **Total** | | **23h** |

---

### 13. Digital Service History (garage-facing)
*(20h)*

| Task | Layer | Hours |
|---|---|---|
| Garage-side service-history query endpoint (per-vehicle, cross-visit) | backend | 4 |
| Link to the existing consumer-side Service History (Phase 1, built) for continuity | integration | 4 |
| Web: garage-facing service-history screen | web | 5 |
| Design: garage service-history view | design | 2 |
| QA: cross-visit accuracy, consumer/garage data consistency | qa | 5 |
| **Total** | | **20h** |

---

## Operations & dashboards (10 features, 264h)

### 1. Inventory Management
*(36h)*

| Task | Layer | Hours |
|---|---|---|
| Inventory item/location/stock-level model + migration | data-model | 5 |
| Stock in/out/adjustment endpoints | backend | 6 |
| Low-stock alert job | backend | 3 |
| Multi-location stock-view endpoint | backend | 4 |
| Web: inventory dashboard (stock levels, adjustments) | web | 8 |
| Design: inventory dashboard UI | design | 4 |
| QA: stock accuracy across concurrent adjustments, alerts, multi-location | qa | 6 |
| **Total** | | **36h** |

---

### 2. Spare Parts Management
*(31h)*

| Task | Layer | Hours |
|---|---|---|
| SparePart catalog model (linked to inventory) + migration | data-model | 4 |
| Parts catalog CRUD + search endpoint | backend | 5 |
| Link parts consumption to job-card line items (auto-decrement inventory) | integration | 5 |
| Reorder-point/supplier-link config | backend | 3 |
| Web: parts catalog management screen | web | 6 |
| Design: parts catalog UI | design | 3 |
| QA: consumption→inventory sync accuracy, catalog search | qa | 5 |
| **Total** | | **31h** |

---

### 3. Vendor Management
*(24h)*

| Task | Layer | Hours |
|---|---|---|
| Vendor/supplier model (contact, parts supplied, terms) + migration | data-model | 3 |
| Vendor CRUD API | backend | 4 |
| Purchase-order creation endpoint (linked to reorder points) | backend | 5 |
| Web: vendor management screen | web | 5 |
| Design: vendor management UI | design | 3 |
| QA: vendor CRUD, PO lifecycle | qa | 4 |
| **Total** | | **24h** |

---

### 4. Billing & Invoicing
*(34h)*

| Task | Layer | Hours |
|---|---|---|
| B2B Invoice/LineItem model, extending the existing (unused) Payment/Invoice tables | data-model | 4 |
| Invoice generation from a completed job card | backend | 6 |
| Invoice CRUD + PDF generation | backend | 5 |
| Tax/discount calculation logic | backend | 4 |
| Web: invoicing screen (generate/send/view) | web | 6 |
| Design: invoice screen, PDF template | design | 4 |
| QA: invoice accuracy, tax calc, PDF rendering | qa | 5 |
| **Total** | | **34h** |

---

### 5. Digital Payments
*(33h)*

| Task | Layer | Hours |
|---|---|---|
| Garage-side payment/settlement model + migration | data-model | 3 |
| Wire invoice payment to Razorpay/payment gateway | backend | 6 |
| Webhook handling, settlement reconciliation | backend | 5 |
| Web: payment collection screen | web | 5 |
| Mobile: customer-facing pay-invoice flow | mobile | 5 |
| Design: payment collection, customer pay flow | design | 3 |
| QA: payment success/failure, reconciliation accuracy, webhook idempotency | qa | 6 |
| **Total** | | **33h** |

**Shared with:** can reuse the Customer Payments gateway plumbing from Phase 1 #2 rather than standing up a second Razorpay integration.

---

### 6. Warranty Activation
*(17h)*

| Task | Layer | Hours |
|---|---|---|
| WarrantyActivation model, linking parts/labor to the existing Warranty Management engine | data-model | 3 |
| Activation endpoint on job-card completion | backend | 4 |
| Web: warranty activation UI on job-card close | web | 4 |
| Design: activation UI | design | 2 |
| QA: activation correctness, linkage to existing warranty engine | qa | 4 |
| **Total** | | **17h** |

**Shared with:** reuses the already-built consumer-side Warranty Management engine (Phase 2 consumer-side, built) rather than a new prediction model.

---

### 7. Revenue Dashboard
*(23h)*

| Task | Layer | Hours |
|---|---|---|
| Revenue aggregation endpoint (by day/week/branch/service-type) | backend | 6 |
| Web: revenue dashboard (charts, filters) | web | 8 |
| Design: dashboard charts/layout | design | 4 |
| QA: aggregation accuracy across filters/time-ranges | qa | 5 |
| **Total** | | **23h** |

---

### 8. Mechanic Productivity
*(18h)*

| Task | Layer | Hours |
|---|---|---|
| Productivity metrics aggregation (tasks completed, time-per-task, QC pass rate) | backend | 5 |
| Web: mechanic productivity dashboard | web | 6 |
| Design: productivity dashboard UI | design | 3 |
| QA: metric accuracy, edge cases (partial shifts, reassignments) | qa | 4 |
| **Total** | | **18h** |

---

### 9. Vehicle Queue Management
*(22h)*

| Task | Layer | Hours |
|---|---|---|
| Queue/bay model (capacity, current occupancy) + migration | data-model | 3 |
| Queue assignment/reshuffle endpoints | backend | 5 |
| Web: live queue board | web | 6 |
| Design: queue board UI | design | 3 |
| QA: queue accuracy under concurrent check-ins, bay-capacity edge cases | qa | 5 |
| **Total** | | **22h** |

---

### 10. Business Analytics
*(26h)*

| Task | Layer | Hours |
|---|---|---|
| Cross-feature analytics aggregation (revenue + productivity + inventory + queue + satisfaction) | backend | 8 |
| Web: analytics dashboard (multi-widget) | web | 8 |
| Design: analytics dashboard layout | design | 4 |
| QA: cross-source data accuracy, dashboard performance at scale | qa | 6 |
| **Total** | | **26h** |

---

## AI & automation (7 features, 205h)

### 1. ANPR Vehicle Recognition
*(41h — foundational; Phase 2's ANPR Parking Entry/Exit depends on this)*

| Task | Layer | Hours |
|---|---|---|
| Camera/hardware integration spec at check-in/entry-exit points | integration | 6 |
| ANPR recognition service (third-party CV API integration) | backend | 10 |
| Plate-read event model + confidence-score handling + migration | data-model | 4 |
| Event webhook/pub endpoint feeding Vehicle Check-in + Phase 2's ANPR Parking | backend | 6 |
| Web: manual-override UI for misreads | web | 5 |
| Design: misread-override UI | design | 2 |
| QA: recognition accuracy across plate formats/lighting/angles, misread handling, latency | qa | 8 |
| **Total** | | **41h** |

**Risk:** real-world accuracy depends heavily on camera hardware/placement (a facilities decision, not software) and almost certainly needs a licensed CV vendor (e.g. Plate Recognizer, OpenALPR) rather than an in-house model — this budgets for vendor-API integration, not training a computer-vision model from scratch.

---

### 2. AI Diagnostics
*(36h)*

| Task | Layer | Hours |
|---|---|---|
| Diagnostic-input model (symptom description, OBD-II codes if available, vehicle history) + migration | data-model | 4 |
| Rule/decision-tree diagnostic engine v1, cross-referencing the Vehicle Digital Twin | backend | 12 |
| Diagnostic suggestion API endpoint | backend | 4 |
| Mobile: mechanic-facing diagnostic assistant UI | mobile | 6 |
| Design: diagnostic assistant UI | design | 3 |
| QA: suggestion relevance across common fault patterns, false-positive spot-check | qa | 7 |
| **Total** | | **36h** |

**Risk:** "AI Diagnostics" here is a rule/decision-tree engine, consistent with the rest of the app's "AI" features — not a trained fault-prediction model or live OBD-II telemetry. Real OBD-integrated diagnostics is a distinct, larger hardware+ML project.

---

### 3. AI Job Card Generation
*(29h)*

| Task | Layer | Hours |
|---|---|---|
| Auto-draft job card from inspection findings + customer complaint text | backend | 8 |
| NLP-lite complaint-to-line-item mapping (keyword/rule-based) | backend | 6 |
| Draft review/edit-before-save endpoint | backend | 3 |
| Web: AI-draft review UI (accept/edit before creating the job card) | web | 5 |
| Design: draft-review UI | design | 2 |
| QA: draft accuracy across complaint phrasing, edit-flow correctness | qa | 5 |
| **Total** | | **29h** |

**Shared with:** builds directly on Digital Job Cards and Vehicle Inspection (Core workflow #2, #3) — build after those.

---

### 4. AI Job Allocation
*(24h)*

| Task | Layer | Hours |
|---|---|---|
| Extend Smart Job Allocation with predictive load-balancing (historical completion-time model) | backend | 10 |
| Allocation-quality feedback loop (track actual vs. predicted time) | backend | 5 |
| Web: allocation-confidence indicator in the allocation board | web | 3 |
| QA: prediction accuracy vs. actuals over a rolling window, feedback-loop correctness | qa | 6 |
| **Total** | | **24h** |

**Shared with:** an incremental enhancement on top of Smart Job Allocation (Core workflow #7) — not buildable first.

---

### 5. AI Troubleshooting Assistant
*(31h)*

| Task | Layer | Hours |
|---|---|---|
| Conversational troubleshooting-query model/session + migration | data-model | 3 |
| Rule/retrieval-based Q&A engine over a common-fault knowledge base | backend | 10 |
| Escalation-to-human-mechanic handoff endpoint | backend | 3 |
| Mobile: chat-style troubleshooting assistant UI | mobile | 6 |
| Design: chat UI | design | 3 |
| QA: answer relevance/coverage, escalation-handoff correctness | qa | 6 |
| **Total** | | **31h** |

**Risk:** knowledge-base coverage (what faults it can actually answer) is a content/curation effort as much as an engineering one — this assumes a pre-supplied fault knowledge base, not building that content from scratch.

---

### 6. Predictive Inventory
*(24h)*

| Task | Layer | Hours |
|---|---|---|
| Historical parts-consumption analysis | backend | 8 |
| Predictive reorder-point suggestion endpoint | backend | 6 |
| Web: predictive reorder suggestions surfaced in the Inventory dashboard | web | 4 |
| QA: prediction accuracy vs. actual consumption over time, seasonal-variance handling | qa | 6 |
| **Total** | | **24h** |

**Shared with:** extends Inventory Management and Spare Parts Management (Ops group #1, #2) — build after those.

---

### 7. AI Maintenance Prediction (garage-facing)
*(20h)*

| Task | Layer | Hours |
|---|---|---|
| Extend the existing consumer-side AI Maintenance Reminders (Phase 1, built) with a garage-facing cross-vehicle view | backend | 6 |
| Web: garage-facing predictive maintenance dashboard (upcoming services across all vehicles in shop) | web | 6 |
| Design: dashboard UI | design | 3 |
| QA: cross-vehicle prediction consistency with the existing consumer-side formula | qa | 5 |
| **Total** | | **20h** |

**Shared with:** reuses the existing deterministic average-daily-running formula rather than building new prediction logic.

---

## Multi-location & B2B (5 features, 151h)

### 1. Franchise Management
*(29h)*

| Task | Layer | Hours |
|---|---|---|
| Franchise/branch-ownership model + migration | data-model | 4 |
| Franchise onboarding + branch-linking endpoints | backend | 6 |
| Franchise-level rollup reporting (revenue/productivity across owned branches) | backend | 5 |
| Web: franchise management dashboard | web | 6 |
| Design: franchise dashboard UI | design | 3 |
| QA: multi-branch rollup accuracy, permission boundaries | qa | 5 |
| **Total** | | **29h** |

---

### 2. Multi-Branch Management
*(29h)*

| Task | Layer | Hours |
|---|---|---|
| Branch model (location, staff, config) + migration | data-model | 3 |
| Branch CRUD + staff-assignment endpoints | backend | 5 |
| Cross-branch data scoping (job cards/inventory/etc. scoped per branch) | backend | 6 |
| Web: branch management screen, branch-switcher UI | web | 6 |
| Design: branch management UI | design | 3 |
| QA: data-scoping correctness (no cross-branch leakage), branch-switch UX | qa | 6 |
| **Total** | | **29h** |

**Risk:** this is really a cross-cutting concern — every Core/Ops feature above technically needs branch-scoping. It's estimated here as one dedicated pass rather than baked into all 24 other features individually; if multi-branch is a firm near-term requirement, doing this pass *earlier* in the Phase 4 sequence (not last, as its group placement implies) avoids rework across everything built before it.

---

### 3. Supply Chain Management
*(27h)*

| Task | Layer | Hours |
|---|---|---|
| Multi-vendor, multi-branch purchase-order/fulfillment model + migration | data-model | 4 |
| PO fulfillment tracking + inter-branch stock-transfer endpoints | backend | 8 |
| Web: supply-chain dashboard (POs in flight, transfers) | web | 6 |
| Design: dashboard UI | design | 3 |
| QA: multi-branch transfer accuracy, fulfillment-status correctness | qa | 6 |
| **Total** | | **27h** |

**Shared with:** extends Vendor Management and Inventory Management (Ops group #1, #3) into a multi-branch context.

---

### 4. White-Label Garage OS
*(38h)*

| Task | Layer | Hours |
|---|---|---|
| Tenant model (branding config, custom domain/subdomain, feature-flag set) + migration | data-model | 5 |
| Multi-tenancy data-isolation pass across the core schema | backend | 12 |
| Tenant-branding config endpoints (logo/colors/name) | backend | 4 |
| Web: tenant admin config screen | web | 5 |
| Tenant provisioning/onboarding flow | integration | 5 |
| QA: tenant isolation (no cross-tenant data leakage), branding rendering | qa | 7 |
| **Total** | | **38h** |

**Risk:** the single riskiest item in Phase 4. Retrofitting multi-tenancy onto everything built above is a foundational architecture decision that's far cheaper to make *before* the other 35 features than after. If white-labeling is a real near-term goal, sequence this near the front of Phase 4, not the back — its group placement here reflects the roadmap's grouping, not a recommended build order.

---

### 5. OEM/Insurer API Layer
*(28h)*

| Task | Layer | Hours |
|---|---|---|
| Partner-API model (API keys, scopes, rate limits per partner) + migration | data-model | 4 |
| Public partner API endpoints (scoped read access to vehicle history/warranty/service records) | backend | 10 |
| API-key issuance/management endpoints | backend | 4 |
| Partner-facing API docs | integration | 4 |
| QA: scope/permission enforcement, rate-limiting, key-revocation | qa | 6 |
| **Total** | | **28h** |

**Risk:** actual OEM/insurer partnerships (who gets access, what they pay, what they're contractually allowed to see) are business/legal negotiations outside engineering hours — this estimate covers only the technical API layer, not partner acquisition.

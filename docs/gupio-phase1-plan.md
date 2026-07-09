# GUPIO Phase 1 — Build Plan for What's Not Yet Done

*Scope: the 13 Phase 1 features that are Partial or Not Built (already-built features are excluded per request — see `gupio-build-backlog.md` for those). Each feature has a 2-3 line summary, a task breakdown with hour estimates, and a week-by-week schedule from **Wed, July 15, 2026** to **Sun, August 30, 2026**.*

**Calendar window:** 47 calendar days, **33 weekdays** across 7 weeks (Jul 15–19 is a partial 3-day week; the rest are full 5-day weeks).
**Capacity assumption (stated explicitly — rescale if your team differs):** 1 full-stack engineer at ~6 productive hrs/day = **198h** available in this window. A 2-engineer scenario (**396h**) is also shown.

---

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




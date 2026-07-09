# GUPIO — Build Backlog (reordered)

*Every feature from the roadmap doc, checked against real code, reorganized per Phase 1 priorities. Generated from a 16-agent, 480-tool-call read-only audit of `Backend/` and `Mobile/`.*

**Legend:** ✅ Built · ⚠️ Partial · ❌ Not built

**Totals:** 76 feature lines (75 from the document + 2 added: *Hire Driver for Trip*, *Rent a Car/Bike*).
Phases 1–3 (40 consumer items): **9 built · 5 partial · 26 not built**. Phase 4 (36 B2B items): **0 built**.

---

## Phase 1 — User Acquisition (Park+-style core)
**7 built · 3 partial · 10 not built**

| # | Feature | Status | Detail |
|---|---|---|---|
| 1 | Search Hotels, Malls, Hospitals, EV Charging & Fuel Stations | ✅ Built | Real, live Google Places integration for nearby search, plus a genuine daily-cron fuel-price scraper. Working end-to-end. |
| 2 | Parking — Locate + Booking *(consolidates Valet + Parking Booking, Book Valet, Parking Navigation)* | ⚠️ Partial | Valet drop-off request/cancel is real and database-backed — but there's no operator-side accept/fulfil step (a request can stall at `PENDING` forever), and "live" tracking returns the parking site's fixed address, not a moving GPS pin. This is valet-style booking only — no separate "find a public parking spot" locator yet. |
| 3 | Parking Payments | ❌ Not built | No payment gateway exists anywhere. The Razorpay-shaped DB tables are keyed to a B2B operator entity, not your consumer account, and nothing in the code touches them. |
| 4 | Service History | ✅ Built | Real service records, real part/warranty tracking, fully wired to the app. |
| 5 | Book Car Servicing | ❌ Not built | App can locate a garage and show history, but there's no slot-booking/appointment flow anywhere — no screen, no backend model. Locate-only today. |
| 6 | Vehicle Expense Tracker | ✅ Built | Your most complete feature — real receipt/SMS parsing, budgets, anomaly detection, and a working Android listener that auto-logs bank/UPI expenses. |
| 7 | Emergency SOS | ✅ Built | Real alerting — SMS, email, and voice call to emergency contacts, with GPS capture. |
| 8 | Roadside Assistance | ❌ Not built | SOS alerting is solid, but no towing/mechanic dispatch behind it — no vendor model, no booking, no ETA/status tracking. "Nearby Help" is a tap-to-call list, not a dispatch. |
| 9 | Driving Behavior | ✅ Built | Real telematics — a genuine third-party SDK plus an in-house GPS trip recorder. GPS-speed-based scoring rather than accelerometer-fused, but works. |
| 10 | Trip & Travel *(moved from Phase 2)* | ⚠️ Partial | Real toll/route cost calc and real hotel/transport search work. Trip weather is hardcoded/randomized fake data, hotel "live rates" are synthetic markup math, and the itinerary is a static template regardless of destination. |
| 11 | Hire Driver *(moved from Phase 2)* | ❌ Not built | No code anywhere — a local, on-demand driver-for-your-car service needs a vetting/matching backend, availability model, and booking flow. |
| 12 | Hire Driver for Trip *(added — not in original document)* | ❌ Not built | Also zero code. Distinct from #11 — outstation/multi-day trips need distance/duration pricing and multi-day availability; likely folds into the Trip & Travel booking flow rather than standing alone. |
| 13 | Rent a Car/Bike — Dealer Listings, In-App Booking & Locate *(added — not in original document)* | ⚠️ Partial | A locator already exists in the trip planner that finds nearby rental shops via Google Places — but prices are synthetic markup math, not real dealer rates, and there's no booking step. Locate is the easy third already done; dealer listings + booking are net-new. |
| 14 | Car Owner Reviews | ❌ Not built | No review/rating database model exists. Any "ratings" shown are raw, unmoderated Google Places data — not first-party owner reviews. |
| 15 | Message Vehicle Owner | ❌ Not built | The app's "chat" is an AI assistant, not person-to-person messaging. No model/channel for owner-to-owner messages. |
| 16 | Check Challan | ✅ Built | The checking half is real — a genuine government-data aggregator call with persistence and notifications. Paying one is separate and still not built (needs the same payment gateway as #3 and #5). |
| 17 | Accessories Marketplace | ❌ Not built | No catalog, cart, checkout, or vendor model — "accessories" only exists as an expense-category label. |
| 18 | Sell Used Cars | ❌ Not built | No listing, valuation, or buyer-matching flow anywhere. "Vehicle Search" only searches vehicles you've already registered. |
| 19 | Community | ❌ Not built | No community/feed/forum model or screen anywhere. |
| 20 | AI Maintenance Reminders *(already built — kept per the "whatever's built stays" rule)* | ✅ Built | Next-service dates predicted from real average-daily-running math on odometer history, with automatic reminders. Deterministic formula rather than a trained model, but delivers the feature. |

---

## Phase 2 — Revenue Services
**2 built · 2 partial · 9 not built**

| # | Feature | Status | Detail |
|---|---|---|---|
| 1 | Insurance | ❌ Not built | No policy, quote, or claim model. Only a document-upload slot plus a dead "Insurance Help" tile that does nothing when tapped. |
| 2 | FASTag | ❌ Not built (mislabeled) | What exists is bank-account penny-drop verification wearing a FASTag label — not an NHAI/NPCI balance/recharge API. No tag ID or balance field in the DB at all. |
| 3 | Challan Payment *(checking is built — see Phase 1 #16)* | ❌ Not built | "Pay Now" confirm action is an empty function; backend's mark-as-paid endpoint has no payment verification or ownership check. |
| 4 | RTO Services | ❌ Not built | All three RTO screens and the service file are one-line placeholder stubs, never wired into the app. Zero backend routes. |
| 5 | Garage Finder | ✅ Built | Real, working Google Places–based mechanic/garage locator with map, distance, native-navigation handoff. |
| 6 | Car Washing | ⚠️ Partial | A working locator tab exists in one screen, but the home screen separately labels Car Wash "Coming Soon." No booking either way. |
| 7 | NEW · ANPR-based Parking Entry/Exit | ❌ Not built | No number-plate-recognition code anywhere. Depends on the same ANPR capability listed under Phase 4. |
| 8 | Car Loan | ❌ Not built | No EMI calculator, lender integration, or loan flow — "EMI" only exists as an expense-category label. |
| 9 | Warranty Management | ✅ Built | Genuinely strong — real usage-based prediction and a cascading manufacturer-interval pipeline that labels its own confidence level. |
| 10 | Digital Invoice History | ⚠️ Partial | Service history and expense records are real, but no formal invoice is ever generated — the Invoice DB model exists but nothing populates it. |
| 11 | NEW · Fleet Dashboard | ❌ Not built | No multi-vehicle B2B billing code exists; the underlying billing models aren't wired to anything either. |
| 12 | NEW · PUC Certificate Tracking & Renewal Reminders | ❌ Not built | PUC status is a one-time byproduct field from RC verification, never re-checked, no reminder job. |
| 13 | NEW · Subscription Plans | ❌ Not built | No paywall, plan/tier logic, or recurring-billing handling anywhere. |

---

## Phase 3 — Automotive Ecosystem
**0 built · 0 partial · 7 not built** — least-started part of the roadmap

| # | Feature | Status | Detail |
|---|---|---|---|
| 1 | Buy New Cars | ❌ Not built | No listings or purchase flow anywhere. |
| 2 | Vehicle Marketplace | ❌ Not built | "Vehicle Search" only searches vehicles you've already registered, not a marketplace. |
| 3 | Dealer Listings | ❌ Not built | No dealer feed anywhere. |
| 4 | AI Vehicle Recommendations | ❌ Not built | Only a deterministic if/else point-penalty system nudging maintenance on a car you already own — not a purchase-decision engine. |
| 5 | Personalized Upgrade Recommendations | ❌ Not built | Same underlying gap as above — no upgrade/purchase recommendation engine exists. |
| 6 | NEW · AI Instant Vehicle Valuation | ❌ Not built | No valuation model or market-data feed integrated anywhere. |
| 7 | NEW · Shareable Vehicle Certification Report | ❌ Not built | Depends on a Vehicle Digital Twin concept that doesn't exist yet either (Phase 4). Nothing to make shareable. |

---

## Phase 4 — GUPIO Garage Platform (B2B)
**0 of 36 built.** Different product surface from the consumer app — an operator-facing garage OS. Confirmed absent at the shared database-schema level (zero job-card/mechanic/inspection/diagnostic/franchise/ANPR table among the monorepo's 70 tables) — not directly checked inside the separate `Admin` app, worth a look there.

**Core job workflow (14, all not built):**
SmartDrop Locker, Vehicle Check-in, Digital Job Cards, Vehicle Inspection, Repair Estimation, Customer Approval Workflow, Mechanic Workflow, Smart Job Allocation, Repair Progress Tracking, Photo & Video Updates, Quality Control Checklist, Vehicle Digital Twin, Customer Transparency Dashboard, Digital Service History (garage-facing)

**Operations & dashboards (10, all not built):**
Inventory Management, Spare Parts Management, Vendor Management, Billing & Invoicing, Digital Payments, Warranty Activation, Revenue Dashboard, Mechanic Productivity, Vehicle Queue Management, Business Analytics

**AI & automation (7, all not built):**
ANPR Vehicle Recognition, AI Diagnostics, AI Job Card Generation, AI Job Allocation, AI Troubleshooting Assistant, Predictive Inventory, AI Maintenance Prediction

**Multi-location & B2B (5, all not built):**
Franchise Management, Multi-Branch Management, Supply Chain Management, NEW · White-Label Garage OS, NEW · OEM/Insurer API Layer

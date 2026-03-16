# Gupio New Features Catalog (50 Ideas)

This document lists 50 new feature ideas tailored for your current app (AI + vehicle + expenses + documents + telematics + SOS).  
Each feature includes:
- **What it is**
- **Why users will care**
- **MVP scope**
- **Complexity** (Low/Medium/High)
- **Business potential** (Low/Medium/High)

Use this as a decision sheet to shortlist what to build in the next 3-6 months.

---

## Implementation TODO Plan (Priority Order)

**Do existing-feature improvements first, then new features.** Check off as you complete.

### Part A: Existing-Feature Improvements (do in this order)

| # | Task | Quick win / MVP | KPI / validation |
|---|------|------------------|-------------------|
| A1 | AI Assistant Action Completion | Action chips under AI responses (expense, reminder, share doc, support) | +20% AI-to-action completion in 2 weeks |
| A2 | Expense Logging Friction Reduction | Location-aware prefill + "Use last entry at this location" | +30% weekly expense entries per user |
| A3 | Document Upload Success Rate | Pre-upload blur/glare/crop checks + retake hints | -40% failed upload attempts |
| A4 | Vehicle Health Score Explainability | Score components + "Score changed because..." + next actions | +25% click-through on health recommendations |
| A5 | Telematics Value Presentation | End-trip summary with score + money/safety tip | +20% trip-summary open-to-save |
| A6 | Notification Relevance Filtering | Critical / Important / FYI labels; digest mode; quiet hours | +25% notification open rate, lower opt-out |
| A7 | Onboarding-to-Activation Funnel | 5-step checklist: vehicle, document, budget, alerts, first AI query | Higher week-1 retention |
| A8 | Weekly Owner Report | Single push + in-app report (spend, compliance, safety, next 3 tasks) | +12% week-4 retention |
| A9 | DigiLocker Completion Experience | Post-sync summary: what imported, what missing, next step | +35% DigiLocker users complete profile |
| A10 | Home Screen Personalization Engine | User-specific cards (due soon, save amount, challan risk) | Rule-based first, then AI |
| A11 | Voice Assistant Reliability Upgrade | Instant transcript edit before submit; low-noise hint | Better voice success rate |
| A12 | Expense Insights Clarity | "What to do next" row below each chart | Insight-to-action |
| A13 | Document Reminder Intelligence | Multi-stage reminders 30/14/7/2 days + suggested actions | Fewer missed renewals |
| A14 | Service & Warranty Timeline Upgrade | Forward-looking timeline; safe/watch/urgent tags | One-tap booking intent |
| A15 | Challan Module Activation | Weekly challan check card on Home; payment reminders | Higher challan resolution |
| A16 | SOS Flow Confidence Upgrade | Contact test mode + readiness score + post-SOS checklist | Trust in critical moments |
| A17 | Sharing and Access Audit Trail | Activity tab under vehicle sharing (who accessed what) | Security confidence |
| A18 | Multi-language and Local Context | Hinglish + Hindi for top flows (legal/insurance) | Wider adoption |
| A19 | Trust and Verification Layer | "Verified partner" badge for services/support | Conversion driver |
| A20 | Home Quick Actions Optimization | Reorder by behavior and urgency (after 7 days data) | Faster task completion |

### Part B: New Features (after Part A; in this order)

| # | Task | MVP boundary | Phase |
|---|------|--------------|-------|
| B1 | Auto Compliance Radar | Single compliance score for RC/DL/Insurance/PUC/challan | 2 (31-60 days) |
| B2 | Weekly Owner Report (if not done in A8) | — | — |
| B3 | Auto Expense from Trip Signatures | Fuel + toll only; approve/reject queue | 3 (61-90 days) |
| B4 | Driver Trust Score | Weekly score + behavior reasons + trend | 3 |
| B5 | Post-Accident Guided Workflow | Incident checklist + evidence + support flow | 3 |
| B6 | Vehicle Twin (Digital Car Health Brain) | Risk score dashboard from trips + service + parts | Later |
| B7 | 30-Day Cost Forecast | Time-series prediction per vehicle | Later |
| B8 | Valet Mode with Geo-Fence Lock | Start/stop session + route replay + violation alerts | Later |
| B9 | Failure Probability Alerts | Part-level probability alerts | Later |
| B10 | Ask-Anything Document AI | RAG over docs + cited answers | Later |

Use the full catalog below for MVP scope and complexity of each new feature.

---

## How to Select What to Build

Use this weighted score for each feature:

`Decision Score = (Impact x 25) + (Retention x 20) + (Revenue x 15) + (Feasibility x 15) + (DataReadiness x 10) + (Differentiation x 10) - (ComplianceRisk x 5)`

Rate each input from 1-5.

- **Impact:** How strongly this solves a painful user problem.
- **Retention:** Likelihood of increasing weekly/monthly active usage.
- **Revenue:** Direct monetization potential (premium, commission, partner-led).
- **Feasibility:** Engineering and operations practicality in your current stack.
- **DataReadiness:** How much required data is already available in your app.
- **Differentiation:** How hard this is for others to copy quickly.
- **ComplianceRisk:** Legal/privacy/regulatory complexity and risk.

### Decision Rules

- **Build Now:** Score 360+ and complexity Low/Medium.
- **Build Next:** Score 300-359 with at most one major external dependency.
- **Build Later:** Score 240-299 or requires partner/regulatory unlock.
- **Do Not Build Yet:** Score below 240 or high-risk with unclear user pull.

### Feature Metadata Legend

Use this metadata for all features in this document:

- **Dep:** Dependencies required to launch
  - `NONE` = no major external dependency
  - `TLM` = telematics/SDK data dependency
  - `PARTNER` = external business/service partner dependency
  - `REG` = legal/regulatory/API dependency
  - `AI+` = advanced model quality dependency
- **Risk:** `L` / `M` / `H` delivery and product risk.
- **Mon:** Monetization path
  - `RET` = retention-led free value
  - `PREM` = premium subscription feature
  - `COMM` = commission/affiliate/partner revenue
  - `B2B` = enterprise/fleet monetization path

---

## High-Impact Improvements for Existing Features (Start Here)

These are improvements to features you already have.  
Focus on these first to increase retention, engagement, and trust without building everything from scratch.

### 1) Home Screen Personalization Engine
- **Improve:** Replace static sections with user-specific cards ("Due in 3 days", "You can save INR 1,200 this month", "High challan risk route today").
- **Why high impact:** Home screen becomes decision center, improving daily active usage.
- **Quick win:** Rule-based personalization first, then AI ranking.

### 2) AI Assistant Action Completion
- **Improve:** Every AI response should end with one-tap actions (log expense, renew reminder, call support, share doc).
- **Why high impact:** Moves AI from chat novelty to workflow completion tool.
- **Quick win:** Add action chips under existing responses.

### 3) Voice Assistant Reliability Upgrade
- **Improve:** Add low-noise mode, accent adaptation, and offline fallback input.
- **Why high impact:** Better voice success rate directly improves repeated usage.
- **Quick win:** Show instant transcript edit before submit.

### 4) Expense Logging Friction Reduction
- **Improve:** Pre-fill amount/category from recent behavior and location context.
- **Why high impact:** Lower input effort increases logging consistency.
- **Quick win:** "Use last entry at this location" suggestion.

### 5) Expense Insights Clarity
- **Improve:** Convert charts into actions ("Fuel is 18% higher than normal, switch refill station").
- **Why high impact:** Insight-to-action drives visible user value.
- **Quick win:** Add "What to do next" row below each chart.

### 6) Document Upload Success Rate
- **Improve:** Add upload quality checks (blur, crop guidance, glare warning) before OCR.
- **Why high impact:** Fewer failed uploads and more trust in document module.
- **Quick win:** Pre-upload image quality validator.

### 7) Document Reminder Intelligence
- **Improve:** Trigger reminders by urgency and processing lead time (not just expiry date).
- **Why high impact:** Users avoid last-minute panic and missed compliance.
- **Quick win:** Multi-stage reminders: 30/14/7/2 days with suggested actions.

### 8) DigiLocker Completion Experience
- **Improve:** After sync, show "what was imported", "what is missing", and "next best step".
- **Why high impact:** Makes integration feel complete and useful, not technical.
- **Quick win:** Add post-sync summary screen.

### 9) Vehicle Health Score Explainability
- **Improve:** Break score into components with clear reasons and exact fix recommendations.
- **Why high impact:** Transparent scoring increases credibility and action rate.
- **Quick win:** "Score changed because..." timeline.

### 10) Service & Warranty Timeline Upgrade
- **Improve:** Convert service history into forward-looking timeline with overdue risk levels.
- **Why high impact:** Pushes preventive maintenance behavior.
- **Quick win:** Colored status tags (safe/watch/urgent) with one-tap booking intent.

### 11) Challan Module Activation
- **Improve:** Add smarter nudges: periodic checks, payment reminders, and repeat-offense prevention tips.
- **Why high impact:** High pain area with immediate value.
- **Quick win:** Weekly challan check card in Home.

### 12) Telematics Value Presentation
- **Improve:** Translate trip events into money and safety outcomes ("Harsh braking added wear risk").
- **Why high impact:** Users understand why driving data matters.
- **Quick win:** End-trip summary with score + saving tip.

### 13) Notification Relevance Filtering
- **Improve:** Priority-based notification feed with digest mode and quiet hours.
- **Why high impact:** Reduces fatigue, improves notification open rate.
- **Quick win:** Add "Critical / Important / FYI" labels.

### 14) SOS Flow Confidence Upgrade
- **Improve:** Add preconfigured emergency plans and one-tap post-SOS follow-up checklist.
- **Why high impact:** Builds trust in critical moments and differentiates safety promise.
- **Quick win:** Contact test mode + readiness score.

### 15) Sharing and Access Audit Trail
- **Improve:** Show transparent logs for who accessed vehicle data, documents, and actions.
- **Why high impact:** Improves security confidence for family/shared usage.
- **Quick win:** Add activity tab under vehicle sharing.

### 16) Onboarding-to-Activation Funnel
- **Improve:** Guide users to complete 5 core actions in first session (add vehicle, add document, set budget, enable alerts, first AI query).
- **Why high impact:** Better activation means higher retention in week 1.
- **Quick win:** Progress checklist with reward badge.

### 17) Multi-language and Local Context
- **Improve:** Local language support for legal/insurance explanations and alerts.
- **Why high impact:** Expands adoption across wider user segments.
- **Quick win:** Start with Hinglish + Hindi for top user flows.

### 18) Trust and Verification Layer
- **Improve:** Add verified badges for service centers, support providers, and shared contacts.
- **Why high impact:** Trust is a major conversion driver in auto services.
- **Quick win:** Basic "verified partner" label rollout.

### 19) Home Quick Actions Optimization
- **Improve:** Reorder quick actions based on user behavior and urgency.
- **Why high impact:** Faster task completion improves stickiness.
- **Quick win:** Adaptive ordering after 7 days of usage data.

### 20) Weekly Owner Report
- **Improve:** Create one weekly report combining spend, safety, compliance, and upcoming actions.
- **Why high impact:** Establishes habit loop and long-term retention.
- **Quick win:** Single push notification + in-app report card.

### Recommended Existing-Feature Priority (Top 8)
1. AI Assistant Action Completion
2. Expense Logging Friction Reduction
3. Document Upload Success Rate
4. Vehicle Health Score Explainability
5. Telematics Value Presentation
6. Notification Relevance Filtering
7. Onboarding-to-Activation Funnel
8. Weekly Owner Report

---

## A) AI Intelligence and Prediction

### 1) Vehicle Twin (Digital Car Health Brain)
- **What it is:** A live AI profile for each car that predicts likely failures, service windows, and health decline.
- **Why users care:** Prevents sudden breakdowns and surprise expenses.
- **MVP scope:** Combine trip behavior, odometer, service history, part intervals, and expense trends into a risk score dashboard.
- **Complexity:** High
- **Business potential:** High

### 2) 30-Day Cost Forecast
- **What it is:** Predict expected spend for fuel, toll, maintenance, and penalties for the next month.
- **Why users care:** Helps monthly budget planning before costs happen.
- **MVP scope:** Time-series prediction per vehicle using past expenses + distance patterns.
- **Complexity:** Medium
- **Business potential:** High

### 3) Trip Cost Simulator
- **What it is:** User enters destination and gets estimated trip fuel/toll/wear cost with cheaper alternatives.
- **Why users care:** Direct money saving before trip starts.
- **MVP scope:** Route distance + fuel efficiency + historical toll approximation + best refill recommendations.
- **Complexity:** Medium
- **Business potential:** High

### 4) Failure Probability Alerts
- **What it is:** Probability alerts like "Battery failure risk in 20 days: 62%".
- **Why users care:** Actionable preventive maintenance.
- **MVP scope:** Rule + ML hybrid alerts mapped to specific parts.
- **Complexity:** High
- **Business potential:** High

### 5) AI Mechanic Chat Mode
- **What it is:** Specialized AI mode focused only on diagnostics and service guidance.
- **Why users care:** Faster, trusted troubleshooting.
- **MVP scope:** Symptom intake form, repair confidence score, probable cause list.
- **Complexity:** Medium
- **Business potential:** Medium

### 6) Voice-first "Log Expense in 5 Seconds"
- **What it is:** Natural voice command to add expenses with automatic category extraction.
- **Why users care:** Zero-friction logging while driving/parking.
- **MVP scope:** Speech-to-text + parser + confirmation card.
- **Complexity:** Low
- **Business potential:** High

### 7) AI Weekly Action Plan
- **What it is:** Every week app gives top 3 actions: save money, avoid risk, improve score.
- **Why users care:** Clear guidance instead of raw data overload.
- **MVP scope:** Digest card from events + expenses + documents + health.
- **Complexity:** Low
- **Business potential:** High

### 8) Smart Spending Leak Detection
- **What it is:** Detect unusual expense patterns ("fuel spend up 28% in same route").
- **Why users care:** Finds hidden leakage and misuse.
- **MVP scope:** Baseline modeling and anomaly flags.
- **Complexity:** Medium
- **Business potential:** High

### 9) Predictive Maintenance Calendar
- **What it is:** Dynamic calendar with service items auto-shifting based on actual driving patterns.
- **Why users care:** Better than static reminder dates.
- **MVP scope:** Usage-aware due dates and reminder engine.
- **Complexity:** Medium
- **Business potential:** Medium

### 10) Ask-Anything Document AI
- **What it is:** Chat with vehicle documents (insurance, RC, warranty) and get exact answer with citation.
- **Why users care:** Removes confusion in policy language.
- **MVP scope:** RAG retrieval over uploaded docs + direct answer links.
- **Complexity:** Medium
- **Business potential:** High

---

## B) Driver, Valet, and Sharing Trust

### 11) Driver Trust Score
- **What it is:** Session-based driving trust score for drivers/family/borrowers.
- **Why users care:** Trust and accountability for shared vehicles.
- **MVP scope:** Score from harsh braking, overspeeding, rapid acceleration, idle abuse.
- **Complexity:** Medium
- **Business potential:** High

### 12) Valet Mode with Geo-Fence Lock
- **What it is:** One-tap valet session with allowed radius and time.
- **Why users care:** Reduces misuse during valet parking.
- **MVP scope:** Start/stop valet session + route replay + violation alerts.
- **Complexity:** High
- **Business potential:** High

### 13) Silent Route Deviation Alert
- **What it is:** Sends discreet alert if car deviates far from intended parking or route.
- **Why users care:** Security without panic or noise.
- **MVP scope:** Deviation threshold + push + map preview.
- **Complexity:** Medium
- **Business potential:** High

### 14) Family Role Permissions
- **What it is:** Fine-grained permissions for spouse, parent, driver, child (view-only/edit/pay/share).
- **Why users care:** Better privacy and control.
- **MVP scope:** Role templates + permission matrix in vehicle sharing.
- **Complexity:** Medium
- **Business potential:** Medium

### 15) Shared Vehicle Timeline
- **What it is:** Unified activity timeline showing who used car, where, and what events happened.
- **Why users care:** Transparency in multi-user cars.
- **MVP scope:** Timeline feed from trips, expenses, and alerts tagged by user.
- **Complexity:** Medium
- **Business potential:** Medium

### 16) Teen Driver Safety Mode
- **What it is:** Parent controls for young drivers with speed/time/geofence policy.
- **Why users care:** Safety and confidence.
- **MVP scope:** Policy setup + auto alerts + weekly scorecard.
- **Complexity:** Medium
- **Business potential:** High

### 17) Trip Replay with Event Pins
- **What it is:** Replay route with hard brake, rapid acceleration, and overspeed markers.
- **Why users care:** Easy behavior review.
- **MVP scope:** Event overlay on map + timeline scrubber.
- **Complexity:** Medium
- **Business potential:** Medium

### 18) Borrowed Car Agreement
- **What it is:** In-app usage agreement before giving car to someone (return by time, fuel level expectation).
- **Why users care:** Avoids social friction and disputes.
- **MVP scope:** Template terms + digital acceptance + return checklist.
- **Complexity:** Low
- **Business potential:** Medium

### 19) Driver Leaderboard (Private Group)
- **What it is:** Gamified safety/efficiency ranking among trusted users.
- **Why users care:** Improves behavior through friendly competition.
- **MVP scope:** Weekly score + badges + challenge goals.
- **Complexity:** Low
- **Business potential:** Medium

### 20) AI Coach for Specific Driver
- **What it is:** Personalized driving improvement tips by individual user.
- **Why users care:** Better than generic safe-driving tips.
- **MVP scope:** Driver profile + trip trend-based coaching cards.
- **Complexity:** Medium
- **Business potential:** Medium

---

## C) Expense and Savings Superpowers

### 21) Auto Expense from Trip Signatures
- **What it is:** Suggest fuel/toll/parking entries automatically from trip patterns.
- **Why users care:** Removes manual tracking burden.
- **MVP scope:** "Detected expense" queue with one-tap approve/reject.
- **Complexity:** Medium
- **Business potential:** High

### 22) Fuel Pump Price and Trust Index
- **What it is:** Rank nearby pumps by reported pricing, wait time, and user trust.
- **Why users care:** Better refill decisions.
- **MVP scope:** Community ratings + fuel price cache + recommendation logic.
- **Complexity:** High
- **Business potential:** High

### 23) Best Time-to-Refuel Alert
- **What it is:** Advises best day/time/place to refuel based on local trends.
- **Why users care:** Regular savings without effort.
- **MVP scope:** Historical city/state fuel trend model + notification.
- **Complexity:** Medium
- **Business potential:** High

### 24) Subscription and Fixed Cost Tracker
- **What it is:** Track recurring car costs (FASTag recharge pattern, washing, parking subscription).
- **Why users care:** Visibility into hidden fixed drain.
- **MVP scope:** Recurring expense detection + monthly fixed cost summary.
- **Complexity:** Low
- **Business potential:** Medium

### 25) "Cheaper Alternative" Finder
- **What it is:** For each major spend, AI suggests lower-cost equivalent option nearby.
- **Why users care:** Immediate cost-cutting suggestions.
- **MVP scope:** Local partner/market dataset + smart substitution tips.
- **Complexity:** Medium
- **Business potential:** High

### 26) Cost per Kilometer Tracker (Dynamic)
- **What it is:** Real-time cost/km including fuel, maintenance reserve, toll, and insurance fraction.
- **Why users care:** True ownership economics.
- **MVP scope:** Live metric card and monthly trend chart.
- **Complexity:** Low
- **Business potential:** High

### 27) Emergency Expense Cushion Goal
- **What it is:** Set a reserve target for sudden repairs and track progress.
- **Why users care:** Financial safety for vehicle emergencies.
- **MVP scope:** Goal setup + auto-contribution suggestions.
- **Complexity:** Low
- **Business potential:** Medium

### 28) Expense Audit Scanner
- **What it is:** Scan service invoice and detect suspicious line items or duplicates.
- **Why users care:** Prevents overcharging.
- **MVP scope:** OCR extraction + anomaly checks using common repair pricing ranges.
- **Complexity:** High
- **Business potential:** High

### 29) Multi-Vehicle Cost Benchmark
- **What it is:** Compare spend efficiency across all user vehicles.
- **Why users care:** Helps decide which vehicle is better to retain/use/sell.
- **MVP scope:** Fleet dashboard for household users.
- **Complexity:** Low
- **Business potential:** Medium

### 30) Tax-ready Export Packs
- **What it is:** One-click categorized export for business/professional users.
- **Why users care:** Saves accounting effort.
- **MVP scope:** Monthly/quarterly formats (PDF/CSV) + category normalization.
- **Complexity:** Low
- **Business potential:** Medium

---

## D) Documents, Compliance, and Legal Safety

### 31) Auto Compliance Radar
- **What it is:** Combined compliance status for RC, insurance, PUC, DL, challans in one score.
- **Why users care:** Avoid fines and legal stress.
- **MVP scope:** Compliance score + risk meter + renewal checklist.
- **Complexity:** Medium
- **Business potential:** High

### 32) One-tap Document Renewal Assistant
- **What it is:** Guided renewal process with reminders, pre-filled details, and status tracking.
- **Why users care:** Removes renewal confusion.
- **MVP scope:** Renewal workflow + renewal timeline cards.
- **Complexity:** Medium
- **Business potential:** High

### 33) DigiLocker Auto Sync Scheduler
- **What it is:** Scheduled background check to keep docs synced from DigiLocker.
- **Why users care:** Always up-to-date documents.
- **MVP scope:** Daily/weekly sync with change alerts.
- **Complexity:** Medium
- **Business potential:** Medium

### 34) Challan Risk Heatmap
- **What it is:** Shows high-risk challan zones by city/time and offense type.
- **Why users care:** Reduces repeated violations.
- **MVP scope:** Historical challan + route overlay + warning prompts.
- **Complexity:** High
- **Business potential:** High

### 35) AI Legal Explanation Cards
- **What it is:** Explain challan/legal language in simple local-language style.
- **Why users care:** Better legal understanding for non-experts.
- **MVP scope:** Plain-language rewrite + action options.
- **Complexity:** Low
- **Business potential:** Medium

### 36) Document Authenticity Checker
- **What it is:** Detect possible fake/edited document anomalies before upload or share.
- **Why users care:** Protects from fraud and rejection.
- **MVP scope:** Basic forgery signal checks + confidence level.
- **Complexity:** High
- **Business potential:** Medium

### 37) Shared Safe Document Vault
- **What it is:** Time-limited secure sharing links for docs with view/download controls.
- **Why users care:** Safer than sending docs over chat apps.
- **MVP scope:** Expiring links + access logs.
- **Complexity:** Medium
- **Business potential:** Medium

### 38) Renewal Price Comparison
- **What it is:** Compares renewal offers from insurers/service partners.
- **Why users care:** Saves money at renewal moments.
- **MVP scope:** Offer ingestion + recommendation ranking.
- **Complexity:** High
- **Business potential:** High

### 39) RTO Request Tracker
- **What it is:** End-to-end status tracking for RTO related requests from app.
- **Why users care:** Visibility and trust in process delays.
- **MVP scope:** Request creation + status timeline + SLA alerts.
- **Complexity:** High
- **Business potential:** High

### 40) "Ready for Traffic Stop" Mode
- **What it is:** Quick screen with all required valid docs and compliance status.
- **Why users care:** Faster, stress-free roadside checks.
- **MVP scope:** One tap from home and offline access pack.
- **Complexity:** Low
- **Business potential:** Medium

---

## E) Safety, Emergency, and Assistance

### 41) Smart Crash Likelihood Detection
- **What it is:** Detect probable crash events from telematics pattern and start SOS workflow.
- **Why users care:** Faster emergency response.
- **MVP scope:** High-impact event detection + auto safety check prompt.
- **Complexity:** High
- **Business potential:** High

### 42) Post-Accident Guided Workflow
- **What it is:** Step-by-step claims and recovery checklist after an incident.
- **Why users care:** Removes chaos during stressful moments.
- **MVP scope:** Incident report, photo checklist, contact support, claim prep.
- **Complexity:** Medium
- **Business potential:** High

### 43) Trusted Circle Live Tracking
- **What it is:** Share temporary live location and trip ETA to selected contacts.
- **Why users care:** Family safety confidence.
- **MVP scope:** Trip-share link + stop-share + event alerts.
- **Complexity:** Medium
- **Business potential:** Medium

### 44) Night Drive Guardian
- **What it is:** Special monitoring mode with fatigue prompts, unsafe route warnings, and check-ins.
- **Why users care:** Reduces nighttime risk.
- **MVP scope:** Night mode detection + periodic check-in + emergency shortcut.
- **Complexity:** Medium
- **Business potential:** Medium

### 45) Nearby Verified Help Network
- **What it is:** Curated and rated emergency services (tow, puncture, battery jumpstart, mechanic).
- **Why users care:** Fast help with trust.
- **MVP scope:** Geo-discovery + ratings + one-tap call/request.
- **Complexity:** Medium
- **Business potential:** High

### 46) SOS Voice Trigger Phrase
- **What it is:** Optional offline-safe trigger phrase to initiate emergency flow quickly.
- **Why users care:** Hands-free emergency usage.
- **MVP scope:** On-device listening in active mode + fallback action flow.
- **Complexity:** High
- **Business potential:** Medium

### 47) Child/Pet Reminder Alert
- **What it is:** Alert users if trip ends and occupancy cues suggest check-back is required.
- **Why users care:** Critical safety protection.
- **MVP scope:** End-trip reminder mode + manual confirm pattern.
- **Complexity:** Medium
- **Business potential:** High

### 48) Breakdown Prediction + Rescue Dispatch
- **What it is:** Predict likely breakdown and pre-offer nearby support before failure.
- **Why users care:** Saves time and stress.
- **MVP scope:** Risk threshold trigger + assistance recommendations.
- **Complexity:** High
- **Business potential:** High

### 49) Safety Score Insurance Bridge
- **What it is:** Use driving score for premium discounts with partner insurers.
- **Why users care:** Direct financial reward for safe driving.
- **MVP scope:** Data-sharing consent + partner integration pilot.
- **Complexity:** High
- **Business potential:** High

### 50) Emergency Evidence Vault
- **What it is:** Immutable timeline for incident evidence (location, time, photos, trip context).
- **Why users care:** Useful for claims and legal disputes.
- **MVP scope:** Locked case folder + exportable report.
- **Complexity:** Medium
- **Business potential:** High

---

## Structural Audit and Overlap Cleanup

During review, these near-overlaps were found and should be managed as single tracks during execution:

- **Forecast track:** Feature 2 (30-Day Cost Forecast), 7 (AI Weekly Action Plan), and 20 (Weekly Owner Report) overlap. Build one shared forecasting engine and render in multiple surfaces.
- **Driving behavior track:** Feature 11 (Driver Trust Score), 17 (Trip Replay), and 20 (AI Coach for Specific Driver) should share one behavior scoring service.
- **Compliance track:** Feature 31 (Auto Compliance Radar), 32 (Renewal Assistant), and 40 (Traffic Stop Mode) should reuse one compliance state model.
- **Safety track:** Feature 41 (Crash Detection), 42 (Post-Accident Workflow), and 50 (Emergency Evidence Vault) should be a single incident-response pipeline.
- **Expense intelligence track:** Feature 21 (Auto Expense), 26 (Cost per KM), and 28 (Expense Audit Scanner) should use a common expense intelligence layer.

This reduces duplicate backend work and keeps feature quality higher.

---

## Feature Metadata Index (All 50 Features)

1. Vehicle Twin - Dep: TLM,AI+ | Risk: H | Mon: PREM,B2B  
2. 30-Day Cost Forecast - Dep: NONE,AI+ | Risk: M | Mon: RET,PREM  
3. Trip Cost Simulator - Dep: PARTNER,AI+ | Risk: M | Mon: RET,COMM  
4. Failure Probability Alerts - Dep: TLM,AI+ | Risk: H | Mon: PREM  
5. AI Mechanic Chat Mode - Dep: AI+ | Risk: M | Mon: PREM  
6. Voice-first Log Expense - Dep: NONE | Risk: L | Mon: RET  
7. AI Weekly Action Plan - Dep: NONE,AI+ | Risk: L | Mon: RET,PREM  
8. Smart Spending Leak Detection - Dep: NONE,AI+ | Risk: M | Mon: PREM  
9. Predictive Maintenance Calendar - Dep: NONE,AI+ | Risk: M | Mon: RET  
10. Ask-Anything Document AI - Dep: AI+ | Risk: M | Mon: PREM  
11. Driver Trust Score - Dep: TLM | Risk: M | Mon: PREM,B2B  
12. Valet Mode with Geo-Fence Lock - Dep: TLM | Risk: H | Mon: PREM  
13. Silent Route Deviation Alert - Dep: TLM | Risk: M | Mon: PREM  
14. Family Role Permissions - Dep: NONE | Risk: M | Mon: RET,PREM  
15. Shared Vehicle Timeline - Dep: NONE | Risk: M | Mon: RET  
16. Teen Driver Safety Mode - Dep: TLM | Risk: M | Mon: PREM  
17. Trip Replay with Event Pins - Dep: TLM | Risk: M | Mon: RET,PREM  
18. Borrowed Car Agreement - Dep: NONE | Risk: L | Mon: RET  
19. Driver Leaderboard - Dep: TLM | Risk: L | Mon: RET  
20. AI Coach for Specific Driver - Dep: TLM,AI+ | Risk: M | Mon: PREM  
21. Auto Expense from Trip Signatures - Dep: TLM,AI+ | Risk: M | Mon: PREM  
22. Fuel Pump Price and Trust Index - Dep: PARTNER | Risk: H | Mon: COMM  
23. Best Time-to-Refuel Alert - Dep: NONE,AI+ | Risk: M | Mon: RET,PREM  
24. Subscription and Fixed Cost Tracker - Dep: NONE | Risk: L | Mon: RET  
25. Cheaper Alternative Finder - Dep: PARTNER,AI+ | Risk: M | Mon: COMM  
26. Cost per Kilometer Tracker - Dep: NONE | Risk: L | Mon: RET  
27. Emergency Expense Cushion Goal - Dep: NONE | Risk: L | Mon: RET  
28. Expense Audit Scanner - Dep: AI+ | Risk: H | Mon: PREM  
29. Multi-Vehicle Cost Benchmark - Dep: NONE | Risk: L | Mon: RET,PREM  
30. Tax-ready Export Packs - Dep: NONE | Risk: L | Mon: PREM  
31. Auto Compliance Radar - Dep: REG | Risk: M | Mon: RET,PREM  
32. One-tap Document Renewal Assistant - Dep: REG,PARTNER | Risk: M | Mon: COMM  
33. DigiLocker Auto Sync Scheduler - Dep: REG | Risk: M | Mon: RET  
34. Challan Risk Heatmap - Dep: REG,AI+ | Risk: H | Mon: PREM  
35. AI Legal Explanation Cards - Dep: AI+ | Risk: L | Mon: RET  
36. Document Authenticity Checker - Dep: AI+ | Risk: H | Mon: PREM,B2B  
37. Shared Safe Document Vault - Dep: NONE | Risk: M | Mon: PREM  
38. Renewal Price Comparison - Dep: PARTNER,REG | Risk: H | Mon: COMM  
39. RTO Request Tracker - Dep: REG,PARTNER | Risk: H | Mon: COMM  
40. Ready for Traffic Stop Mode - Dep: REG | Risk: L | Mon: RET  
41. Smart Crash Likelihood Detection - Dep: TLM,AI+ | Risk: H | Mon: PREM,B2B  
42. Post-Accident Guided Workflow - Dep: PARTNER | Risk: M | Mon: COMM,RET  
43. Trusted Circle Live Tracking - Dep: TLM | Risk: M | Mon: PREM  
44. Night Drive Guardian - Dep: TLM,AI+ | Risk: M | Mon: PREM  
45. Nearby Verified Help Network - Dep: PARTNER | Risk: M | Mon: COMM  
46. SOS Voice Trigger Phrase - Dep: AI+ | Risk: H | Mon: PREM  
47. Child/Pet Reminder Alert - Dep: TLM,AI+ | Risk: M | Mon: PREM  
48. Breakdown Prediction + Rescue Dispatch - Dep: TLM,PARTNER,AI+ | Risk: H | Mon: COMM,PREM  
49. Safety Score Insurance Bridge - Dep: TLM,PARTNER,REG | Risk: H | Mon: COMM  
50. Emergency Evidence Vault - Dep: NONE | Risk: M | Mon: PREM,RET  

---

## Top 12 Execution Shortlist (Decision-Ready)

### 1) AI Assistant Action Completion (existing improvement)
- **Why now:** Fastest conversion from chat usage to completed actions.
- **MVP boundary:** Action chips for expense log, reminders, document share, call support.
- **Dependency risk:** Low (no external partner needed).
- **KPI goal:** +20% AI-to-action completion rate in 30 days.
- **Monetization path:** RET -> PREM upsell later.

### 2) Expense Logging Friction Reduction (existing improvement)
- **Why now:** Directly increases data quality for all downstream AI features.
- **MVP boundary:** Location-aware prefill + recent pattern suggestions.
- **Dependency risk:** Low.
- **KPI goal:** +30% increase in weekly expense entries per active user.
- **Monetization path:** RET.

### 3) Document Upload Success Rate (existing improvement)
- **Why now:** Core trust blocker if OCR/upload fails.
- **MVP boundary:** Pre-upload blur/glare/crop checks + retake hints.
- **Dependency risk:** Low.
- **KPI goal:** Reduce failed document upload attempts by 40%.
- **Monetization path:** RET.

### 4) Vehicle Health Score Explainability (existing improvement)
- **Why now:** Increases confidence in predictive recommendations.
- **MVP boundary:** Score components, "score changed because", and next actions.
- **Dependency risk:** Medium (needs scoring decomposition logic).
- **KPI goal:** +25% click-through on health recommendations.
- **Monetization path:** PREM.

### 5) Auto Expense from Trip Signatures (feature 21)
- **Why now:** Strong "magic moment" and immediate differentiation.
- **MVP boundary:** Detect only fuel and toll first, with approve/reject queue.
- **Dependency risk:** Medium (telematics quality dependency).
- **KPI goal:** 40% of detected expenses confirmed by users.
- **Monetization path:** PREM.

### 6) Driver Trust Score (feature 11)
- **Why now:** Supports family-sharing and future insurance partnerships.
- **MVP boundary:** Weekly score + behavior reasons + trend line.
- **Dependency risk:** Medium (event calibration needed).
- **KPI goal:** 25% of shared-vehicle users engage weekly with score.
- **Monetization path:** PREM, B2B.

### 7) Auto Compliance Radar (feature 31)
- **Why now:** High-frequency legal pain and high retention trigger.
- **MVP boundary:** Unified compliance score for RC/DL/Insurance/PUC/challan.
- **Dependency risk:** Medium (document freshness and rule mapping).
- **KPI goal:** +30% renewal reminder conversion.
- **Monetization path:** RET, PREM.

### 8) Telematics Value Presentation (existing improvement)
- **Why now:** Converts raw telematics into understandable user value.
- **MVP boundary:** End-trip summary with money, wear, and safety impact.
- **Dependency risk:** Medium (trip event quality).
- **KPI goal:** +20% trip-summary open-to-save ratio.
- **Monetization path:** RET, PREM.

### 9) Weekly Owner Report (existing improvement)
- **Why now:** Builds habitual weekly return behavior.
- **MVP boundary:** Single report with spend, compliance, safety, next 3 tasks.
- **Dependency risk:** Low.
- **KPI goal:** +12% week-4 retention.
- **Monetization path:** RET.

### 10) Post-Accident Guided Workflow (feature 42)
- **Why now:** High emotional value and strong referral potential.
- **MVP boundary:** Incident checklist + evidence capture + support contact flow.
- **Dependency risk:** Medium (help-network readiness).
- **KPI goal:** 60% of SOS events complete full guided flow.
- **Monetization path:** COMM, RET.

### 11) Notification Relevance Filtering (existing improvement)
- **Why now:** Reduces notification fatigue and increases trust.
- **MVP boundary:** Priority labels, digest mode, quiet hours.
- **Dependency risk:** Low.
- **KPI goal:** +25% notification open rate with lower opt-out.
- **Monetization path:** RET.

### 12) DigiLocker Completion Experience (existing improvement)
- **Why now:** Existing integration value is under-realized without clarity.
- **MVP boundary:** Import summary + missing docs + next action prompts.
- **Dependency risk:** Low/Medium (sync consistency).
- **KPI goal:** +35% DigiLocker-linked users completing document profile.
- **Monetization path:** RET.

---

## 90-Day Rollout Plan (Now / Next / Later)

### Phase 1: Day 0-30 (Fast value, low-medium complexity)

- AI Assistant Action Completion
- Expense Logging Friction Reduction
- Document Upload Success Rate
- Notification Relevance Filtering
- DigiLocker Completion Experience

**Why this phase:** Improves activation and data quality immediately; minimal external blockers.

### Phase 2: Day 31-60 (Differentiation with current data)

- Vehicle Health Score Explainability
- Telematics Value Presentation
- Weekly Owner Report
- Auto Compliance Radar (MVP)

**Why this phase:** Uses existing app data to create visible unique value and retention loops.

### Phase 3: Day 61-90 (Higher moat, controlled risk)

- Auto Expense from Trip Signatures
- Driver Trust Score
- Post-Accident Guided Workflow

**Why this phase:** High-differentiation features that need calibrated data and support operations.

### Sequencing Logic

- Build data-capture and UX reliability first.
- Then build interpretation and insight layers.
- Then launch automation/prediction flows where trust and data confidence are high.

---

## Privacy, Consent, and Trust Guardrails (Must-Have)

Apply these guardrails before scaling telematics/AI-heavy features:

### 1) Explicit Consent by Feature
- Separate consents for trip tracking, behavior scoring, emergency automation, and insurance data sharing.
- No bundled consent toggles.

### 2) Explainability by Default
- Every score and alert must include "why this was shown" and "what data was used".
- Include confidence labels for probabilistic predictions.

### 3) False Positive Controls
- Add user feedback actions: "Not accurate", "Ignore this suggestion", "Do not show again for 7 days".
- Use this feedback to calibrate model thresholds.

### 4) Data Minimization and Retention
- Store only required telemetry granularity for the feature objective.
- Define retention windows for raw location and event data; auto-delete stale sensitive data.

### 5) Sensitive Event Handling
- Crash/SOS automation should request fast confirmation where feasible.
- For no-response cases, use staged escalation policy (contact -> trusted circle -> service).

### 6) User-Controlled Sharing
- Sharing permissions must be revocable instantly.
- Show an access audit trail for every shared vehicle/document.

### 7) Regional and Legal Clarity
- Keep legal/compliance copy in simple language and local-language support.
- Use explicit disclaimers where partner or regulatory data can be delayed.

---

## Do Not Build Yet (Watchlist)

These ideas are promising but should wait until core reliability and partner readiness are stronger:

- Feature 38: Renewal Price Comparison (partner + regulatory heavy)
- Feature 39: RTO Request Tracker (state/process variability high)
- Feature 49: Safety Score Insurance Bridge (requires mature risk model + insurer trust)
- Feature 36: Document Authenticity Checker (high false-positive risk)
- Feature 46: SOS Voice Trigger Phrase (high reliability and privacy requirements)

Revisit after Phase 2 metrics are healthy and trust guardrails are fully implemented.

---

## Unified Scorecard and Top 5 (Single-File Decision Section)

This section replaces the need for a separate scorecard file.

### Scoring assumptions
- Team capacity: Medium (4-7 devs)
- Budget: Moderate
- Planning horizon: 90 days

### Formula
`Total Score = (Impact x 25) + (Retention x 20) + (Revenue x 15) + (Feasibility x 15) + (DataReadiness x 10) + (Differentiation x 10) - (ComplianceRisk x 5)`

### Candidate 12 score snapshot
- AI Assistant Action Completion: 420 (Build Now)
- Expense Logging Friction Reduction: 395 (Build Now)
- Document Upload Success Rate: 375 (Build Now)
- Vehicle Health Score Explainability: 340 (Build Next)
- Auto Expense from Trip Signatures: 375 (Build Now)
- Driver Trust Score: 325 (Build Next)
- Auto Compliance Radar: 370 (Build Now)
- Telematics Value Presentation: 335 (Build Next)
- Weekly Owner Report: 375 (Build Now)
- Post-Accident Guided Workflow: 340 (Build Next)
- Notification Relevance Filtering: 350 (Build Next)
- DigiLocker Completion Experience: 315 (Build Next)

### Final Top 5 build order
1. AI Assistant Action Completion
2. Expense Logging Friction Reduction
3. Auto Compliance Radar
4. Weekly Owner Report
5. Auto Expense from Trip Signatures

### Top 5 KPI targets
- AI Assistant Action Completion: +20% AI-to-action completion rate (2 weeks).
- Expense Logging Friction Reduction: +30% weekly logs per active user (2-3 weeks).
- Auto Compliance Radar: +30% renewal reminder conversion (3-4 weeks).
- Weekly Owner Report: +12% week-4 retention among exposed users (4-6 weeks).
- Auto Expense from Trip Signatures: 40% detected-expense confirmation rate (4 weeks).

### Top 5 rollout in 90 days
- Day 0-30: AI Assistant Action Completion, Expense Logging Friction Reduction
- Day 31-60: Auto Compliance Radar, Weekly Owner Report
- Day 61-90: Auto Expense from Trip Signatures (staged rollout)


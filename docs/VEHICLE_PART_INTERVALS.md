# Vehicle Part Replacement Intervals – Production Guide

This doc explains **how to know** correct replacement intervals per vehicle/part and **how it is implemented** in Gupio for production-grade, correct data.

---

## 1. How replacement intervals work in the app

- Each **part type** (e.g. ENGINE_OIL, BRAKE_PADS, BATTERY) has a **time** (months) and **distance** (km) limit.
- When a part is **replaced** (via a service record), we store `lastReplacedAt` and compute **next replacement due** using:
  - **Vehicle-specific interval** when available (from DB: make/model/year).
  - **DEFAULT (generic) interval** when no vehicle-specific row exists.
  - **In-memory fallback** when the DB has no intervals (e.g. before seed).
- **Predictions** (e.g. “when will this part be due?”) use the same interval and the vehicle’s **current odometer** and **average daily running (ADR)**.

So “correct” data means: **correct intervals per (vehicle, part)**. That comes from **where you get the data** and **how you store it**.

---

## 2. Where to get correct data (sources)

### A. OEM (manufacturer) service schedules – best for production

- **What:** Official service / maintenance schedules from the vehicle manufacturer (e.g. Maruti Suzuki, Hyundai, Honda, Tata, Mahindra).
- **Where:**
  - Owner’s manual / service booklet (PDF or printed).
  - Manufacturer’s India website (e.g. “Service schedule” or “Maintenance” for a model).
  - Sometimes model-specific PDFs (e.g. “Swift service schedule”).
- **Format:** Usually a table: part/service name, interval in km and/or months (e.g. “Every 10,000 km or 6 months” for engine oil).
- **Why correct:** Same as what workshops and warranty follow; varies by make, model, and often year/variant.

### B. Generic / industry guidelines – fallback

- **What:** General guidelines (e.g. engine oil 10,000 km or 6 months, brake pads 30,000 km).
- **Where:** Your current in-code `PART_LIFECYCLE_FALLBACK` in `warranty.service.ts`, or sites like Team-BHP, CarWale (for reference only).
- **Why use:** When you don’t have OEM data for a vehicle; better than nothing but not vehicle-specific.

### C. Third-party data providers (optional)

- **What:** APIs or datasets that return maintenance schedules by VIN or make/model/year.
- **Where:** Some global providers (e.g. for US/EU) offer this; for India you’d need to check if any provider has OEM-level data.
- **Use case:** If you scale to many makes/models, buying curated data can save manual entry; still validate against OEM where possible.

#### What you get from these APIs – and can you get "exact" data?

| What they typically provide | "Exact" or not |
|-----------------------------|----------------|
| **OEM-style schedules** | Providers (e.g. Vehicle Databases, CarScan, Edmunds) claim **OEM-compliant** or **manufacturer-recommended** schedules. You get the same *type* of data as the manual: which services at which mileage/time (e.g. "Change engine oil and filter" at 20,000 km). |
| **Query by VIN or year/make/model** | Schedules for that specific vehicle (and sometimes trim), so **vehicle-specific** and close to manufacturer recommendations. |
| **Mileage-based intervals** | Tasks at fixed mileage points (e.g. 10k, 20k, 30k miles/km). You map these to your part types (e.g. "Change engine oil" → ENGINE_OIL) and derive **interval km** (and months if the API gives time-based intervals). |
| **Cost / labor estimates** | Some APIs include cost and labor time. Useful for UX; not required for "when to replace" logic. |

**Can you get "exact" data?**  
- **In practice, close to exact:** The data is intended to mirror OEM recommendations (same tasks, same intervals). For supported vehicles it's usually accurate enough for production.  
- **Not 100% guaranteed:** Coverage can miss new models, regional variants, or mid-year changes. Regional differences (e.g. India vs US specs) may apply. So **validate with OEM manuals** for critical models when in doubt.  
- **India-specific:** Most commercial APIs are **US/EU focused**. Indian VIN decoding exists (e.g. Vincario), but **maintenance schedule APIs with strong India OEM coverage** are less common. For Indian vehicles you may still need OEM manuals or manually curated `PartReplacementInterval` rows until a provider clearly supports India.

#### For Indian vehicles: what % "correct report" can you expect from APIs?

| Data you need | From global maintenance APIs (Vehicle Databases, CarScan, Edmunds) | From India-focused APIs (Autorox, CarsXE India, Vincario) |
|---------------|-------------------------------------------------------------------|----------------------------------------------------------|
| **Maintenance intervals** (e.g. oil every 10k km, brake pads 30k km) | **~0–25%** for Indian market vehicles. These APIs use US/EU OEM data; Indian models (Maruti, Hyundai India, Tata, Mahindra) often have different intervals, model names, and variants. Results may be wrong, missing, or US-spec. | **~0%** today. Autorox has Vehicle Catalog + Spares + Repairs but does not expose OEM service-interval tables. CarsXE/Vincario offer VIN decode (make/model/year) in India, not maintenance schedules. So no API currently gives "exact" interval data for Indian OEMs. |
| **Vehicle identity** (make, model, year from VIN) | Unreliable for Indian VINs; many APIs don’t support India VIN structure. | **~70–90%** for mainstream Indian VINs (Maruti, Hyundai, Honda, Tata, etc.) once the provider supports India. Use this to *look up* your own `PartReplacementInterval` rows (from OEM manuals). |

**Bottom line for India:** For a **correct maintenance report** (when to change each part), do **not** rely on third-party APIs to give you intervals. Use **OEM manuals** or your own curated `PartReplacementInterval` data. Use APIs only to get **make/model/year** from VIN, then match to your table. Expected accuracy for the **full report** (intervals) from APIs alone: **~0–25%** for Indian vehicles; for **identity only**, India-capable decoders can reach **~70–90%**.

**Example providers:** Vehicle Databases (VIN or year/make/model, OEM schedules, cost estimates); CarScan (US, OEM + non-OEM, mileage/cost/parts); Edmunds (model year, maintenance frequency); Afteriize (Europe, VIN/license plate); Vincario (Indian VIN decode – check for maintenance intervals).

**If you integrate an API:** Call it when adding a vehicle (or on demand) with VIN or make/model/year; map returned "services at X km" to your `ServicePartType` and insert/update `PartReplacementInterval` with `source = 'THIRD_PARTY_API'`; prefer providers that state OEM source and support your market (India) for best accuracy.

### Recommendation for production

1. **Default (generic):** Keep your current values as **DEFAULT** in the DB (seeded via `seed-part-intervals.ts`). This is your fallback when no vehicle-specific row exists.
2. **Vehicle-specific:** Add intervals from **OEM manuals** for the most common makes/models in your user base (e.g. Maruti Swift, Brezza, Dzire; Hyundai i20, Creta; Honda City; etc.).
3. **Source field:** Always set `source` when inserting (e.g. `OEM_MANUAL`, `GENERIC`, `TEAM_BHP`) so you can show “Based on Maruti Suzuki manual” in the app and audit later.

---

## 3. How it is implemented (production-ready)

### 3.1 Data model: `PartReplacementInterval`

- **Table:** `PartReplacementInterval` (Prisma schema in `prisma/prisma/schema.prisma`).
- **Columns:**  
  `make`, `model`, `yearMin`, `yearMax`, `partType`, `intervalMonths`, `intervalKm`, `defaultWarrantyMonths`, `source`.
- **Meaning:**
  - **DEFAULT row:** `make = 'DEFAULT'`, `model = ''`, `yearMin = 0`, `yearMax = 9999` → used when no vehicle-specific row matches. One row per `partType`.
  - **Vehicle-specific row:** e.g. `make = 'Maruti Suzuki'`, `model = 'Swift'`, `yearMin = 2018`, `yearMax = 2023`, `partType = ENGINE_OIL`, `intervalMonths = 6`, `intervalKm = 10000`, `source = 'OEM_MANUAL'`.
- **Matching:** For a vehicle with (make, model, year), we load all rows for that `partType`, filter to “DEFAULT” or matching make/model/year, then **pick the most specific** (model+year > model > make > DEFAULT). So vehicle-specific data overrides DEFAULT.

### 3.2 Code: `warranty.service.ts`

- **`getLifecycleForVehiclePart(vehicleId, partType)`**  
  Returns `{ months, km, defaultWarrantyMonths, source }`:
  - Loads vehicle (make, model, year).
  - Queries `PartReplacementInterval` for that `partType`.
  - Filters to DEFAULT row or rows matching vehicle make/model/year.
  - Sorts by specificity; returns first (most specific) or in-memory fallback if DB/query fails.
- **`createServiceRecord`**  
  When adding a part to a service record, uses `getLifecycleForVehiclePart(vehicleId, part.partType)` to set `nextReplacementDue` and warranty.
- **`getUpcomingReplacements`**  
  Uses the same function so “due soon” and “overdue” are based on vehicle-specific or DEFAULT intervals.

So production data is “correct” if:
- DEFAULT rows are seeded (generic but consistent).
- You add OEM-based rows for the vehicles you care about.

---

## 4. Steps to get production-level correct data

### Step 1: Run migration and seed (once per environment)

```bash
# From repo root
pnpm prisma:migrate:dev   # applies migration 20260221000000_add_part_replacement_interval (creates PartReplacementInterval table)
pnpm prisma:generate      # regenerate client (already run if you added the model)
# Seed DEFAULT intervals (from Backend with DATABASE_URL set):
cd Backend && npx ts-node -r tsconfig-paths/register src/scripts/seed-part-intervals.ts
# Or: pnpm exec ts-node -r dotenv/config -r tsconfig-paths/register src/scripts/seed-part-intervals.ts
```

If you have migration drift, apply the SQL in `prisma/prisma/migrations/20260221000000_add_part_replacement_interval/migration.sql` manually to the `customer` schema, then run the seed script.

This fills **DEFAULT** intervals (same as current in-code values). After this, the app uses the DB; if the table is empty it still works via in-memory fallback.

### Step 2: Add vehicle-specific intervals (OEM data)

#### How to get OEM manuals (India)

Use **official manufacturer websites** to download owner's manuals or service schedules (PDF/HTML). The manual usually has a section like "Periodic maintenance", "Service schedule", or "Inspection and maintenance" with a table: **item** (e.g. Engine oil, Brake pads) and **interval** (km and/or months). Map those to your `ServicePartType` and insert into `PartReplacementInterval`.

**Direct links (India) – check for latest URLs:**

| OEM | Where to get manuals / service schedule |
|-----|------------------------------------------|
| **Maruti Suzuki** | **Car Care → Owner's Manual:** [marutisuzuki.com/service/car-care](https://www.marutisuzuki.com/service/car-care) — manuals by model (e.g. Alto, Swift, Tour S). PDFs often from `marutistoragenew.blob.core.windows.net/msilintiwebpdf/`. Look for "Inspection and Maintenance" / periodic maintenance table. |
| **Hyundai India** | **Owner's Manual:** [hyundai.com/in/en/connect-to-service/hyundai-service/owners-manual](https://www.hyundai.com/in/en/connect-to-service/hyundai-service/owners-manual) — PDFs by model (Grand i10, i20, Creta, Venue, Verna, etc.). **PMS (Preventive Maintenance) charts:** [hyundai.com/in/en/connect-to-service/hyundai-service/pms-charts](https://www.hyundai.com/in/en/connect-to-service/hyundai-service/pms-charts) — intervals for engine oil, filters, brake fluid, spark plugs, etc. by model. |
| **Tata Motors** | **Owner's Manual:** [tmlcars.tatamotors.com/service/owners/owners-manual](https://tmlcars.tatamotors.com/service/owners/owners-manual) — PDFs for Punch, Safari, Harrier, Nexon, Tiago, Tigor, etc. **EVs:** [ev.tatamotors.com/support](https://ev.tatamotors.com/support.html) for Nexon.ev, Punch.ev, etc. |
| **Mahindra** | **Owner's Manual:** [mvault.mahindra.com/owners_manual](https://mvault.mahindra.com/owners_manual) — select model (XUV700, Thar, XUV500, Bolero, etc.). **TIS:** [mahindra-tis.com](https://www.mahindra-tis.com/en/?id=Owners_Manual_) — technical info and manuals. Look for "Maintenance schedule" / "Service schedule" in the PDF. |
| **Honda Cars India** | **Owner's manual:** [hondacarindia.com/ownersmanual](https://www.hondacarindia.com/ownersmanual) — model-wise PDFs (City, Jazz, Amaze, etc.). Service schedule is in the manual or in the service book. |
| **Kia India** | **Owner's Manual / Service:** [kia.com/in](https://www.kia.com/in) — go to Owner section or Support → Manuals. |
| **Toyota India** | **Owner's Manual:** [toyotabharat.com](https://www.toyotabharat.com) — Owners → Manuals / Service schedule. |
| **MG Motor India** | **Support / Manuals:** [mgmotor.co.in](https://www.mgmotor.co.in) — Owner support or Downloads. |
| **Other brands** | Search: "[Brand] India owner manual PDF" or "[Brand] India service schedule". Prefer the brand's official **in/en** or **.in** site; avoid random PDF sites for accuracy. |

**What to extract from the manual:**  
Find the **periodic maintenance** or **service schedule** table. You’ll see rows like: "Engine oil & filter – every 10,000 km or 1 year", "Air filter – every 20,000 km", "Brake pads – inspect every 15,000 km / replace as needed". Map each line to your `ServicePartType` (e.g. ENGINE_OIL, AIR_FILTER, BRAKE_PADS), note **intervalKm** and **intervalMonths**, then insert one row per (make, model, year range, partType) in `PartReplacementInterval` with `source = 'OEM_MANUAL'`.

For each make/model you want to support:

1. Get the official service schedule (manual or website) using the links above.
2. Map “service items” to your `ServicePartType` (e.g. “Engine oil” → ENGINE_OIL, “Brake pad” → BRAKE_PADS).
3. Insert rows into `PartReplacementInterval` with:
   - `make` = exact string (e.g. `"Maruti Suzuki"` – match how it’s stored in `CustomerVehicle.make`).
   - `model` = e.g. `"Swift"`.
   - `yearMin` / `yearMax` = range of model years this schedule applies to (or null for “all years” if you don’t store year ranges).
   - `partType`, `intervalMonths`, `intervalKm`, `defaultWarrantyMonths`, `source = 'OEM_MANUAL'`.

**Example (SQL):**

```sql
INSERT INTO customer."PartReplacementInterval" (
  id, make, model, "yearMin", "yearMax", "partType",
  "intervalMonths", "intervalKm", "defaultWarrantyMonths", source,
  "createdAt", "updatedAt"
) VALUES
  (gen_random_uuid(), 'Maruti Suzuki', 'Swift', 2018, 2023, 'ENGINE_OIL', 6, 10000, 0, 'OEM_MANUAL', NOW(), NOW()),
  (gen_random_uuid(), 'Maruti Suzuki', 'Swift', 2018, 2023, 'OIL_FILTER', 6, 10000, 0, 'OEM_MANUAL', NOW(), NOW());
```

You can also expose an **admin API** or a small script that reads a CSV/JSON and inserts/updates `PartReplacementInterval` so non-developers can add OEM data.

#### Getting parts intervals through the AI agent (public OEM data)

Because OEM interval data is publicly available (manuals, PMS charts), the **AI agent** can suggest intervals for the customer’s vehicle and optionally save them so reminders use vehicle-specific data.

**How it works:**

1. **Tool:** `get_or_suggest_parts_interval` (in `tools.service.ts`). The agent calls it when the user asks things like “When should I change oil for my car?”, “What are the service intervals for my Swift?”, or “Get OEM intervals for my vehicle.”
2. **Vehicle:** The tool uses the customer’s vehicle (make, model, year) from the DB. If the vehicle already has vehicle-specific intervals (saved earlier or from manual entry), it returns those and does not call AI.
3. **AI suggestion:** If not, it calls `oem-interval.service`: **suggestIntervalsFromAI(make, model, year)**. The service uses Gemini with a **prompt that includes a reference table** of typical Indian OEM intervals (Maruti, Hyundai, Tata, Mahindra, Honda) derived from public manuals. The model returns a JSON array of part types and intervals (km, months).
4. **Optional save:** The user can say “save these intervals” or the tool can be called with `saveToDatabase: true`. Then **saveSuggestedIntervals** writes rows to `PartReplacementInterval` with `source = 'AI_SUGGESTED'`. Future “due soon” / “overdue” reminders and service records use these intervals.
5. **Response:** The agent tells the user the suggested (or saved) intervals and can add: “For exact values, verify with the manufacturer manual.”

**Flow summary:**

- User: “What are the service intervals for my Maruti Swift?”
- Agent → tool `get_or_suggest_parts_interval(vehicleId)`.
- Tool loads vehicle (e.g. Maruti Suzuki, Swift, 2020). If no vehicle-specific intervals → calls `suggestIntervalsFromAI("Maruti Suzuki", "Swift", 2020)` → gets ENGINE_OIL 10000 km/6 months, etc. → returns to agent.
- User: “Save these intervals.” → Agent calls tool again with `saveToDatabase: true` → intervals saved → “I’ve added them; future reminders will use these.”

**Code:**

- **Service:** `Backend/src/services/oem-interval.service.ts` — `suggestIntervalsFromAI()`, `saveSuggestedIntervals()`.
- **Tool:** `get_or_suggest_parts_interval` in `Backend/src/services/tools.service.ts`.
- **Reference data:** The prompt in `oem-interval.service.ts` embeds a short table of typical Indian OEM intervals (from public manuals). You can extend it as you add more makes/models.

**Limits:**

- Intervals are **suggested** from public OEM-style knowledge in the prompt, not scraped live from the internet. For maximum accuracy, users can still verify with the manual (links in “How to get OEM manuals” above).
- The agent does **not** fetch or parse PDFs/HTML automatically; that would require a separate pipeline (e.g. cron that fetches known OEM URLs and parses tables). The current flow is “AI suggests from embedded reference → user can save.”

### Step 3: Normalize make/model in your app

- Ensure **vehicle creation/update** stores make and model in a **consistent format** (e.g. “Maruti Suzuki” vs “Maruti” – pick one and use it in both `CustomerVehicle` and `PartReplacementInterval`).
- Matching in `getLifecycleForVehiclePart` is **case-insensitive** for make/model.
- If you have **variant** (e.g. “Swift VXI”), you can either ignore it and use model-only, or add a variant column later and extend matching.

### Step 4: Show source in the app (optional but recommended)

- When showing “Replace in X km or Y months”, also show **source** (e.g. “As per Maruti Suzuki manual” when `source = 'OEM_MANUAL'` and make/model match). This builds trust and makes it clear when you’re using generic vs OEM data.

---

## 5. Summary

| Question | Answer |
|----------|--------|
| **How do I know the correct time/km per vehicle and part?** | Use **OEM service schedules** (manual/website) for the make/model/year. Use **generic** intervals as DEFAULT when OEM is not available. |
| **How is it implemented?** | Table **PartReplacementInterval** stores DEFAULT (generic) and vehicle-specific (make/model/year) intervals. **warranty.service** uses **getLifecycleForVehiclePart** to pick the best match and then computes next replacement and “due soon” alerts. |
| **How do I get production-level correct data?** | (1) Seed DEFAULT from current values. (2) Add OEM-based rows for popular makes/models. (3) Normalize make/model in the app. (4) Optionally show “source” in the UI. |
| **What if I don’t have OEM data yet?** | The app still works: DEFAULT (seeded) or in-memory fallback gives one consistent set of intervals for all vehicles until you add vehicle-specific rows. |

After migration + seed, your project **predicts part replacement** using **DB-driven intervals** (vehicle-specific when you add them, DEFAULT otherwise), so production data can stay correct and auditable.

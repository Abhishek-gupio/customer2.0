# Parts & Warranty flow

## Overview

- **Parts & Warranty** always shows the **primary vehicle** (the vehicle set as primary in the app).
- Part replacement intervals (e.g. “change tyre at 60k km”) come from the **OEM manual** when possible, via the OEM scraper.
- **Odometer** is updated globally from the **Odometer** tab (replaces the old History tab); that value drives predictions for when parts need to be changed.
- When a **part is changed**, that is recorded by adding an expense in the **Service** category (with part type and optional odometer). That creates a service record and updates part/warranty state.

---

## 1. Primary vehicle only

- **Warranty Status** screen: uses primary vehicle only (`vehicles.find(v => v.isPrimary) || vehicles[0]`).
- **Service History** screen: uses primary vehicle only; fetches `/v1/expenses/warranty/vehicles/:vehicleId/history` for that vehicle.
- **Odometer** tab: shows and updates odometer for the primary vehicle only.

Set the correct car as primary in the Vehicles section so Parts & Warranty and Odometer apply to that vehicle.

---

## 2. OEM manual intervals (scraper)

- For the primary vehicle, part intervals (e.g. 60,000 km for tyres) are taken from the **OEM manual / website** when available.
- Backend: `fetchAndSaveIntervalsForVehicle(vehicleId)` in `oem-scraper.service.ts` scrapes configured OEM URLs (e.g. Hyundai PMS, Maruti/Tata PDFs) and saves rows into **PartReplacementInterval** with source `OEM_WEBSITE`.
- This is triggered:
  - When a vehicle is **created** or **updated** (make/model/year).
  - When the user opens **Parts & Warranty**: the app calls **POST /v1/expenses/warranty/primary/refresh-oem** (fire-and-forget) so the primary vehicle’s intervals are refreshed from the OEM.
- `warranty.service.ts` uses **getLifecycleForVehiclePart(vehicleId, partType)** which **prefers OEM_WEBSITE** (scraped from the original OEM) over DEFAULT or in-memory fallbacks. When OEM fetch fails or is not configured, data may be incorrect; the app shows a warning and each part card shows whether the source is "From OEM manual" or "Not from OEM". So if the OEM manual says “60k km for tyre”, that value is used for predictions.

---

## 3. Global odometer (Odometer tab)

- The bottom tab previously labeled **History** is now **Odometer**.
- **Odometer** screen:
  - Shows the **primary vehicle** and its **current odometer**.
  - Lets the user:
    - **Enter a new reading** (km) and save → updates `CustomerVehicle.currentOdometer` and creates an **OdometerLog**.
    - **Update from dashboard photo** → uses existing AI/OCR flow to extract reading and then updates as above.
- Backend:
  - **POST /v1/vehicles/:id/odometer** (body: `{ reading }`) creates an OdometerLog and updates the vehicle’s `currentOdometer`.
  - **POST /v1/vehicles/:id/odometer-ai** (photo) does the same using OCR.
- Predictions (e.g. “when to change parts”) use:
  - **Current odometer** from the vehicle.
  - **Previous vs current** from OdometerLog for ADR (average daily running) and future date estimates.

So: **always update odometer from the Odometer tab** (or during fuel/service entries) so Parts & Warranty predictions are accurate.

---

## 4. Part changes from Expense (Service category)

- When a **part is changed** (e.g. tyre, battery, engine oil), record it by adding an **expense** with:
  - **Category:** **Service** (or Other, for part-related work).
  - **Vehicle:** Typically the primary vehicle (default in Manual Entry).
  - **Part serviced:** Select the part type (e.g. Engine Oil, Tyres, Battery).
  - **Odometer reading:** Optional but recommended; if provided, it updates the vehicle odometer and is stored on the service record.
- Backend (e.g. **Manual Entry** → **POST /v1/expenses** with `category: "SERVICE"` and `parts: [{ partType, cost }]`):
  - Creates the expense.
  - If `category` is SERVICE (or OTHER) and `parts` is non-empty, it **creates a ServiceRecord** with those parts (via **warrantyService.createServiceRecord**), linked to the expense and vehicle.
- That service record:
  - Updates **last replaced** date and **next replacement due** for each part type.
  - Sets **warranty** (e.g. warranty months) when applicable.
- **Warranty Status** and **Service History** then show the new state and history for the primary vehicle.

So: **part changes are captured by adding a Service (or Other) expense with the part(s) and optional odometer**; no separate “Log Service” is required for this flow.

---

## Summary

| What you want           | How to do it |
|-------------------------|--------------|
| See parts & warranty   | Open Parts & Warranty (always primary vehicle; OEM intervals refreshed on open). |
| Use OEM intervals      | Ensure vehicle make/model/year is set; scraper runs on add/update and when opening warranty; optional **POST /warranty/primary/refresh-oem**. |
| Update odometer        | Use **Odometer** tab: enter reading or use dashboard photo. |
| Record a part change   | Add expense → Category **Service** → choose **Part serviced** and optional odometer; backend creates service record and updates part/warranty. |

# Frontend Architecture & Design Strategy

## Role & Objective Response
As the Principal Frontend Architect and Senior Product Designer, I have analyzed the Gupio Customer App's backend implementation (BRD). Below is the comprehensive strategy to engineer the mobile application, ensuring a seamless, high-performance, and visually stunning user experience that maps perfectly to the PostgreSQL/Prisma database schema and RESTful APIs.

---

## Part 1: The Frontend Technical Architecture

### Tech Stack Recommendation: React Native
**Recommendation:** React Native (with Expo SDK or Bare CLI depending on custom native module needs).
**Justification:**
* **Telematics & Background Location:** Complex background execution is required for Damoov integration and offline trip logging. React Native has a mature ecosystem for background geolocation and tasks (`react-native-background-shapes`, `react-native-location`).
* **OCR & Camera:** Excellent libraries exist for high-performance camera access (e.g., `react-native-vision-camera`) and edge-device machine learning (MLKit bindings) essential for real-time receipt scanning and RC parsing.
* **Maps:** `react-native-maps` provides deep integration with Google Maps natively on both iOS and Android, which is critical for the Valet routing and SOS geolocation features.
* **Over-The-Air (OTA) Updates:** Allows for rapid bug fixes without going through app store reviews.

### State Management Strategy
* **Global State (Zustand or Redux Toolkit):** Used for highly shared, critical data.
  - **User Profile & JWT:** From `/v1/auth`, storing access/refresh tokens securely.
  - **Primary Vehicle Context:** Since operations (health, expenses, telematics) often revolve around a "selected" vehicle.
  - **Live SOS State:** Needs to persist across all screens during an emergency.
* **Server State (TanStack Query / React Query):**
  - Caching and synchronizing data mapped directly to domains (`/v1/vehicles`, `/v1/expenses`). Handles loading states, optimistic UI updates (e.g., liking a service record), and background refetching.
* **Local State (React Context / `useState`):**
  - Form validation (Adding Expenses, Uploading Documents).
  - UI toggles (BottomSheet visibility, Map layers).

### Data Layer Abstraction
Create a strictly typed service layer using Axios/Fetch:
* `AuthService`: Handles `/v1/auth/login`, OTP flows, and token interceptors.
* `VehicleService`: Maps to `/v1/vehicles` (CRUD, Health, Challans).
* `ExpenseService`: Maps to `/v1/expenses` (Budgets, categorization).
* `TelematicsService`: Interfaces with generic `/v1/telematics` and Damoov SDK directly.
* `AIService`: Manages WebSocket or streaming HTTP connections for `/v1/ai`.

### Offline & Sync Logic
* **Database:** Use `WatermelonDB` or SQLite for a reactive, offline-first local database.
* **Strategy:** 
  1. **Telematics & Trips:** When the Damoov SDK logs a trip (distance, events, harsh braking) while offline, it is written to the local SQLite DB.
  2. **Expense Logging:** OCR or manual expenses made offline are saved locally with a `sync_status = PENDING`.
  3. **Sync Engine:** A background network listener (`@react-native-community/netinfo` + Background Fetch) triggers when connectivity is restored, pushing data via a queue to the backend and updating `sync_status = COMPLETED`.

---

## Part 2: Information Architecture (IA) & App Overview

### Sitemap/Navigation Flow
**Primary Navigation:** Persistent Bottom Tabs
1. **Home/Dashboard:** Health, Quick Actions, Upcoming Alerts.
2. **Digital Garage:** 360-view of Vehicles, Docs, and Maintenance.
3. **Wallet & Expenses:** Analytics, Budgets, OCR Log, Fuel tracking.
4. **Copilot (AI Assistant):** Chat interface for contextual help.

**Secondary/Action Navigation:** Modals & Drawers
* **Floating Action Button (FAB):** Multi-action FAB for [Add Expense, Upload Doc, Log Trip].
* **Top Header Actions:** persistent SOS Button (always accessible).
* **Side Drawer:** User Profile, Shared Vehicles Management, App Settings.

### User Journeys

#### 1. Onboarding & Vehicle Digital Garage Setup
1. **Launch:** Splash screen -> Enter Phone Number -> Receive & Auto-read OTP.
2. **Profile Setup:** Name, Email, capture avatar via Camera/Gallery.
3. **Add Vehicle:** Input Registration Number -> API fetching details.
4. **Verification:** System checks Vahan/RC database -> Marks `rcVerified` as true.
5. **Initial Health Calculation:** App fetches `/v1/vehicles/{id}/health-score` and displays the "100/100" or initial gauge animation.

#### 2. Logging an Expense via OCR/Receipt Parsing
1. **Trigger:** User taps '+' FAB -> selects "Scan Receipt".
2. **Camera View:** Device camera opens with an overlay alignment box.
3. **Capture & Process:** Image is taken, UI shows a shimmer loading effect while OCR edge capabilities or the backend `/v1/documents` processes it.
4. **Review Screen:** The Expense Form appears, pre-filled with `amount`, `merchantName`, and `date`.
5. **Categorization:** App suggests Category based on Merchant -> User taps "Save".
6. **Budget Check:** Returns a Toast notification: *"Fuel Expense saved. Warning: Budget at 85%."*

#### 3. Triggering an SOS & Emergency Workflow
1. **Trigger:** User long-presses the persistent red SOS button in the header.
2. **Immediate Action:** App vibrates, captures high-accuracy GPS coordinates (Lat/Lng/Address).
3. **Incident Type:** A full-screen overlay asks to classify: [Medical, Police, Mechanical, Accident].
4. **Dispatch:** Calls `/v1/sos`. Backend alerts Emergency Contacts (SMS/WA) and nearby Valets.
5. **Resolution Screen:** A map appears showing the user's location, the status of the SOS (`ACTIVE`), and an incoming ETA of any dispatched help.

---

## Part 3: The Figma Design System Specification

### Component Library
Designed with Atomic Design principles, using a clean, modern aesthetic (Glassmorphism + Dark Mode).

* **Global:** 
  - `SOSHeroButton`: Pulsing red gradient button.
  - `BottomTabBar`: Glassmorphic floating bar.
* **Vehicle Module:**
  - `HealthGauge`: A dynamic SVG D3/Recharts radial arc indicating 0-100 score.
  - `MaintenanceCard`: Displays part name, next service km/date, and a status indicator (Green/Amber/Right).
* **Document & Wallet Module:**
  - `DocThumbnailItem`: Displays document type, verified badge, and Days-to-expiry pill.
* **Expense Module:**
  - `BudgetProgressBar`: Linear progress bar.
  - `ExpenseRow`: Icon (by category), Merchant Name, Date, Amount (Green for budget, Red for over-budget).
* **Driving Module:**
  - `TripMapCard`: Static map snapshot with the route polyline and trip stats (Safety Score circle).

### Visual Data Mapping
* **Telematics (Harsh Braking):** 
  - *Data mapped:* `latitude`, `longitude`, `eventType: HARSH_BRAKING`, `severity`.
  - *Visual:* On the `TripMapCard` detail, the route is a blue polyline. Wherever a harsh braking event occurred, render a yellow/amber triangle warning icon `⚠️` on the exact coordinate. Clicking it opens a bottom sheet showing the severity metric.
* **Budget Alerts:** 
  - *Data mapped:* `amount`, `notifyThreshold: 80`.
  - *Visual:* The `BudgetProgressBar` fills up. From 0-79%, the bar is bright green. At >= 80%, the bar transitions to amber. At >= 100%, it turns red, and an alert icon triggers a pulsed animation.
* **Conversational AI Interface:** 
  - *Visual UX:* Chat bubbles. User is right-aligned, AI is left-aligned. 
  - *RAG Context Mapping:* When the AI responds using vectorized context, it includes a `CitationsChip` underneath the chat bubble. E.g., *"Your insurance expires in 5 days. [📄 Bajaj_Allianz_Doc]"*. Tapping the chip opens the actual document in a built-in PDF viewer.

---

## Part 4: Screen-by-Screen Blueprints

### 1. The Dashboard (Home)
* **Header:** Greeting ("Hello Abhishek"), Profile Avatar, and the universally present SOS button.
* **Hero Section (Vehicle Health & Status):** 
  - Swipeable carousel if multiple vehicles exist. 
  - Dominant feature is the `HealthGauge` (e.g., "85/100").
  - Below gauge: "Primary Vehicle: MH12AB1234 - Honda City".
* **Alerts Strip:** Horizontal scrolling pills for urgent items: `🚨 Insurance expires tomorrow!`, `⚠️ Maintainence Due: Brake Pads`.
* **Quick Actions Grid:** 2x2 grid `[Log Expense] [Scan Document] [Record Trip] [Share Vehicle]`.
* **Fuel Price Ticker:** A marquee or bottom widget showing today's cached fuel price based on the user's location.

### 2. The Digital Garage Detail View
* **Header / Image Hero:** A 3D render or high-quality image of the vehicle make/model. License plate overlay.
* **Segmented Navigation:** [ Overview | Documents | Expenses | Telematics ]
* **Overview Tab Content:**
  - **Odometer Card:** Current reading, "Last updated X days ago".
  - **Health Breakdown:** Radar chart showing scores for [Age, Mileage, Maintenance, Driving].
  - **Challans Widget:** Simple list showing unpaid challan amounts and dates.
  - **Service Predictions:** "Next Service Due: Oct 12, 2026 or 45,000 km". Lists specific parts nearing replacement (e.g., Air Filter warranty tracking).

### 3. The Trip History Log
* **List View (Parent):**
  - Sectioned by Month.
  - Each item displays: Date, Start Time -> End Time, Distance (Km), Duration (Min), and a prominent `Safety Score` badge (Green if > 80, Yellow if < 80).
* **Trip Detail View (Child Screen):**
  - **Top Half (Map):** Interactive map showing start pin, end pin, and a colored polyline reflecting average speed sections (Green = normal, Red = speeding areas).
  - **Incident Markers:** Visual plotting of `DrivingEvent` data points (Harsh Acceleration, Phone Usage).
  - **Bottom Half (Metrics Grid):**
    - `Max Speed`: 110 km/h
    - `Avg Speed`: 45 km/h
    - `Fuel Consumed`: 2.5 L
    - `Safety Deductions`: Breakdown of why points were lost (e.g., "-5 pts for Harsh Braking").
# Business Requirements Document (BRD) - Gupio Customer App (Implemented Backend)

## 1. Introduction
This Business Requirements Document (BRD) outlines the features and functionalities currently implemented in the Gupio Customer App backend. This document serves as the source of truth for the active backend architecture, built focusing exclusively on the documented database schema and API routes.

## 2. Core Implemented Modules

### 2.1 Customer & Authentication Module
* **Customer Profile:** Account creation and profile management capturing phone number, email, full name, and profile picture.
* **Device Management:** Tracking and management of customer devices (iOS/Android) including device tokens for push notifications and tracking the last active timestamp.
* **Authentication Flow:** API structure supports OTP-based signup/login, token refresh, and profile management.

### 2.2 Vehicle Management Module
* **Vehicle Digital Garage:** CRUD operations for vehicles, capturing registration number, make, model, variant, year, fuel type, engine, and chassis numbers. Supports primary vehicle tagging and RC verification status.
* **Vehicle Health:** Automated health scoring (Overall, Age, Mileage, Maintenance, Driving) with system-generated recommendations and explanations.
* **Odometer Tracking:** Independent odometer logging and historical tracking over time.
* **Challan Management:** Tracking vehicle challans, violation types, amounts, issuing locations, and payment statuses.
* **Service & Maintenance:** Detailed service records including garage name, service dates, and next service predictions based on date or kilometers.
* **Parts Tracking:** Tracking individual replaced parts (e.g., Engine Oil, Brake Pads, Battery) with associated costs, brand, and warranty tracking (months/km or expiry date).

### 2.3 Document & Wallet Module
* **Digital Document Storage:** Support for RC, Insurance, PUC, FASTag, Driving License, and other documents.
* **Document Attributes:** Captures issue dates, expiry dates, issuer name, and verification status (Pending, Verified, Rejected).
* **OCR Integration:** Capability to store OCR-parsed data and structured extracted fields from uploaded files.
* **DigiLocker Integration:** OAuth-based connection to DigiLocker, storing access/refresh tokens, consent status, and data sync timestamps.

### 2.4 Expense & Budget Module
* **Expense Tracking:** Logging of vehicle expenses across distinct categories (Fuel, Toll, Parking, Service, Insurance, Challan, EMI, etc.).
* **Multi-Source Ingestion:** Expenses can be marked via specific sources: Manual, SMS, Push Notification, Voice, or Parsed from Receipts.
* **Budgets:** Category-wise customizable budgets (e.g., monthly) with active threshold limits (e.g., alert at 80% consumption).
* **Fuel Price Tracking:** Centralized caching of city/state fuel prices fetched from external APIs (e.g., IOCL) with historical tracking.

### 2.5 Driving & Telematics Module
* **Device Association:** Support for Damoov/telematics instances tied to specific vehicles.
* **Trip Logging:** Rich tracking of driving trips including start/end times, distance, duration, speed (max/avg), fuel consumed, and an aggregated safety score (0-100). Captures start and end location geometries.
* **Driving Events:** Detailed telemetry events during trips such as Harsh Braking, Harsh Acceleration, Phone Usage, and Speeding, along with timestamps, GPS coordinates, and severity metrics.

### 2.6 AI Assistant & Chat Module
* **Conversational AI:** Persistent AI chat sessions with message history context, tracking user, system, and assistant roles.
* **Embeddings & Context Engine:** Document Embedding models designed to vectorize user records (Expenses, Documents, Vehicles) to provide RAG (Retrieval-Augmented Generation) capabilities to the AI assistant.

### 2.7 Emergency & SOS Module
* **SOS Triggers:** Active SOS requests capturing real-time GPS coordinates and explicit emergency types (Medical, Police, Mechanical, Accident).
* **Emergency Contacts:** Priority-based emergency contacts list per customer (name, phone, relationship).
* **Resolution Workflow:** Tracking the operational status of SOS requests (Active, Resolved, Cancelled).

### 2.8 Collaboration & Sharing Module
* **Vehicle Access Sharing:** Granular role-based access control (Owner, Editor, Viewer) to share specific vehicles and their data across multiple customer accounts securely.

### 2.9 Communication & Notifications Module
* **In-App Notifications:** System-generated alerts (e.g., Document Expiry, System Alerts) with link metadata and read-receipt tracking.

## 3. Technical Foundation Notes
* **Database Base:** PostgreSQL via Prisma ORM (`customer` schema).
* **API Structure:** RESTful JSON APIs organized by domains (e.g., `/v1/vehicles`, `/v1/expenses`, `/v1/telematics`).
* **Vector Readiness:** The schema architecture includes preparation for vector embeddings (e.g., `pgvector`) to support advanced semantic search and AI capabilities in the future.

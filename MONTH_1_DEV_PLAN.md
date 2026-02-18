# 📅 GUPIO Customer App DEV PLAN: MONTH 1 (Feb 9 - Mar 8)

> **Goal:** Parallel execution by Frontend Team (Sachin, Zeenath, Shreedhar) + Full Backend Ownership (Abhishek).

---

## 📌 **WEEK 1: INFRASTRUCTURE & AUTHENTICATION (Feb 9 - Feb 15)**

**Focus:** Project Setup, Database Schema, Design System, Authentication.

### 🟢 **BACKEND (Owner: Abhishek)**

- **Day 1-2 (Feb 9-10): Project & Database Setup**
  - [ ] Initialize Node.js/Express TypeScript monorepo integration.
  - [ ] **Database:** Design & implement Prisma Schema (30+ models).
  - [ ] **Migrations:** Run initial migrations and seed reference data.
- **Day 3-4 (Feb 11-12): Authentication & Security**
  - [ ] Implement **Customer Auth** (OTP-based login, JWT access/refresh tokens).
  - [ ] Setup Security Middleware: `helmet`, `cors`, Rate Limiting.
- **Day 5 (Feb 13): API Architecture**
  - [ ] Setup **Controller-Service-Repository** pattern.
  - [ ] Initialize **Swagger/OpenAPI** documentation.
- **Day 6-7 (Feb 14-15): Core Infrastructure**
  - [ ] **Redis:** Setup caching layer.
  - [ ] **Storage:** Setup AWS S3/Cloudinary wrapper.

### 🔵 **FRONTEND (Owner: Zeenath - Common & Auth)**

- **Day 1-4 (Feb 9-12): Setup & Config**
  - [ ] Initialize React Native (Expo/CLI) project with TypeScript.
  - [ ] **Theme Engine:** Implement Color Palette, Typography, Spacing.
  - [ ] **Base Components:** Button, Input, Card.
- **Day 5-7 (Feb 13-15): Auth & Navigation**
  - [ ] **Navigation:** Setup Root Stack, Auth Stack, and Bottom Tab Navigator.
  - [ ] **Screens:** Welcome (1.1), Login (1.2), OTP (1.3), Success (1.4).

---

## 📌 **WEEK 2: CORE SCREENS (Feb 16 - Feb 22)**

**Goal:** Each member builds the core list and add/upload flows for their module.

### 🟢 **BACKEND (Owner: Abhishek)**

- **Day 1-2 (Feb 16-17): Vehicle Service & Health**
  - [ ] **Vehicle CRUD:** Register, Update, Soft Delete with duplicate checks (Reg No).
  - [ ] **RC Verification:** Integrate `verif-rc` wrapper (Parivahan) for vehicle details fetching.
  - [ ] **Health Score Engine:** Implement weighted algorithm (Age, Mileage, Service History) & scheduled calculation jobs.
- **Day 3-5 (Feb 18-20): Documents & OCR Pipeline**
  - [ ] **Upload Pipeline:** Setup Multer/S3/Cloudinary with file type validation (PDF/JPG) & size limits.
  - [ ] **OCR Integration:** Implement Tesseract/Vision API for text extraction (Reg No, Chassis, Expiry).
  - [ ] **Metadata Storage:** Schema for document validity, issuing authority, and verification status.
- **Day 6-7 (Feb 21-22): Expense Tracking**
  - [ ] **Expense CRUD:** Logging with Category mapping (Fuel, Service, Insurance).
  - [ ] **SMS Parser:** Regex-based parser for bank SMS (Amount, Merchant extraction).
  - [ ] **Budgets:** logic for setting monthly limits vs actual spending alerts.

### 🔵 **FRONTEND TEAM (Parallel Execution)**

| Owner         | Module           | Focus Screens     | Tasks                                                                                                                                               |
| :------------ | :--------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sachin**    | **🚗 Vehicles**  | **List & Add**    | • **Screen 3.1 Vehicle List:** Card view with health badges.<br>• **Screen 3.2 Add Vehicle:** Multi-step wizard (Reg -> Verify -> Confirm).         |
| **Zeenath**   | **📄 Documents** | **List & Upload** | • **Screen 4.1 Document List:** Tabbed view (RC/Ins/PUC) with Expiry Badges.<br>• **Screen 4.2 Upload:** Camera/Gallery picker + Doc Type dropdown. |
| **Shreedhar** | **💰 Expenses**  | **List & Add**    | • **Screen 5.1 Expense List:** Monthly view with Category Chips.<br>• **Screen 5.2 Add Expense:** Form with Manual & Voice input tabs.              |

---

## 📌 **WEEK 3: DETAILS & INTELLIGENCE (Feb 23 - Mar 1)**

**Goal:** Detailed views, visualized data, and integrations.

### 🟢 **BACKEND (Owner: Abhishek)**

- **Day 1-3 (Feb 23-25): AI Assistant (Context & RAG)**
  - [ ] **Vector DB Setup:** Configure Pinecone/pgvector for knowledge base (Vehicle Manuals, Policies).
  - [ ] **Context Loader:** Middleware to inject User Profile + Vehicle Health into AI prompts.
  - [ ] **Chat API:** Streaming response endpoint with history management.
- **Day 4-5 (Feb 26-27): Analytics Engine**
  - [ ] **Aggregation Jobs:** Scheduled jobs for Spending Trends (Weekly/Monthly) & Category breakdown.
  - [ ] **Driving Stats:** Calculate Average Daily Running (ADR) from odometer logs.
- **Day 6-7 (Feb 28 - Mar 1): Valet & Location**
  - [ ] **WebSocket Server:** Setup Socket.IO namespaces for Real-time location updates.
  - [ ] **Geo-Fencing:** Basic implementation for Valet pickup/drop zones.

### 🔵 **FRONTEND TEAM (Parallel Execution)**

| Owner         | Module           | Focus Screens          | Tasks                                                                                                                                         |
| :------------ | :--------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sachin**    | **🚗 Vehicles**  | **Details & Health**   | • **Screen 3.3 Details:** Dashboard with Info & Actions.<br>• **Health Component:** Circular progress with factor breakdown (Age, Mileage).   |
| **Zeenath**   | **📄 Documents** | **Viewer & OCR**       | • **Screen 4.3 Doc Detail:** Full-screen PDF/Image viewer with Zoom.<br>• **OCR Preview:** UI to show extracted fields for user verification. |
| **Shreedhar** | **💰 Expenses**  | **Analytics & Budget** | • **Screen 5.3 Analytics:** Charts (Pie/Line) for spending trends.<br>• **Screen 5.4 Budget:** Progress bars for set budgets vs actuals.      |

---

## 📌 **WEEK 4: ADVANCED FEATURES (Mar 2 - Mar 8)**

**Goal:** Complex flows, third-party integrations, and polishing.

### 🟢 **BACKEND (Owner: Abhishek)**

- **Day 1-2 (Mar 2-3): External Integrations**
  - [ ] **DigiLocker:** OAuth 2.0 flow implementation, Token storage, and Document Sync logic.
  - [ ] **Challan API:** Integration for fetching pending challans via Reg No.
- **Day 3-4 (Mar 4-5): Advanced Features & Jobs**
  - [ ] **Background Workers:** BullMQ setup for Maintenance Reminders & Expiry Alerts (Push/SMS).
  - [ ] **Fuel Prices:** Scraper/API to fetch daily fuel prices by City.
- **Day 5-7 (Mar 6-8): Optimization & Polish**
  - [ ] **Performance:** Redis caching for Static Data (Makes, Models, Cities) & Config.
  - [ ] **Security Audit:** Rate limiting review, Helmet headers, Input sanitization checks.
  - [ ] **API Docs:** Finalize Swagger/OpenAPI specifications for handover.

### 🔵 **FRONTEND TEAM (Parallel Execution)**

| Owner         | Module           | Focus Screens         | Tasks                                                                                                                                                                       |
| :------------ | :--------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sachin**    | **🚗 Vehicles**  | **Maint. & Challans** | • **Service History:** Timeline of past services.<br>• **Screen 3.4 Challans:** List view with "Mark Paid" action.<br>• **Home Integration:** Add Vehicle Carousel to Home. |
| **Zeenath**   | **📄 Documents** | **DigiLocker**        | • **DigiLocker Flow:** WebView for OAuth & Sync UI.<br>• **Home Integration:** Add Expiring Docs Alert to Home.                                                             |
| **Shreedhar** | **💰 Expenses**  | **Fuel & Warranty**   | • **Screen 5.5 Fuel Prices:** List view by City.<br>• **Screen 5.6 Warranty:** Track parts status.<br>• **Home Integration:** Add Expense Summary to Home.                  |

---

## ✅ **END OF MONTH 1 DELIVERABLES (Mar 8)**

- **Abhishek:** Complete Backend (Auth, Vehicles, Docs, Expenses, Analytics APIs).
- **Zeenath:** Setup, Auth, Navigation, Documents Module, DigiLocker.
- **Sachin:** Vehicles Module, Health Scores, Challans.
- **Shreedhar:** Expenses Module, Analytics Dashboard, Budgets.

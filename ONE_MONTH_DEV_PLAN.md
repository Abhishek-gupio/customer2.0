# 🚀 GUPIO CUSTOMER APP — ULTIMATE 1-MONTH DEV PLAN
## **Feb 17, 2026 – Mar 15, 2026**

> **Objective:** Go from **Backend Ready** to **App Store Launch**.
> **Current Status:** Backend ~90% (Advanced AI/OCR implemented), Frontend ~0% (Structure only).
> **Strategy:** Backend is DONE. Focus 100% on Frontend Build & Integration.

---

## 📋 Week-by-Week Roadmap

| Week | Dates | Focus Area | Key Deliverables |
|------|-------|------------|------------------|
| **1** | Feb 17 – Feb 23 | **Frontend Core** | Auth, Home, Vehicles UI (Backend Ready ✅) |
| **2** | Feb 24 – Mar 1 | **Documents & Expenses** | Doc Upload, Expense Charts, DigiLocker UI (Backend Ready ✅) |
| **3** | Mar 2 – Mar 8 | **Smart Features** | AI Chat, Valet Tracking, RTO Services UI (Backend Ready ✅) |
| **4** | Mar 9 – Mar 15 | **Polish & Launch** | Security, Testing, Production Build, **SUBMIT** |

---

## 📅 WEEK 1: Foundation & Vehicles (Feb 17 – Feb 23)

### 🟢 Backend (Status: DONE ✅)
| Task | Status | Note |
|------|--------|------|
| **DB Schema** | ✅ | Complete (503 lines, 40+ models) |
| **Auth API** | ✅ | Login/OTP/JWT/Refresh implemented |
| **Vehicle API** | ✅ | CRUD, Health Score, AI Odometer logic ready |
| **Storage** | ✅ | S3 & Local drivers implemented |
| **Integration** | ❌ | Parivahan/RTO API needed (Check `challan.service.ts`) |

### 🔵 Frontend (Focus: BUILD 🚧)
| Day | Task | Status |
|-----|------|--------|
| Mon | **Design System:** Implement fonts, colors, spacing in `src/theme` | ❌ |
| Mon | **API Client:** Setup Axios interceptors & React Query | ❌ |
| Tue | **Auth Screens:** Login, OTP Input, Success Screen | ❌ |
| Wed | **Home Helper:** Active Valet card, Quick Actions grid | ❌ |
| Thu | **Vehicle List:** Car cards with health score badge | ❌ |
| Fri | **Add Vehicle:** Form with RC upload (connect to OCR API) | ❌ |
| Sat | **Detail Screen:** Vehicle stats (Service, Insurance status) | ❌ |

---

## 📅 WEEK 2: Documents & Expenses (Feb 24 – Mar 1)

### 🟢 Backend (Status: DONE ✅)
| Task | Status | Note |
|------|--------|------|
| **OCR Service** | ✅ | Gemini AI implemented for Docs & Receipts |
| **Expense API** | ✅ | `expense-intelligence` service is huge (21KB) |
| **Prediction** | ✅ | Service date & mileage prediction logic ready |
| **Notifications** | ✅ | Logic exists in `notification.service.ts` |

### 🔵 Frontend (Focus: BUILD 🚧)
| Day | Task | Status |
|-----|------|--------|
| Mon | **Doc Locker:** Grid view of RC, Insurance, PUC | ❌ |
| Tue | **Doc Viewer:** PDF/Image zoomable viewer | ❌ |
| Wed | **Expense Dashboard:** Spending graphs (Pie/Bar charts) | ❌ |
| Thu | **Add Expense:** Camera capture -> Send to Backend OCR | ❌ |
| Fri | **Connect DigiLocker:** WebView flow / API integration | ❌ |
| Sat | **Maintenance:** Timeline view of service history | ❌ |

---

## 📅 WEEK 3: AI, Valet & RTO (Mar 2 – Mar 8)

### 🟢 Backend (Status: DONE ✅)
| Task | Status | Note |
|------|--------|------|
| **AI Assistant** | ✅ | `ai.service.ts` & `voice.service.ts` ready |
| **Valet Logic** | ✅ | `telematics.service.ts` exists |
| **Trip Tracking** | ✅ | Logic for mileage/safety score ready |

### 🔵 Frontend (Focus: BUILD 🚧)
| Day | Task | Status |
|-----|------|--------|
| Mon | **Gupio AI Chat:** Chat interface with Voice rec button | ❌ |
| Tue | **Valet Map:** Live Google Maps tracking view | ❌ |
| Wed | **RTO Services:** Form generator for DL Renewal/Transfer | ❌ |
| Thu | **SOS:** Emergency panic button implementation | ❌ |
| Fri | **Voice Commands:** "Add expense 500 petrol" (Audio record) | ❌ |
| Sat | **Settings:** Profile, Notifications, Dark Mode toggle | ❌ |

---

## 📅 WEEK 4: Launch Week (Mar 9 – Mar 15)

### 🟢 Backend (Focus: DEPLOY)
| Task | Status | Note |
|------|--------|------|
| **Production DB** | ❌ | Setup Postgres on Cloud |
| **Deploy API** | ❌ | Dockerize & Deploy to AWS/DO |
| **Swagger** | ✅ | Already initialized |

### 🔵 Frontend (Focus: SHIP)
| Day | Task | Status |
|-----|------|--------|
| Mon | **Performance:** FlashList, Image caching, Memoization | ❌ |
| Tue | **Offline Mode:** Redux Persist / MMKV caching | ❌ |
| Wed | **Testing:** End-to-end user flows (Auth -> Vehicle -> Doc) | ❌ |
| Thu | **Icons & Splash:** Generate assets for iOS/Android | ❌ |
| Fri | **Build:** Release builds (AAB / IPA) | ❌ |
| Sat | **Submit:** App Store Connect & Play Console | ❌ |

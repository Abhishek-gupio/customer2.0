# 🚗 Gupio Customer App — Frontend Screen Design Document

---

## 📱 APP NAVIGATION MAP

```
┌──────────────────────────────────────────────────────────────┐
│                        APP LAUNCH                            │
│                           │                                  │
│                     ┌─────▼─────┐                            │
│                     │  Splash   │                            │
│                     └─────┬─────┘                            │
│                           │                                  │
│              ┌────────────▼────────────┐                     │
│              │  Auth Check (Token?)    │                     │
│              └──┬──────────────────┬───┘                     │
│            No   │                  │  Yes                    │
│         ┌───────▼──────┐   ┌──────▼──────┐                   │
│         │  AUTH FLOW   │   │  MAIN APP   │                   │
│         └──────────────┘   └─────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 1. AUTH FLOW (4 Screens)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│ Welcome  │───▶│  Login   │───▶│  OTP     │───▶│  Success     │
│ Screen   │    │  Screen  │    │  Screen  │    │  Screen      │
└──────────┘    └──────────┘    └──────────┘    └──────────────┘
```

### 1.1 Welcome Screen
```
┌─────────────────────────┐
│                         │
│      🚗 GUPIO LOGO      │
│                         │
│   "Your Car's Best      │
│       Companion"        │
│                         │
│   ┌─────────────────┐   │
│   │  Get Started ➜  │   │  ← Button → navigates to Login
│   └─────────────────┘   │
│                         │
│   Already a member?     │
│   [Login] ← Text Link   │
└─────────────────────────┘

API: None (Static screen)
```

### 1.2 Login Screen
```
┌─────────────────────────┐
│  ← Back                 │
│                         │
│   Enter your phone      │
│   number                │
│                         │
│   🇮🇳 +91               │
│   ┌─────────────────┐   │
│   │  98XXXXXXXX     │   │  ← Phone Input
│   └─────────────────┘   │
│                         │
│   ┌─────────────────┐   │
│   │   Send OTP  ➜   │   │  ← Button
│   └─────────────────┘   │
│                         │
│   By continuing you     │
│   agree to T&C          │
└─────────────────────────┘

API: POST /v1/auth/send-otp
     Body: { phoneNumber }
```

### 1.3 OTP Screen
```
┌─────────────────────────┐
│  ← Back                 │
│                         │
│   Verify OTP            │
│   Sent to +91 98XXX     │
│                         │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│   │  │ │  │ │  │ │  │  │  ← 4/6 digit OTP boxes
│   └──┘ └──┘ └──┘ └──┘  │
│                         │
│   ┌─────────────────┐   │
│   │   Verify  ➜     │   │  ← Button
│   └─────────────────┘   │
│                         │
│   Resend OTP (30s) ←Link│
└─────────────────────────┘

API: POST /v1/auth/verify-otp
     Body: { phoneNumber, otp }
     Returns: { token, refreshToken, customer }
```

### 1.4 Success Screen
```
┌─────────────────────────┐
│                         │
│         ✅               │
│   Login Successful!     │
│                         │
│   Welcome, Abhishek     │
│                         │
│   (Auto-redirect 2s)    │
│                         │
└─────────────────────────┘

API: Stores token → AsyncStorage
     Auto-navigates to Home
```

---

## 🏠 2. MAIN APP — Bottom Tab Navigation

```
┌─────────────────────────────────────────────┐
│                                             │
│              SCREEN CONTENT                 │
│                                             │
├──────────┬──────────┬──────────┬────────────┤
│  🏠 Home │  🤖 AI   │  🔔 Notif│  ☰ More   │
└──────────┴──────────┴──────────┴────────────┘
     Tab 1     Tab 2     Tab 3      Tab 4
```

---

## 🏠 2.1 HOME SCREEN (Tab 1)

```
┌─────────────────────────┐
│ Hi Abhishek 👋    🔔 👤  │  ← Header: greeting + notification bell + avatar
│─────────────────────────│
│ 🔍 Search anything...   │  ← Global Search Bar
│─────────────────────────│
│                         │
│ ── Quick Actions ────── │
│ ┌────┐┌────┐┌────┐┌────┐│
│ │ 🚗 ││ 📄 ││ 💰 ││ 🤖 ││  Row 1
│ │Vehi││Docs││Exp ││ AI ││
│ └────┘└────┘└────┘└────┘│
│ ┌────┐┌────┐┌────┐┌────┐│
│ │ 🔧 ││ 🔗 ││ ⛽ ││ 📋 ││  Row 2
│ │Maint││Share││Fuel││Chln││
│ └────┘└────┘└────┘└────┘│
│─────────────────────────│
│ ── My Vehicles ──[See All]│
│ ┌─────────┐┌─────────┐  │
│ │ MH12XX  ││ MH14YY  │  │  ← Horizontal scroll cards
│ │ Swift   ││ i20     │  │
│ │ ❤️ 85/100││ 🟡 62/100│ │  ← Health score badge
│ └─────────┘└─────────┘  │
│─────────────────────────│
│ ── Expiring Soon ─────  │
│ ┌───────────────────┐   │
│ │ ⚠️ PUC expires in  │   │
│ │   15 days (Swift)  │   │  ← Alert card
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ ⚠️ Insurance exp   │   │
│ │   in 30 days (i20) │   │
│ └───────────────────┘   │
│─────────────────────────│
│ ── This Month ────────  │
│ ┌───────────────────┐   │
│ │  Total: ₹12,450   │   │
│ │  ⛽ Fuel   ₹6,200  │   │
│ │  🅿️ Parking ₹1,800 │   │
│ │  🔧 Service ₹4,450 │   │
│ └───────────────────┘   │
│─────────────────────────│
│ ── Pending Challans ──  │
│ ┌───────────────────┐   │
│ │ 🚨 2 unpaid: ₹4,500│   │
│ │    [View Details]  │   │
│ └───────────────────┘   │
└─────────────────────────┘

APIs Used:
  GET /v1/customer/profile        → Header greeting + avatar
  GET /v1/vehicles                → Vehicle carousel
  GET /v1/documents/expiring      → Expiring docs section
  GET /v1/expenses/summary        → Monthly expense summary
  GET /v1/vehicles/:id/challans   → Pending challans
  GET /v1/notifications           → Notification badge count
```

---

## 🚗 3. VEHICLE MODULE (5 Screens)

```
Home ──▶ Vehicle List ──▶ Vehicle Detail ──▶ Health Score
              │                  │
              ▼                  ├──▶ Challans
         Add Vehicle             ├──▶ Service History
                                 ├──▶ Odometer Log
                                 └──▶ Sharing
```

### 3.1 Vehicle List Screen
```
┌─────────────────────────┐
│ ← My Vehicles           │
│─────────────────────────│
│ 🔍 Search vehicles...   │
│─────────────────────────│
│ ┌───────────────────┐   │
│ │ 🚗 Maruti Swift    │   │
│ │ MH12AB1234         │   │
│ │ ⭐ Primary  ❤️ 85   │   │  ← Tap → Vehicle Detail
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🚙 Hyundai i20     │   │
│ │ MH14CD5678         │   │
│ │            🟡 62   │   │
│ └───────────────────┘   │
│                         │
│              ┌────────┐ │
│              │ + Add  │ │  ← FAB → Add Vehicle Screen
│              └────────┘ │
└─────────────────────────┘

API: GET /v1/vehicles
```

### 3.2 Add Vehicle Screen
```
┌─────────────────────────┐
│ ← Add Vehicle           │
│─────────────────────────│
│                         │
│ Registration Number *   │
│ ┌─────────────────┐     │
│ │ MH12AB1234      │     │
│ └─────────────────┘     │
│                         │
│ Make        Model       │
│ ┌────────┐ ┌────────┐   │
│ │ Maruti │ │ Swift  │   │
│ └────────┘ └────────┘   │
│                         │
│ Year        Fuel Type   │
│ ┌────────┐ ┌────────┐   │
│ │ 2022   │ │ Petrol▼│   │  ← Dropdown
│ └────────┘ └────────┘   │
│                         │
│ Vehicle Type            │
│ ┌─────────────────┐     │
│ │  Car        ▼   │     │
│ └─────────────────┘     │
│                         │
│ ☐ Set as Primary Vehicle│  ← Checkbox
│                         │
│ ┌─────────────────┐     │
│ │  Add Vehicle  ➜ │     │  ← Submit Button
│ └─────────────────┘     │
└─────────────────────────┘

API: POST /v1/vehicles
     Body: { registrationNumber, make, model,
             year, fuelType, vehicleType, isPrimary }
```

### 3.3 Vehicle Detail Screen
```
┌─────────────────────────┐
│ ← Maruti Swift    ✏️ 🗑️  │  ← Edit / Delete icons
│─────────────────────────│
│     ┌─────────────┐     │
│     │   🚗 IMAGE   │     │
│     │  MH12AB1234  │     │
│     │  ⭐ Primary   │     │
│     └─────────────┘     │
│─────────────────────────│
│ Health Score             │
│ ┌───────────────────┐   │
│ │    ╭───╮          │   │
│ │    │ 85│ /100     │   │  ← Circular progress
│ │    ╰───╯          │   │
│ │ Age: 90  Maint: 80│   │
│ │ Mileage: 85       │   │
│ │ [Recalculate] ←Btn│   │
│ └───────────────────┘   │
│─────────────────────────│
│  Info                    │
│  Make: Maruti            │
│  Model: Swift            │
│  Year: 2022              │
│  Fuel: Petrol            │
│  Odometer: 23,450 km     │
│  [Update Odometer] ←Btn  │
│  [📷 Scan Odometer] ←Btn │
│─────────────────────────│
│ ── Actions ───────────  │
│ ┌────┐┌────┐┌────┐┌────┐│
│ │📄  ││🔧  ││📋  ││🔗  ││
│ │Docs││Srvc││Chln││Share│
│ └────┘└────┘└────┘└────┘│
└─────────────────────────┘

APIs:
  GET    /v1/vehicles/:id                    → Vehicle info
  POST   /v1/vehicles/:id/health/recalculate → Recalculate button
  POST   /v1/vehicles/:id/odometer           → Update odometer
  POST   /v1/vehicles/:id/odometer-ai        → Scan odometer photo
  PUT    /v1/vehicles/:id                    → Edit button
  DELETE /v1/vehicles/:id                    → Delete button
```

### 3.4 Challans Screen
```
┌─────────────────────────┐
│ ← Challans (MH12AB1234) │
│─────────────────────────│
│ ┌─────────────────┐     │
│ │ 🔄 Sync Challans │     │  ← Sync button
│ └─────────────────┘     │
│─────────────────────────│
│ ┌───────────────────┐   │
│ │ 🚨 Speed Violation │   │
│ │ ₹2,000  │ UNPAID   │   │
│ │ 12 Jan 2026        │   │
│ │ NH-48, Pune        │   │
│ │ [Mark as Paid] ←Btn│   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🚦 Signal Jump     │   │
│ │ ₹2,500  │ PAID     │   │
│ │ 05 Dec 2025        │   │
│ └───────────────────┘   │
└─────────────────────────┘

APIs:
  GET   /v1/vehicles/:vehicleId/challans      → List challans
  POST  /v1/vehicles/:vehicleId/challans/sync  → Sync button
  PATCH /v1/vehicles/challans/:id/pay          → Mark as Paid
```

### 3.5 Vehicle Sharing Screen
```
┌─────────────────────────┐
│ ← Share Vehicle          │
│─────────────────────────│
│ MH12AB1234 - Swift       │
│─────────────────────────│
│ ── People with Access ── │
│ ┌───────────────────┐   │
│ │ 👤 Rahul (Owner)   │   │
│ │ +91 98765XXXXX     │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 👤 Priya (Viewer)  │   │
│ │ +91 87654XXXXX     │   │
│ │            [Revoke]│   │  ← Revoke button
│ └───────────────────┘   │
│─────────────────────────│
│ ── Invite New ────────  │
│ Phone Number             │
│ ┌─────────────────┐     │
│ │ +91              │     │
│ └─────────────────┘     │
│ Role: ○ Viewer ○ Editor  │
│ ┌─────────────────┐     │
│ │   Share  ➜      │     │
│ └─────────────────┘     │
└─────────────────────────┘

APIs:
  GET    /v1/sharing/vehicle/:vehicleId/access                     → List access
  POST   /v1/sharing/share                                         → Share
         Body: { vehicleId, phoneNumber, role }
  DELETE /v1/sharing/vehicle/:vehicleId/access/:targetCustomerId   → Revoke
  GET    /v1/sharing/shared-with-me                                → Shared vehicles
```

---

## 📄 4. DOCUMENT MODULE (3 Screens)

```
Home ──▶ Document List ──▶ Document Detail
              │
              ├──▶ Upload Document
              └──▶ DigiLocker Connect
```

### 4.1 Document List Screen
```
┌─────────────────────────┐
│ ← My Documents          │
│─────────────────────────│
│ [RC][Insurance][PUC]    │
│ [FASTag][DL][Other]     │  ← Category filter chips
│─────────────────────────│
│ ┌───────────────────┐   │
│ │ 📋 Registration (RC)│  │
│ │ MH12AB1234         │   │
│ │ ✅ Verified         │   │
│ │ Exp: 15 Mar 2030   │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🛡️ Insurance       │   │
│ │ ICICI Lombard      │   │
│ │ ⚠️ Exp: 28 Feb 2026│   │  ← Warning if expiring soon
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 💨 PUC Certificate │   │
│ │ ❌ Expired!        │   │
│ └───────────────────┘   │
│─────────────────────────│
│ ┌──────────┐ ┌────────┐ │
│ │📤 Upload │ │🔗DigiL │ │  ← Two action buttons
│ └──────────┘ └────────┘ │
└─────────────────────────┘

APIs:
  GET /v1/documents                → List all docs
  GET /v1/documents/expiring       → Expiring badge/warning
```

### 4.2 Upload Document Screen
```
┌─────────────────────────┐
│ ← Upload Document       │
│─────────────────────────│
│ Document Type *          │
│ ┌─────────────────┐     │
│ │ RC          ▼   │     │  ← Dropdown: RC/INSURANCE/PUC/FASTAG/DL/OTHER
│ └─────────────────┘     │
│                         │
│ Link to Vehicle          │
│ ┌─────────────────┐     │
│ │ MH12AB1234  ▼   │     │  ← Vehicle dropdown (optional)
│ └─────────────────┘     │
│                         │
│ ┌─────────────────────┐ │
│ │                     │ │
│ │  📷 Tap to upload   │ │  ← File picker / Camera
│ │  or take a photo    │ │
│ │                     │ │
│ └─────────────────────┘ │
│                         │
│ (OCR will auto-extract  │
│  document details)      │
│                         │
│ ┌─────────────────┐     │
│ │  Upload  ➜      │     │
│ └─────────────────┘     │
└─────────────────────────┘

API: POST /v1/documents
     Multipart: { file, type, vehicleId }
     Returns: { document with ocrData, extractedFields }
```

### 4.3 Document Detail Screen
```
┌─────────────────────────┐
│ ← RC - MH12AB1234  🗑️   │
│─────────────────────────│
│ ┌─────────────────────┐ │
│ │                     │ │
│ │   📄 Document       │ │  ← Document preview / PDF viewer
│ │      Preview        │ │
│ │                     │ │
│ └─────────────────────┘ │
│─────────────────────────│
│ Status: ✅ Verified      │
│ Source: UPLOAD           │
│─────────────────────────│
│ ── Extracted Fields ──  │
│ Doc Number: XXXX         │
│ Issue Date: 01 Jan 2022  │
│ Expiry: 15 Mar 2030      │
│ Issuer: RTO Pune         │
│─────────────────────────│
│ ┌────────┐ ┌──────────┐ │
│ │Verify  │ │Download  │ │
│ └────────┘ └──────────┘ │
└─────────────────────────┘

APIs:
  GET    /v1/documents/:id        → Document details
  POST   /v1/documents/:id/verify → Verify button
  DELETE /v1/documents/:id        → Delete icon
```

---

## 💰 5. EXPENSE MODULE (5 Screens)

```
Home ──▶ Expense List ──▶ Expense Detail
              │
              ├──▶ Add Expense (Manual / Voice / Receipt / Text)
              ├──▶ Expense Summary & Analytics
              ├──▶ Budget Settings
              └──▶ Insights
```

### 5.1 Expense List Screen
```
┌─────────────────────────┐
│ ← Expenses         📊 ⚙️│  ← Analytics / Budget icons
│─────────────────────────│
│ Feb 2026  ◀ ▶  ₹12,450  │  ← Month navigator + total
│─────────────────────────│
│ [All][⛽Fuel][🅿️Park]    │
│ [🔧Srvc][🛣️Toll][📋Chln] │  ← Category filter chips
│─────────────────────────│
│ ── Today ─────────────  │
│ ┌───────────────────┐   │
│ │ ⛽ Fuel             │   │
│ │ HP Petrol, Pune    │   │
│ │ ₹2,200    MANUAL   │   │
│ └───────────────────┘   │
│ ── Yesterday ─────────  │
│ ┌───────────────────┐   │
│ │ 🅿️ Parking          │   │
│ │ Phoenix Mall       │   │
│ │ ₹200      SMS      │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🛣️ Toll             │   │
│ │ Mumbai-Pune Exp    │   │
│ │ ₹350    NOTIFICATION│  │
│ └───────────────────┘   │
│─────────────────────────│
│ ┌─────────────────────┐ │
│ │  + Add Expense      │ │  ← FAB opens Add Expense
│ └─────────────────────┘ │
└─────────────────────────┘

API: GET /v1/expenses?month=2&year=2026&category=FUEL
```

### 5.2 Add Expense Screen (4 Input Methods)
```
┌─────────────────────────┐
│ ← Add Expense           │
│─────────────────────────│
│ ── How to add? ──────── │
│ ┌────┐┌────┐┌────┐┌────┐│
│ │ ✏️ ││ 🎤 ││ 📷 ││ 📋 ││
│ │Man ││Voic││Rcpt││Text││  ← 4 tabs for input methods
│ └────┘└────┘└────┘└────┘│
│─────────────────────────│
│ ── MANUAL FORM ──────── │  (shown when ✏️ tab selected)
│ Amount *                 │
│ ┌─────────────────┐     │
│ │ ₹ 2,200         │     │
│ └─────────────────┘     │
│ Category *               │
│ ┌─────────────────┐     │
│ │ ⛽ Fuel      ▼   │     │
│ └─────────────────┘     │
│ Vehicle (optional)       │
│ ┌─────────────────┐     │
│ │ MH12AB1234  ▼   │     │
│ └─────────────────┘     │
│ Merchant                 │
│ ┌─────────────────┐     │
│ │ HP Petrol Pump  │     │
│ └─────────────────┘     │
│ Date         Notes       │
│ ┌────────┐ ┌────────┐   │
│ │ Today ▼│ │ ...    │   │
│ └────────┘ └────────┘   │
│ ┌─────────────────┐     │
│ │  Save Expense ➜ │     │
│ └─────────────────┘     │
└─────────────────────────┘

APIs per tab:
  ✏️ Manual:  POST /v1/expenses          (form body + optional receipt)
  🎤 Voice:  POST /v1/expenses/parse/voice  (audio file upload)
  📷 Receipt: POST /v1/expenses/parse/receipt (image file upload)
  📋 Text:   POST /v1/expenses/parse/text    (SMS/notification text)
```

### 5.3 Expense Summary & Analytics Screen
```
┌─────────────────────────┐
│ ← Analytics             │
│─────────────────────────│
│ Feb 2026  ₹12,450       │
│ ┌─────────────────────┐ │
│ │    PIE CHART         │ │
│ │  ⛽ 50% │ 🅿️ 14%     │ │  ← Category breakdown
│ │  🔧 36% │            │ │
│ └─────────────────────┘ │
│─────────────────────────│
│ ── Budget vs Actual ──  │
│ Fuel:   ████████░░ 80%  │  ← Progress bars
│ Park:   ████░░░░░░ 40%  │
│ Service:██████████ 100% │  ← Red if exceeded
│─────────────────────────│
│ ── Monthly Trend ─────  │
│ ┌─────────────────────┐ │
│ │   LINE CHART         │ │  ← Last 6 months trend
│ │ Nov Dec Jan Feb      │ │
│ └─────────────────────┘ │
│─────────────────────────│
│ ── Cost per KM ───────  │
│ │ Swift:  ₹5.2/km      │ │
│ │ i20:    ₹4.8/km      │ │
└─────────────────────────┘

APIs:
  GET /v1/expenses/summary                       → Summary data
  GET /v1/expenses/insights                      → AI insights
  GET /v1/expenses/vehicles/:vehicleId/cost-per-km → Cost efficiency
```

### 5.4 Budget Settings Screen
```
┌─────────────────────────┐
│ ← Budget Settings       │
│─────────────────────────│
│ ┌───────────────────┐   │
│ │ ⛽ Fuel             │   │
│ │ Budget: ₹8,000/mo  │   │
│ │ Alert at: 80%      │   │
│ │ [Edit] [Delete]    │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🅿️ Parking          │   │
│ │ Budget: ₹2,000/mo  │   │
│ │ Alert at: 80%      │   │
│ │ [Edit] [Delete]    │   │
│ └───────────────────┘   │
│                         │
│ ┌─────────────────┐     │
│ │ + Set Budget    │     │  ← Opens budget form
│ └─────────────────┘     │
└─────────────────────────┘

API: POST /v1/expenses/budgets
     Body: { category, amount, period, notifyThreshold }
```

---

## ⛽ 6. FUEL PRICE MODULE (1 Screen)

```
┌─────────────────────────┐
│ ← Fuel Prices           │
│─────────────────────────│
│ City: [Pune       ▼]    │
│─────────────────────────│
│ ┌─────────┐ ┌─────────┐ │
│ │ ⛽ Petrol│ │ 🛢️ Diesel│ │
│ │ ₹104.21 │ │  ₹92.15 │ │
│ └─────────┘ └─────────┘ │
│─────────────────────────│
│ ── Compare Nearby ────  │
│ Mumbai:    ₹106.31       │
│ Nashik:    ₹103.89       │
│ Satara:    ₹104.05       │
│─────────────────────────│
│ ── Calculator ────────  │
│ Amount: ₹ [2000]        │
│ ┌─────────────────┐     │
│ │  = 19.19 Liters │     │
│ └─────────────────┘     │
└─────────────────────────┘

APIs:
  GET  /v1/expenses/fuel-prices?city=Pune       → Current price
  GET  /v1/expenses/fuel-prices/compare          → Nearby comparison
  POST /v1/expenses/fuel-prices/calculate-liters → Calculator
```

---

## 🔧 7. WARRANTY & SERVICE MODULE (2 Screens)

### 7.1 Service History Screen
```
┌─────────────────────────┐
│ ← Service History       │
│   MH12AB1234             │
│─────────────────────────│
│ ┌───────────────────┐   │
│ │ 🔧 Full Service    │   │
│ │ ABC Garage, Pune   │   │
│ │ 12 Jan 2026        │   │
│ │ @ 22,000 km        │   │
│ │ Parts: Oil, Filter │   │
│ │ Next: 12 Jul 2026  │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🔧 Tyre Change     │   │
│ │ MRF Station        │   │
│ │ 05 Nov 2025        │   │
│ └───────────────────┘   │
│                         │
│ ┌─────────────────┐     │
│ │ + Log Service   │     │  ← Add service record
│ └─────────────────┘     │
└─────────────────────────┘

APIs:
  GET  /v1/expenses/warranty/vehicles/:vehicleId/history   → History
  POST /v1/expenses/warranty/service-records                → Log service
  GET  /v1/expenses/warranty/providers                      → Garage list
```

### 7.2 Warranty Status Screen
```
┌─────────────────────────┐
│ ← Parts & Warranty      │
│─────────────────────────│
│ ── Under Warranty ────  │
│ ┌───────────────────┐   │
│ │ 🔋 Battery         │   │
│ │ Amaron | ₹5,500    │   │
│ │ Warranty: 24 months│   │
│ │ Expires: Aug 2027  │   │  ← Green
│ └───────────────────┘   │
│ ── Due Soon ──────────  │
│ ┌───────────────────┐   │
│ │ 🛢️ Engine Oil       │   │
│ │ Next: 5,000 km away│   │  ← Yellow
│ │ Est: Mar 2026      │   │
│ └───────────────────┘   │
│ ── Overdue ───────────  │
│ ┌───────────────────┐   │
│ │ 🌬️ Air Filter       │   │
│ │ ⚠️ 2,000 km overdue │   │  ← Red
│ └───────────────────┘   │
└─────────────────────────┘

APIs:
  GET /v1/expenses/warranty/vehicles/:vehicleId/status   → Warranty status
  GET /v1/expenses/warranty/vehicles/:vehicleId/upcoming → Upcoming replacements
  GET /v1/expenses/warranty/part-info                    → Part lifecycle reference
```

---

## 🤖 8. AI CHAT MODULE (Tab 2)

```
┌─────────────────────────┐
│ 🤖 Gupio AI        [New]│  ← New chat button
│─────────────────────────│
│                         │
│   ┌─────────────────┐   │
│   │ Hi! I'm your AI │   │  ← AI bubble (left)
│   │ car assistant.   │   │
│   │ Ask me anything! │   │
│   └─────────────────┘   │
│                         │
│        ┌────────────┐   │
│        │When is my  │   │  ← User bubble (right)
│        │PUC expiring│   │
│        └────────────┘   │
│                         │
│   ┌─────────────────┐   │
│   │Your PUC for     │   │
│   │Swift (MH12AB)   │   │
│   │expires on       │   │
│   │28 Feb 2026.     │   │
│   │Shall I find a   │   │
│   │PUC center?      │   │
│   └─────────────────┘   │
│                         │
│ ┌──────────────┐ ┌────┐ │
│ │ Type message │ │ 🎤 │ │  ← Text input + Voice button
│ └──────────────┘ └────┘ │
│─────────────────────────│
│ ── Chat History ──────  │
│  [📋 View Past Sessions] │  ← Opens session list
└─────────────────────────┘

APIs:
  POST /v1/chat                        → Send message / get response
       Body: { message, sessionId? }
  GET  /v1/chat/sessions               → List past sessions
  GET  /v1/chat/sessions/:sessionId    → Load session messages
```

---

## 🔔 9. NOTIFICATIONS (Tab 3)

```
┌─────────────────────────┐
│ 🔔 Notifications        │
│─────────────────────────│
│ ── Today ─────────────  │
│ ┌───────────────────┐   │
│ │ ⚠️ PUC Expiring     │   │
│ │ Your PUC for Swift │   │  ← Unread (bold)
│ │ expires in 15 days │   │
│ │ 2:30 PM     [•]   │   │  ← Unread dot
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 💰 Expense Logged  │   │
│ │ ₹2,200 Fuel auto   │   │  ← Read (normal)
│ │ detected from SMS  │   │
│ │ 11:15 AM           │   │
│ └───────────────────┘   │
│ ── Earlier ───────────  │
│ ┌───────────────────┐   │
│ │ 🔧 Service Due     │   │
│ │ Oil change due for │   │
│ │ i20 in 500 km      │   │
│ └───────────────────┘   │
└─────────────────────────┘

APIs:
  GET   /v1/notifications             → List all
  PATCH /v1/notifications/:id/read    → Mark as read (on tap)
```

---

## ☰ 10. MORE / PROFILE (Tab 4)

```
┌─────────────────────────┐
│ ☰ More                  │
│─────────────────────────│
│ ┌───────────────────┐   │
│ │ 👤 Abhishek Kumar  │   │
│ │ +91 98765XXXXX     │   │
│ │ [View Profile] ➜   │   │
│ └───────────────────┘   │
│─────────────────────────│
│ 🚗  My Vehicles     ➜   │  → Vehicle List
│ 📄  My Documents     ➜   │  → Document List
│ 💰  Expenses         ➜   │  → Expense List
│ ⛽  Fuel Prices      ➜   │  → Fuel Price Screen
│ 🔧  Service History  ➜   │  → Service History
│ 🔗  Shared Vehicles  ➜   │  → Shared With Me
│─────────────────────────│
│ ⚙️  Settings         ➜   │
│ ❓  Help & Support   ➜   │
│ 📜  Terms & Privacy  ➜   │
│─────────────────────────│
│ ┌─────────────────┐     │
│ │  🚪 Logout       │     │
│ └─────────────────┘     │
└─────────────────────────┘

APIs:
  GET  /v1/customer/profile  → Profile info
  POST /v1/auth/logout       → Logout button
```

### 10.1 Edit Profile Screen
```
┌─────────────────────────┐
│ ← Edit Profile          │
│─────────────────────────│
│       ┌─────┐           │
│       │ 👤  │ [Change]  │  ← Profile pic upload
│       └─────┘           │
│ Full Name                │
│ ┌─────────────────┐     │
│ │ Abhishek Kumar  │     │
│ └─────────────────┘     │
│ Email                    │
│ ┌─────────────────┐     │
│ │ abhi@email.com  │     │
│ └─────────────────┘     │
│ Phone (read-only)        │
│ ┌─────────────────┐     │
│ │ +91 98765XXXXX  │     │  ← Disabled
│ └─────────────────┘     │
│                         │
│ ┌─────────────────┐     │
│ │  Save Changes ➜ │     │
│ └─────────────────┘     │
└─────────────────────────┘

APIs:
  GET /v1/customer/profile    → Load current profile
  PUT /v1/customer/profile    → Save changes
      Body: { fullName, email, profilePic }
  POST /v1/customer/device    → Register device token
```

---

## 🗺️ COMPLETE SCREEN FLOW DIAGRAM

```
                          ┌─────────────┐
                          │   SPLASH    │
                          └──────┬──────┘
                                 │
                   ┌─────────────┴────────────┐
                   │                          │
             ┌─────▼─────┐            ┌───────▼──────┐
             │  WELCOME  │            │    HOME      │
             └─────┬─────┘            └───────┬──────┘
                   │                          │
             ┌─────▼─────┐     ┌──────────────┼──────────────┐
             │   LOGIN   │     │              │              │
             └─────┬─────┘     │              │              │
                   │     ┌─────▼────┐ ┌───────▼───┐ ┌────────▼──────┐
             ┌─────▼──┐  │ VEHICLES │ │ DOCUMENTS │ │   EXPENSES    │
             │  OTP   │  └────┬─────┘ └─────┬─────┘ └───────┬───────┘
             └────┬───┘       │             │               │
                  │     ┌─────▼─────┐ ┌─────▼─────┐ ┌───────▼───────┐
             ┌────▼───┐ │  DETAIL   │ │  UPLOAD   │ │  ADD EXPENSE  │
             │SUCCESS │ └─────┬─────┘ └───────────┘ │ (4 methods)   │
             └────────┘       │                     └───────┬───────┘
                        ┌─────┼─────┐                       │
                        │     │     │               ┌───────▼───────┐
                   ┌────▼┐┌───▼──┐┌─▼──┐            │  ANALYTICS    │
                   │CHLN ││SHARE ││SRVC│            └───────────────┘
                   └─────┘└──────┘└────┘

         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │   AI CHAT    │  │NOTIFICATIONS │  │    MORE      │
         │   (Tab 2)    │  │   (Tab 3)    │  │   (Tab 4)    │
         └──────┬───────┘  └──────────────┘  └──────┬───────┘
                │                                    │
         ┌──────▼───────┐                     ┌──────▼───────┐
         │ CHAT HISTORY │                     │EDIT PROFILE  │
         └──────────────┘                     └──────────────┘
```

---

## 📊 API ↔ SCREEN MAPPING TABLE

| # | Screen | APIs Used | Method |
|---|--------|-----------|--------|
| 1 | Welcome | *None* | Static |
| 2 | Login | `POST /v1/auth/send-otp` | Send OTP |
| 3 | OTP | `POST /v1/auth/verify-otp` | Verify & get token |
| 4 | Success | *Token storage* | Auto-redirect |
| 5 | Home | `GET /v1/customer/profile` | Greeting |
|   |      | `GET /v1/vehicles` | Vehicle cards |
|   |      | `GET /v1/documents/expiring` | Alerts |
|   |      | `GET /v1/expenses/summary` | Monthly total |
|   |      | `GET /v1/notifications` | Badge count |
| 6 | Vehicle List | `GET /v1/vehicles` | Full list |
| 7 | Add Vehicle | `POST /v1/vehicles` | Create vehicle |
| 8 | Vehicle Detail | `GET /v1/vehicles/:id` | Details |
|   |               | `POST /v1/vehicles/:id/health/recalculate` | Recalculate |
|   |               | `POST /v1/vehicles/:id/odometer` | Update reading |
|   |               | `POST /v1/vehicles/:id/odometer-ai` | AI scan photo |
|   |               | `PUT /v1/vehicles/:id` | Edit |
|   |               | `DELETE /v1/vehicles/:id` | Delete |
| 9 | Challans | `GET /v1/vehicles/:id/challans` | List |
|   |          | `POST /v1/vehicles/:id/challans/sync` | Sync |
|   |          | `PATCH /v1/vehicles/challans/:id/pay` | Mark paid |
| 10 | Sharing | `POST /v1/sharing/share` | Share |
|    |         | `GET /v1/sharing/vehicle/:id/access` | List access |
|    |         | `DELETE /v1/sharing/vehicle/:id/access/:cid` | Revoke |
|    |         | `GET /v1/sharing/shared-with-me` | Incoming |
| 11 | Document List | `GET /v1/documents` | All docs |
| 12 | Upload Doc | `POST /v1/documents` | Upload + OCR |
| 13 | Doc Detail | `GET /v1/documents/:id` | Details |
|    |            | `POST /v1/documents/:id/verify` | Verify |
|    |            | `DELETE /v1/documents/:id` | Delete |
| 14 | DigiLocker | `GET /v1/documents/digilocker/connect` | OAuth |
|    |            | `POST /v1/documents/digilocker/sync` | Sync docs |
| 15 | Expense List | `GET /v1/expenses` | Filter + list |
| 16 | Add Expense | `POST /v1/expenses` | Manual |
|    |             | `POST /v1/expenses/parse/voice` | Voice |
|    |             | `POST /v1/expenses/parse/receipt` | Receipt OCR |
|    |             | `POST /v1/expenses/parse/text` | SMS parse |
| 17 | Analytics | `GET /v1/expenses/summary` | Summary |
|    |           | `GET /v1/expenses/insights` | AI insights |
|    |           | `GET /v1/expenses/vehicles/:id/cost-per-km` | Efficiency |
|    |           | `POST /v1/expenses/anomalies/check` | Anomaly check |
| 18 | Budget | `POST /v1/expenses/budgets` | Set budget |
| 19 | Fuel Prices | `GET /v1/expenses/fuel-prices` | Current |
|    |             | `GET /v1/expenses/fuel-prices/compare` | Compare |
|    |             | `POST /v1/expenses/fuel-prices/calculate-liters` | Calc |
| 20 | Service History | `GET /v1/expenses/warranty/vehicles/:id/history` | History |
|    |                 | `POST /v1/expenses/warranty/service-records` | Log service |
| 21 | Warranty Status | `GET /v1/expenses/warranty/vehicles/:id/status` | Status |
|    |                 | `GET /v1/expenses/warranty/vehicles/:id/upcoming` | Upcoming |
| 22 | AI Chat | `POST /v1/chat` | Send / receive |
|    |         | `GET /v1/chat/sessions` | History list |
|    |         | `GET /v1/chat/sessions/:id` | Load session |
| 23 | Notifications | `GET /v1/notifications` | List |
|    |               | `PATCH /v1/notifications/:id/read` | Mark read |
| 24 | Profile | `GET /v1/customer/profile` | Load |
|    |         | `PUT /v1/customer/profile` | Update |
|    |         | `POST /v1/customer/device` | Register device |
|    |         | `POST /v1/auth/logout` | Logout |

---

## 📱 TOTAL SCREENS: 24

| Module | Screens | Count |
|--------|---------|-------|
| Auth | Welcome, Login, OTP, Success | 4 |
| Home | Home Dashboard | 1 |
| Vehicles | List, Add, Detail, Challans, Sharing | 5 |
| Documents | List, Upload, Detail, DigiLocker | 4 |
| Expenses | List, Add (4 methods), Analytics, Budget | 4 |
| Fuel | Fuel Prices | 1 |
| Warranty | Service History, Warranty Status | 2 |
| AI Chat | Chat Screen | 1 |
| Notifications | Notification List | 1 |
| Profile | More Menu, Edit Profile | 2 |
| **TOTAL** | | **25** |

---

## 🎨 BUTTON & ACTION REFERENCE

| Button | Screen | Action | API Called |
|--------|--------|--------|-----------|
| Get Started | Welcome | → Login Screen | - |
| Send OTP | Login | Sends OTP to phone | `POST /auth/send-otp` |
| Verify | OTP | Verifies code, gets token | `POST /auth/verify-otp` |
| Search | Home | Global search overlay | Client-side filter |
| Quick Action: Vehicles | Home | → Vehicle List | - |
| Quick Action: Docs | Home | → Document List | - |
| Quick Action: Expenses | Home | → Expense List | - |
| Quick Action: AI | Home | → AI Chat Tab | - |
| Quick Action: Maintenance | Home | → Service History | - |
| Quick Action: Share | Home | → Shared Vehicles | - |
| Quick Action: Fuel | Home | → Fuel Prices | - |
| Quick Action: Challans | Home | → Vehicle → Challans | - |
| + Add Vehicle | Vehicle List | → Add Vehicle Screen | - |
| Add Vehicle ➜ | Add Vehicle | Creates vehicle | `POST /vehicles` |
| ✏️ Edit | Vehicle Detail | Inline edit mode | `PUT /vehicles/:id` |
| 🗑️ Delete | Vehicle Detail | Confirm → Delete | `DELETE /vehicles/:id` |
| Recalculate | Vehicle Detail | Recalculates health | `POST /vehicles/:id/health/recalculate` |
| Update Odometer | Vehicle Detail | Odometer input modal | `POST /vehicles/:id/odometer` |
| 📷 Scan Odometer | Vehicle Detail | Camera → AI read | `POST /vehicles/:id/odometer-ai` |
| Set Primary | Vehicle Detail | Sets as primary | `PUT /vehicles/:id/primary` |
| Sync Challans | Challans | Fetches from server | `POST /vehicles/:id/challans/sync` |
| Mark as Paid | Challans | Updates challan | `PATCH /challans/:id/pay` |
| Share ➜ | Sharing | Shares vehicle access | `POST /sharing/share` |
| Revoke | Sharing | Removes access | `DELETE /sharing/...` |
| 📤 Upload | Document List | → Upload Screen | - |
| 🔗 DigiLocker | Document List | → DigiLocker OAuth | `GET /digilocker/connect` |
| Upload ➜ | Upload Doc | Uploads + OCR | `POST /documents` |
| Verify | Doc Detail | Triggers verification | `POST /documents/:id/verify` |
| + Add Expense | Expense List | → Add Expense | - |
| Save Expense ➜ | Add Expense | Saves expense | `POST /expenses` |
| 🎤 Voice | Add Expense | Records → AI parse | `POST /expenses/parse/voice` |
| 📷 Receipt | Add Expense | Photo → OCR parse | `POST /expenses/parse/receipt` |
| + Set Budget | Budget | Creates budget | `POST /expenses/budgets` |
| Calculate | Fuel Prices | Amount → Liters | `POST /fuel-prices/calculate-liters` |
| + Log Service | Service History | Creates record | `POST /warranty/service-records` |
| Send (Chat) | AI Chat | Sends message | `POST /chat` |
| 🎤 Voice (Chat) | AI Chat | Voice → text → send | `POST /chat` |
| New Chat | AI Chat | Starts new session | `POST /chat` (no sessionId) |
| Tap Notification | Notifications | Marks read + navigate | `PATCH /notifications/:id/read` |
| Save Changes ➜ | Edit Profile | Updates profile | `PUT /customer/profile` |
| 🚪 Logout | More | Logs out, clears token | `POST /auth/logout` |

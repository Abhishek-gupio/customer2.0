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

## 🔐 1. AUTH MODULE (Matches `auth.swagger.ts`)

**Screens:** Welcome, Login, OTP, Success

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

## 👤 2. CUSTOMER MODULE (Matches `customer.swagger.ts`)

**Screens:** Home (Dashboard), More Menu, Edit Profile

### 2.1 HOME SCREEN (Tab 1 / Dashboard)

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

### 2.2 MORE / PROFILE SCREEN (Tab 4)

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

### 2.3 Edit Profile Screen

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

## 🚗 3. VEHICLE MODULE (Matches `vehicle.swagger.ts`)

**Screens:** List, Add, Detail, Challans

```
Home ──▶ Vehicle List ──▶ Vehicle Detail ──▶ Health Score
              │                  │
              ▼                  └──▶ Challans
         Add Vehicle
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
│ └─────────────────────────┘

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
│ └─────────────────────────┘

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

---

## 📄 4. DOCUMENT MODULE (Matches `document.swagger.ts`)

**Screens:** List, Upload, Detail, DigiLocker

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

## 💰 5. EXPENSE MODULE (Matches `expense.swagger.ts`)

**Screens:** Expense List, Add Expense, Analytics, Budget, Fuel Prices, Service History, Warranty

```
Home ──▶ Expense List ──▶ Expense Detail
              │
              ├──▶ Add Expense (Manual / Voice / Receipt / Text)
              ├──▶ Expense Summary & Analytics
              ├──▶ Budget Settings
              ├──▶ Fuel Price Module
              └──▶ Warranty & Service Module
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

### 5.5 Fuel Price Screens (Sub-module)

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

### 5.6 Warranty & Service Screens (Sub-module)

**Service History Screen**

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

**Warranty Status Screen**

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

## 🔗 6. SHARING MODULE (Matches `sharing.swagger.ts`)

**Screens:** Vehicle Sharing (Moved from Vehicle Module)

### 6.1 Vehicle Sharing Screen

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

## 🔔 7. NOTIFICATION MODULE (Matches `notification.swagger.ts`)

**Screens:** Notifications (Tab 3)

### 7.1 Notification/Inbox Screen

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

## 🤖 8. CHAT MODULE (Matches `chat.swagger.ts`)

**Screens:** AI Chat (Tab 2)

### 8.1 AI Chat Screen

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

## 🗺️ COMPLETE SCREEN FLOW DIAGRAM (Updated)

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
                        ┌─────┴─────┐                       │
                        │   SHARE   │               ┌───────▼───────┐
                        └───────────┘               │  ANALYTICS    │
                                                    └───────┬───────┘
         ┌──────────────┐  ┌──────────────┐                 │
         │   AI CHAT    │  │NOTIFICATIONS │         ┌───────▼───────┐
         │   (Tab 2)    │  │   (Tab 3)    │         │  WARRANTY &   │
         └──────┬───────┘  └──────────────┘         │  FUEL SCREENS │
                │                                   └───────────────┘
         ┌──────▼───────┐                     ┌──────────────┐
         │ CHAT HISTORY │                     │    MORE      │
         └──────────────┘                     │   (Tab 4)    │
                                              └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │EDIT PROFILE  │
                                              └──────────────┘
```

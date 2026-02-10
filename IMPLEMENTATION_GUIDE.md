# 🚗 Gupio Customer 2.0 - Smart Vehicle Assistant (Backend)
## Full Implementation Guide & Prediction Logic

This document provides a comprehensive end-to-end breakdown of the features, logic, and intelligence systems implemented in the Gupio Customer 2.0 backend.

---

## 1. User Onboarding & Auth Flow
Starting from the first interaction, the app is designed for speed and friction-less onboarding.

### **Signup & Login**
- **Trigger**: User enters their Phone Number.
- **Process**:
    1. System checks if a `Customer` exists with that number.
    2. Sends an OTP via the **Flash49 Service**.
    3. On verification, a **JWT (JSON Web Token)** is issued.
- **Auto-Sync**: If the user has a **DigiLocker** account, they can click "Connect" which uses OAuth to fetch all government-issued vehicle documents (RC, DL) automatically.

---

## 2. The "Zero-Effort" Intelligence Layer
The core value proposition of Gupio is that the user **doesn't have to type**. We use AI to do the data entry.

### **A. Document AI (Google Gemini Vision Integration)**
When a user uploads an image (RC, Insurance, or PUC), the `ocrService` takes over:
- **How it works**: We feed the image buffer directly into **Google Gemini 1.5 Flash**.
- **The Prompt**: The AI is instructed as an "Expert Indian Vehicle Assistant" to extract:
    - **Document Type**: (Detects if it's an RC, Insurance, or PUC).
    - **Vehicle Details**: Make, Model, Fuel Type, Chassis Number.
    - **Critical Dates**: Registration Date, Issue Date, and **Expiry Date**.
- **Prediction Accuracy**: Unlike old-school OCR (which just reads text), Gemini *understands* the layout. Even if a document is blurry or tilted, it contextually "predicts" the values.

### **B. Smart Auto-Vehicle Creation**
- **Scenario**: A user uploads an RC but hasn't added a vehicle yet.
- **Logic**:
    1. The AI extracts the **Registration Number** (e.g., MH12AB1234).
    2. The system checks if this vehicle already exists in the database.
    3. If not, it **automatically creates a Vehicle Record** using the make/model extracted by the AI.
- **Result**: One upload performs two actions: Saves the document AND sets up the car.

---

## 3. The Prediction Engine (How it works)
Gupio isn't just a locker; it's a **Predictive Assistant**.

### **A. Expiry Prediction (Compliance Monitoring)**
- **Scanning**: A **Daily Cron Job** runs every morning at 10:00 AM.
- **Alert Logic**: Scans for documents expiring in **30, 15, and 7 days**.
- **Orchestration**: Automatically triggers Push + In-App + SMS alerts.

### **B. Advanced Prediction Engine (Vehicle Intelligence)**
We've moved beyond simple logic to a **Usage-Based Prediction Model**:
1.  **ADR (Average Daily Running)**:
    - The system tracks historical `OdometerLogs`. 
    - It calculates the **ADR** (e.g., if you drive 500km in 10 days, ADR is 50km/day).
2.  **Mileage Forecasting**:
    - Even if you don't open the app, Gupio "predicts" your current mileage using the ADR.
    - **Service Prediction**: It forecasts exactly when you will hit your next 10,000km service milestone based on your driving pattern.
3.  **Multi-Factor Health Audit**:
    - The **Health Score (0-100)** is now a weighted audit of 4 factors:
        - **Compliance (40%)**: Critical drop if Insurance/PUC is expired.
        - **Usage (20%)**: High mileage penalty (over 100k km).
        - **Vintage (30%)**: Age-based decay (penalty for cars >10 or >15 years).
        - **Stress (10%)**: Penalty for extreme daily running (>100 km/day).

### **C. Drift Management & Self-Correction**
A key challenge in predictions is "Drift"—where the AI predicts higher usage than reality.
- **Ground Truth Anchor**: The prediction is purely virtual. The moment a user logs a manual reading, it becomes the **Ground Truth Anchor**. It wipes out the virtual prediction and resets the baseline.
- **Dynamic ADR Adjustment**: If the car was driven less than predicted, the new log results in a smaller "KM Delta". The `calculateADR` function automatically lowers the daily average, making the *future* predictions more accurate.
- **Snap-to-Odometer (AI)**: Users don't even have to type. They can just snap a photo of their dashboard, and the AI extracts the odometer reading automatically.
- **Rewind Protection**: To prevent data entry errors, the system blocks any manual log that is lower than a *previous* manual log.

### **D. Human-in-the-Loop Training**
- **Verification Loop**: Every AI prediction is shown with a "Pending" status.
- **User Feedback**: When a user confirms or corrects a predicted value (like an expiry date), the system saves this as a `VERIFIED` record, which effectively "trains" our database reliability over time.

---

## 4. Proactive Multi-Channel Notifications
We ensure the user never misses an alert by using an "Orchestrator" pattern in `notificationService`.

- **In-App Notification**: A record is created in the `InAppNotification` table. This powers the "Bell Icon" in the app with "Read/Unread" states.
- **Push Notification**: Uses the `deviceToken` to send a real-time mobile alert (simulated via FCM logic).
- **SMS/Email**: High-priority alerts (like 7-day expiry) also trigger a direct SMS via the **SMSService**.

---

## 5. Growth Loop: Smart Invite
We leverage existing users to acquire new ones through the "Smart Invite" system.
- **Flow**: User A wants to share their Car with User B (his driver or wife).
- **Logic**:
    1. User A enters User B's phone number.
    2. System checks: "Is User B registered?"
    3. **Existing User**: They get a real-time notification to accept access.
    4. **Non-User (The Predictor)**: System predicts this is a growth opportunity. It creates a "Pending Invite" and sends an SMS to User B with a referral link to download Gupio.

---

## 6. Trust Badge (Verification & Manual Loop)
To ensure the AI never makes a mistake, we implement a **Human-in-the-loop** trust system.
- **Initial Status**: All AI-extracted data is marked as `PENDING`.
- **The Badge**: In the UI, the user sees a "Please Verify" prompt.
- **Action**: Once the user confirms the data is correct, the `verifyDocument` API is called.
- **Final Status**: The document gets a **VERIFIED** badge, and the `verifiedAt` timestamp is recorded.

---

## 🛠 Technical Stack Summary
- **Database**: PostgreSQL (Via Prisma ORM).
- **AI Brain**: Google Gemini 1.5 Flash (Vision + Structured JSON).
- **Background Tasks**: Node-Cron (Daily automated scans).
- **Auth**: JWT + OTP (Flash49 / Gmail).
- **Communication**: FCM (Push), Flash49 (SMS), In-App (Websockets/Polling).

---
## 7. Smart Challan (Traffic Fine) Monitor
Keep users legally protected by predicting and monitoring traffic fines.
- **Auto-Sync Logic**: The system performs a background sync with E-Challan/Parivahan databases daily.
- **Proactive Alert**: If a new `UNPAID` challan is detected, it triggers a **Multi-Channel Warning (SMS + Push + In-App)** with the fine amount and violation type.
- **Revenue Protection**: By alerting users immediately, it helps them pay before the fine amounts double or lead to legal notices.

---
*Created by Antigravity AI for Gupio Customer 2.0*

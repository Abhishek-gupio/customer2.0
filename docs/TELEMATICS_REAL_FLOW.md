# How Driving Behavior (Damoov) Works in Real

## Overview

1. **Backend** stores which phone (InstanceID) is linked to which vehicle and receives trip data from Damoov’s cloud via webhook.
2. **App** links the phone to a vehicle once; then the phone SDK (or script) sends trips to Damoov → Damoov calls our webhook → we save trips.
3. **Driving Behavior screen** loads trips for the user’s primary vehicle from our API and shows score, distance, events.

---

## Real production flow

### 1. Backend configuration (one-time)

In **Backend/.env**:

- `DAMOOV_INSTANCE_ID`, `DAMOOV_INSTANCE_KEY` – from Damoov dashboard (your app instance).
- `DAMOOV_WEBHOOK_SECRET` – a secret you choose; configure the same value in Damoov as the webhook auth.

In **Damoov dashboard**:

- Set **Webhook URL** to: `https://your-api-domain.com/api/v1/telematics/webhook`
- Set the same **webhook secret** as `DAMOOV_WEBHOOK_SECRET`.

### 2. User links their phone to a vehicle (one-time in app)

- User opens **Driving Behavior** and taps **“Link this phone to [Vehicle]”** (or similar).
- App does:
  1. **Register:** `POST /api/v1/telematics/register` with `{ "clientCustomId": "<customerId or phone>" }`  
     → Backend calls Damoov and returns a **DeviceToken**.
  2. **SDK (when integrated):** App starts the Damoov/TelematicSSDK on the device with that **DeviceToken**. The SDK provides an **InstanceID** (and records trips in the background).
  3. **Link:** `POST /api/v1/telematics/link/:vehicleId` with `{ "instanceId", "deviceToken", "platform": "ios"|"android" }`  
     → Backend stores `TelematicsDevice(vehicleId, instanceId, ...)`.

Without the native SDK, the app can still call register + link with a **placeholder instanceId** (e.g. `app-<userId>-<timestamp>`) so the flow is wired; real trips will only appear after the SDK is integrated and Damoov sends webhooks for that SDK’s InstanceID.

### 3. When the user drives (with SDK integrated)

- The **Damoov SDK** on the phone records the trip (GPS, motion, events) and sends it to **Damoov cloud**.
- Damoov cloud processes the trip and calls **our webhook** with the same **InstanceID** and trip payload (distance, duration, score, events).
- Our backend finds the device by `InstanceID`, gets `vehicleId`, and saves a **DrivingTrip** (and **DrivingEvent**s).
- Optionally we update **VehicleHealthScore** (e.g. driving score).

### 4. User sees trips in the app

- **Driving Behavior** screen calls `GET /api/v1/telematics/:vehicleId/trips` for the user’s primary vehicle.
- Backend returns trips (and events) from our DB.
- UI shows aggregate score, distance, duration, harsh braking/acceleration.

---

## What exists today

| Piece | Status |
|--------|--------|
| Backend: register user with Damoov, return DeviceToken | Done |
| Backend: link device (vehicleId + instanceId + deviceToken) | Done |
| Backend: webhook to receive trips from Damoov | Done |
| Backend: save DrivingTrip + events, GET trips by vehicleId | Done |
| App: Driving Behavior screen, fetch trips, show score/metrics | Done |
| App: “Link this device” – call register + link | Added (see Driving Summary) |
| App: **Native Damoov/TelematicSSDK** – record trips, provide InstanceID | **To be integrated** |

---

## For real trips in production

1. **Integrate Damoov/TelematicSSDK** in the mobile app (iOS/Android) so the phone records trips and sends them to Damoov.
2. In the **“Link this phone”** flow, use the **InstanceID (and DeviceToken)** returned by the SDK when calling `POST .../telematics/link/:vehicleId`.
3. Ensure **webhook URL and secret** are set in the Damoov dashboard so Damoov can send trips to your backend.

After that, when users drive, trips will appear in Driving Behavior the same way as in the script-driven demo (script only simulated the webhook with a known InstanceID).

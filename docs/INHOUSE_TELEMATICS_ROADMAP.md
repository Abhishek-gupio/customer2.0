# In-House Telematics Rollout Plan

## Goal
Build a cost-controlled in-house telematics pipeline while keeping Damoov as a fallback.

## Current Implementation Status (April 1, 2026)
- Done: Provider toggle (`Damoov` / `In-house`) in mobile app.
- Done: Provider persisted in mobile storage.
- Done: Backend register/link/sync now accepts provider.
- Done: In-house trip ingestion endpoint and DB persistence (`DrivingTrip`, `DrivingEvent`).
- Started: Mobile in-house foreground trip recorder (GPS point capture + stop/upload flow in Driving Summary).
- Started: Android foreground service for background trip tracking while app is minimized.
- Done: Offline retry queue for in-house trip uploads with auto-sync when network returns.
- Started: Calibrated event thresholds + data-confidence scoring (vehicle-profile aware) for better trip-quality accuracy.
- Done: Global auto-monitor engine bootstrapped at app level so auto trip detection is no longer tied to the Driving screen being open.
- Started: Native Android always-armed monitor mode with boot restore and native trip handoff queue for auto-start without opening the Driving screen.
- Pending: iOS background tracking and advanced scoring calibration.

## Phase 0 (Now) - Provider Toggle and Safe Switching
- Add provider toggle in the app (`Damoov` / `In-house (Beta)`).
- Persist selected provider on device.
- Route backend register/sync behavior by provider.
- Keep existing Damoov flow untouched for production stability.

## Phase 1 - In-House Data Ingestion (Server)
- Add in-house trip ingestion endpoint.
- Store in-house trips/events in existing `DrivingTrip` and `DrivingEvent` tables.
- Reuse current trip timeline and summary screens with no schema break.

## Phase 2 - Mobile In-House Tracker (Client)
- Add background location + activity capture service.
- Detect trip start/stop using speed + dwell heuristics.
- Upload finalized trip payloads to in-house ingestion endpoint.
- Implement retry queue for offline uploads.

## Phase 3 - Scoring and Event Detection
- Baseline rules:
  - harsh braking (deceleration threshold)
  - hard acceleration (acceleration threshold)
  - speeding (speed vs limit when available)
- Score v1 with weighted penalties and confidence values.
- Add calibration config by vehicle type (car/bike).

## Phase 4 - Validation and Cutover
- Run dual mode for sample users (`Damoov` + in-house shadow compare).
- Track KPI deltas:
  - trip detection rate
  - distance error %
  - event precision/recall
- Move cohorts gradually to in-house when thresholds are met.

## Success Metrics (Targets)
- Trip detection recall: >= 92%
- Distance median error: <= 8%
- False trip rate: <= 5%
- Harsh event precision: >= 80%

## Risk Controls
- Keep Damoov switch available for rollback.
- Feature-flag background tracker by cohort.
- Add aggressive logging for failed ingestion and trip parsing.

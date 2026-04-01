import { Platform } from 'react-native';
import { telematicsApi } from '../api/telematics';
import {
  inHouseTelematicsNative,
  type NativeCompletedTrip,
  type NativeServiceStatus,
  type NativeTelemetryPoint,
} from '../native/inHouseTelematicsNative';
import { getNetworkOnlineState } from './api';
import { queueInHouseTripUpload } from './offlineMutationQueue';

type LocationPoint = {
  latitude: number;
  longitude: number;
  timestampMs: number;
  speedKmh: number | null;
  accuracy: number | null;
};

type TripEventType = 'HARSH_BRAKING' | 'HARD_ACCELERATION' | 'SPEEDING';
type VehicleProfile = 'bike' | 'car' | 'heavy';

type ScoringCalibration = {
  harshBrakeDecelMs2: number;
  hardAccelMs2: number;
  speedingThresholdKmh: number;
  maxPointAccuracyMeters: number;
  maxJumpMeters: number;
  minSegmentSec: number;
  maxSegmentSec: number;
  maxReasonableSpeedKmh: number;
  eventCooldownMs: number;
};

type RecorderState = {
  isRunning: boolean;
  startedAtMs: number | null;
  watchId: number | null;
  points: LocationPoint[];
  lastError: string | null;
  lastAutoProbePoint: LocationPoint | null;
  autoMovementProbeHits: number;
  lastMovementProbeAtMs: number | null;
};

type StopResult =
  | {
      submitted: true;
      tripId: string;
      distanceKm: number;
      durationMin: number;
      safetyScore: number;
      points: number;
      events: number;
      queuedOffline?: boolean;
      queueSize?: number;
    }
  | {
      submitted: false;
      reason:
        | 'not_running'
        | 'no_geolocation'
        | 'no_points'
        | 'too_short'
        | 'upload_failed';
      error?: string;
    };

type AutoProcessResult =
  | { action: 'none' }
  | {
      action: 'trip_saved';
      result: Extract<StopResult, { submitted: true }>;
    }
  | {
      action: 'trip_not_saved';
      result: Extract<StopResult, { submitted: false }>;
    };

type RecorderMode = 'idle' | 'monitoring' | 'tracking';

type RecorderStatus = {
  isRunning: boolean;
  startedAtMs: number | null;
  pointsCaptured: number;
  mode: RecorderMode;
  hasPendingCompletedTrip: boolean;
};

const Geolocation: any = (() => {
  try {
    const geoModule = require('@react-native-community/geolocation') as any;
    return geoModule?.default ?? geoModule;
  } catch {
    const nav = (globalThis as any)?.navigator;
    return nav?.geolocation ?? null;
  }
})();

const MIN_POINT_GAP_MS = 4_000;
const MIN_POINT_GAP_METERS = 8;
const MIN_TRIP_DISTANCE_KM = 0.2;
const MIN_TRIP_DURATION_MS = 2 * 60 * 1000;
const AUTO_MOVING_SPEED_THRESHOLD_KMH = 8;
const AUTO_IDLE_STOP_MS = 3 * 60 * 1000;
const AUTO_MIN_ACTIVE_BEFORE_STOP_MS = 4 * 60 * 1000;
const AUTO_START_PROBE_HITS_REQUIRED = 2;
const AUTO_START_PROBE_WINDOW_MS = 90 * 1000;

const SCORING_CALIBRATION_BY_PROFILE: Record<VehicleProfile, ScoringCalibration> = {
  bike: {
    harshBrakeDecelMs2: -3.2,
    hardAccelMs2: 3.0,
    speedingThresholdKmh: 75,
    maxPointAccuracyMeters: 45,
    maxJumpMeters: 240,
    minSegmentSec: 0.8,
    maxSegmentSec: 18,
    maxReasonableSpeedKmh: 135,
    eventCooldownMs: 9000,
  },
  car: {
    harshBrakeDecelMs2: -2.8,
    hardAccelMs2: 2.6,
    speedingThresholdKmh: 90,
    maxPointAccuracyMeters: 55,
    maxJumpMeters: 320,
    minSegmentSec: 0.8,
    maxSegmentSec: 22,
    maxReasonableSpeedKmh: 170,
    eventCooldownMs: 10000,
  },
  heavy: {
    harshBrakeDecelMs2: -2.2,
    hardAccelMs2: 2.0,
    speedingThresholdKmh: 70,
    maxPointAccuracyMeters: 70,
    maxJumpMeters: 260,
    minSegmentSec: 1,
    maxSegmentSec: 26,
    maxReasonableSpeedKmh: 110,
    eventCooldownMs: 12000,
  },
};

const state: RecorderState = {
  isRunning: false,
  startedAtMs: null,
  watchId: null,
  points: [],
  lastError: null,
  lastAutoProbePoint: null,
  autoMovementProbeHits: 0,
  lastMovementProbeAtMs: null,
};

let nativeStatusCache: RecorderStatus = {
  isRunning: false,
  startedAtMs: null,
  pointsCaptured: 0,
  mode: 'idle',
  hasPendingCompletedTrip: false,
};

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function speedMsToKmh(speedMs?: number | null): number | null {
  if (typeof speedMs !== 'number' || !isFinite(speedMs) || speedMs < 0) {
    return null;
  }
  return speedMs * 3.6;
}

function shouldCapturePoint(next: LocationPoint): boolean {
  const prev = state.points[state.points.length - 1];
  if (!prev) return true;

  const dt = next.timestampMs - prev.timestampMs;
  if (dt >= MIN_POINT_GAP_MS) return true;

  const distMeters = haversineMeters(
    prev.latitude,
    prev.longitude,
    next.latitude,
    next.longitude,
  );
  return distMeters >= MIN_POINT_GAP_METERS;
}

function pushPoint(raw: any): void {
  const coords = raw?.coords;
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);

  if (!isFinite(latitude) || !isFinite(longitude)) return;

  const point: LocationPoint = {
    latitude,
    longitude,
    timestampMs: Number(raw?.timestamp ?? Date.now()),
    speedKmh: speedMsToKmh(coords?.speed),
    accuracy:
      typeof coords?.accuracy === 'number' && isFinite(coords.accuracy)
        ? Number(coords.accuracy)
        : null,
  };

  if (shouldCapturePoint(point)) {
    state.points.push(point);
  }
}

function pointFromNative(raw: NativeTelemetryPoint): LocationPoint | null {
  const latitude = Number(raw?.latitude);
  const longitude = Number(raw?.longitude);
  const timestampMs = Number(raw?.timestampMs);

  if (!isFinite(latitude) || !isFinite(longitude) || !isFinite(timestampMs)) {
    return null;
  }

  const speedRaw = Number(raw?.speedKmh);
  const accuracyRaw = Number(raw?.accuracy);

  return {
    latitude,
    longitude,
    timestampMs,
    speedKmh: isFinite(speedRaw) ? speedRaw : null,
    accuracy: isFinite(accuracyRaw) ? accuracyRaw : null,
  };
}

function normalizeRecorderMode(value: string | null | undefined): RecorderMode {
  if (value === 'tracking' || value === 'monitoring') return value;
  return 'idle';
}

function recorderStatusFromNative(raw: NativeServiceStatus | null | undefined): RecorderStatus {
  const mode = normalizeRecorderMode(raw?.mode);
  const startedAtMs =
    typeof raw?.startedAtMs === 'number' && isFinite(raw.startedAtMs)
      ? Number(raw.startedAtMs)
      : null;
  const pointsCaptured =
    typeof raw?.pointsCaptured === 'number' && isFinite(raw.pointsCaptured)
      ? Math.max(0, Math.round(raw.pointsCaptured))
      : 0;

  return {
    isRunning: mode === 'tracking',
    startedAtMs,
    pointsCaptured,
    mode,
    hasPendingCompletedTrip: Boolean(raw?.hasPendingCompletedTrip),
  };
}

function pointsFromCompletedNativeTrip(raw: NativeCompletedTrip | null): LocationPoint[] {
  const source = Array.isArray(raw?.points) ? raw.points : [];
  return source.map(pointFromNative).filter((point): point is LocationPoint => point != null);
}

function mergeAndSortPoints(points: LocationPoint[]): LocationPoint[] {
  const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
  const deduped: LocationPoint[] = [];

  for (const point of sorted) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.timestampMs === point.timestampMs &&
      prev.latitude === point.latitude &&
      prev.longitude === point.longitude
    ) {
      continue;
    }
    deduped.push(point);
  }

  return deduped;
}

function getSpeed(point: LocationPoint): number {
  return point.speedKmh ?? 0;
}

function estimateMovementMeters(prev: LocationPoint, next: LocationPoint): number {
  return haversineMeters(prev.latitude, prev.longitude, next.latitude, next.longitude);
}

function computeSegmentMetrics(prev: LocationPoint, next: LocationPoint): {
  dtSec: number;
  movedMeters: number;
  derivedSpeedKmh: number;
  avgAccuracyMeters: number;
} {
  const dtSec = Math.max(0, (next.timestampMs - prev.timestampMs) / 1000);
  const movedMeters = haversineMeters(
    prev.latitude,
    prev.longitude,
    next.latitude,
    next.longitude,
  );
  const derivedSpeedKmh = dtSec > 0 ? (movedMeters / dtSec) * 3.6 : 0;

  const knownAccuracies = [prev.accuracy, next.accuracy].filter(
    (value): value is number => value != null && isFinite(value),
  );
  const avgAccuracyMeters = knownAccuracies.length
    ? knownAccuracies.reduce((sum, value) => sum + value, 0) / knownAccuracies.length
    : 18;

  return { dtSec, movedMeters, derivedSpeedKmh, avgAccuracyMeters };
}

function isLikelyDriftSegment(
  prev: LocationPoint,
  next: LocationPoint,
  calibration?: ScoringCalibration,
): boolean {
  const { dtSec, movedMeters, derivedSpeedKmh, avgAccuracyMeters } = computeSegmentMetrics(
    prev,
    next,
  );
  if (dtSec <= 0) return true;

  const lowMeasuredSpeed =
    getSpeed(prev) < AUTO_MOVING_SPEED_THRESHOLD_KMH &&
    getSpeed(next) < AUTO_MOVING_SPEED_THRESHOLD_KMH;
  const jitterRadius = Math.max(10, avgAccuracyMeters * 1.2);

  if (lowMeasuredSpeed && movedMeters <= jitterRadius) {
    return true;
  }

  if (
    calibration &&
    derivedSpeedKmh > calibration.maxReasonableSpeedKmh * 1.15 &&
    movedMeters > calibration.maxJumpMeters
  ) {
    return true;
  }

  return false;
}

function findLastMovingTimestamp(points: LocationPoint[]): number | null {
  if (points.length === 0) return null;

  let lastMoving: number | null = null;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const { movedMeters, derivedSpeedKmh, avgAccuracyMeters } = computeSegmentMetrics(
      prev,
      current,
    );
    const jitterRadius = Math.max(12, avgAccuracyMeters * 1.35);

    const moving =
      getSpeed(current) >= AUTO_MOVING_SPEED_THRESHOLD_KMH ||
      getSpeed(prev) >= AUTO_MOVING_SPEED_THRESHOLD_KMH ||
      (movedMeters > jitterRadius && derivedSpeedKmh >= 6);

    if (moving) {
      lastMoving = current.timestampMs;
    }
  }

  if (lastMoving == null) {
    const last = points[points.length - 1];
    if (getSpeed(last) >= AUTO_MOVING_SPEED_THRESHOLD_KMH) {
      return last.timestampMs;
    }
  }

  return lastMoving;
}

function isLikelyTransientUploadError(error: any): boolean {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (!status) return true;
  if (status >= 500) return true;
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') return true;
  if (
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('timeout')
  ) {
    return true;
  }
  return false;
}

function normalizeVehicleProfile(vehicleType?: string | null): VehicleProfile {
  const value = String(vehicleType || '').toLowerCase();
  if (
    value.includes('bike') ||
    value.includes('motorcycle') ||
    value.includes('scooter') ||
    value.includes('2w') ||
    value.includes('two')
  ) {
    return 'bike';
  }
  if (
    value.includes('truck') ||
    value.includes('bus') ||
    value.includes('heavy') ||
    value.includes('commercial') ||
    value.includes('lorry')
  ) {
    return 'heavy';
  }
  return 'car';
}

function resolveScoringCalibration(vehicleType?: string | null): {
  profile: VehicleProfile;
  calibration: ScoringCalibration;
} {
  const profile = normalizeVehicleProfile(vehicleType);
  return { profile, calibration: SCORING_CALIBRATION_BY_PROFILE[profile] };
}

function preprocessPointsForScoring(
  inputPoints: LocationPoint[],
  calibration: ScoringCalibration,
): {
  points: LocationPoint[];
  droppedNoisyPoints: number;
  inferredSpeedCount: number;
} {
  const source = mergeAndSortPoints(inputPoints);
  if (source.length <= 1) {
    return { points: source, droppedNoisyPoints: 0, inferredSpeedCount: 0 };
  }

  const processed: LocationPoint[] = [];
  let droppedNoisyPoints = 0;
  let inferredSpeedCount = 0;

  for (const rawPoint of source) {
    const tooNoisy =
      rawPoint.accuracy != null &&
      rawPoint.accuracy > calibration.maxPointAccuracyMeters;
    if (tooNoisy) {
      droppedNoisyPoints += 1;
      continue;
    }

    const point: LocationPoint = { ...rawPoint };
    const prev = processed[processed.length - 1];

    if (prev) {
      const { dtSec, movedMeters, derivedSpeedKmh } = computeSegmentMetrics(prev, point);
      if (dtSec <= 0) continue;

      if (
        dtSec <= 2 &&
        movedMeters > calibration.maxJumpMeters &&
        (point.accuracy ?? 0) > 15
      ) {
        droppedNoisyPoints += 1;
        continue;
      }

      if (point.speedKmh == null) {
        if (isFinite(derivedSpeedKmh) && derivedSpeedKmh <= calibration.maxReasonableSpeedKmh) {
          point.speedKmh = Number(derivedSpeedKmh.toFixed(1));
          inferredSpeedCount += 1;
        }
      }

      if (point.speedKmh != null && point.speedKmh > calibration.maxReasonableSpeedKmh) {
        point.speedKmh = calibration.maxReasonableSpeedKmh;
      }

      if (!isLikelyDriftSegment(prev, point, calibration) && prev.speedKmh != null && point.speedKmh != null) {
        point.speedKmh = Number(((prev.speedKmh * 0.35) + (point.speedKmh * 0.65)).toFixed(1));
      }
    }

    processed.push(point);
  }

  return {
    points: mergeAndSortPoints(processed),
    droppedNoisyPoints,
    inferredSpeedCount,
  };
}

function computeDataConfidence(
  points: LocationPoint[],
  durationMs: number,
  inferredSpeedCount: number,
  droppedNoisyPoints: number,
): number {
  if (!points.length) return 0.35;

  const speedKnownCount = points.filter((point) => point.speedKmh != null).length;
  const speedCoverage = speedKnownCount / points.length;

  const accuracies = points
    .map((point) => point.accuracy)
    .filter((value): value is number => value != null && isFinite(value));
  const avgAccuracy = accuracies.length
    ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length
    : 55;
  const accuracyScore = clamp(1 - avgAccuracy / 80, 0.15, 1);

  const expectedPoints = Math.max(1, durationMs / 15000);
  const densityScore = clamp(points.length / expectedPoints, 0.2, 1);

  const inferredRatio = clamp(inferredSpeedCount / Math.max(points.length, 1), 0, 1);
  const droppedRatio = clamp(
    droppedNoisyPoints / Math.max(points.length + droppedNoisyPoints, 1),
    0,
    1,
  );

  const base = speedCoverage * 0.42 + accuracyScore * 0.33 + densityScore * 0.25;
  const penalty = inferredRatio * 0.18 + droppedRatio * 0.18;
  return clamp(base - penalty, 0.35, 0.98);
}

function computeDistanceKm(points: LocationPoint[]): number {
  if (points.length < 2) return 0;
  let meters = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const { dtSec, movedMeters, derivedSpeedKmh } = computeSegmentMetrics(prev, current);
    if (dtSec <= 0) continue;
    if (isLikelyDriftSegment(prev, current)) continue;
    if (dtSec > 90 && derivedSpeedKmh < 8) continue;
    meters += movedMeters;
  }
  return meters / 1000;
}

function computeMaxSpeedKmh(points: LocationPoint[]): number | null {
  let maxSpeed: number | null = null;
  for (const point of points) {
    if (typeof point.speedKmh !== 'number') continue;
    if (maxSpeed == null || point.speedKmh > maxSpeed) {
      maxSpeed = point.speedKmh;
    }
  }
  return maxSpeed;
}

function buildEvents(
  points: LocationPoint[],
  calibration: ScoringCalibration,
): {
  events: Array<{
    eventType: TripEventType;
    timestamp: string;
    latitude: number;
    longitude: number;
    severity: number;
    speed: number | null;
  }>;
  harshBrakingCount: number;
  hardAccelCount: number;
  speedingCount: number;
  harshBrakingScore: number;
  hardAccelScore: number;
  speedingScore: number;
} {
  const events: Array<{
    eventType: TripEventType;
    timestamp: string;
    latitude: number;
    longitude: number;
    severity: number;
    speed: number | null;
  }> = [];

  let harshBrakingCount = 0;
  let hardAccelCount = 0;
  let speedingCount = 0;
  let harshBrakingScore = 0;
  let hardAccelScore = 0;
  let speedingScore = 0;

  const lastEventAt: Partial<Record<TripEventType, number>> = {};

  const canEmit = (eventType: TripEventType, atMs: number) => {
    const prev = lastEventAt[eventType];
    if (prev != null && atMs - prev < calibration.eventCooldownMs) {
      return false;
    }
    lastEventAt[eventType] = atMs;
    return true;
  };

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const { dtSec, derivedSpeedKmh } = computeSegmentMetrics(prev, current);

    if (isLikelyDriftSegment(prev, current, calibration)) {
      continue;
    }

    if (
      dtSec >= calibration.minSegmentSec &&
      dtSec <= calibration.maxSegmentSec &&
      prev.speedKmh != null &&
      current.speedKmh != null
    ) {
      const prevSpeedMs = prev.speedKmh / 3.6;
      const currentSpeedMs = current.speedKmh / 3.6;
      let acceleration = (currentSpeedMs - prevSpeedMs) / dtSec;

      if (i >= 2) {
        const prevPrev = points[i - 2];
        const prevDtSec = (prev.timestampMs - prevPrev.timestampMs) / 1000;
        if (
          prevDtSec >= calibration.minSegmentSec &&
          prevDtSec <= calibration.maxSegmentSec &&
          prevPrev.speedKmh != null
        ) {
          const prevPrevSpeedMs = prevPrev.speedKmh / 3.6;
          const prevAcceleration = (prevSpeedMs - prevPrevSpeedMs) / prevDtSec;
          acceleration = (acceleration + prevAcceleration) / 2;
        }
      }

      if (
        acceleration <= calibration.harshBrakeDecelMs2 &&
        current.speedKmh >= 12 &&
        canEmit('HARSH_BRAKING', current.timestampMs)
      ) {
        const severity = clamp(
          Math.abs(acceleration) / Math.abs(calibration.harshBrakeDecelMs2 * 2),
          0.15,
          1,
        );
        harshBrakingCount += 1;
        harshBrakingScore += severity;
        events.push({
          eventType: 'HARSH_BRAKING',
          timestamp: new Date(current.timestampMs).toISOString(),
          latitude: current.latitude,
          longitude: current.longitude,
          severity,
          speed: current.speedKmh,
        });
      } else if (
        acceleration >= calibration.hardAccelMs2 &&
        current.speedKmh >= 8 &&
        canEmit('HARD_ACCELERATION', current.timestampMs)
      ) {
        const severity = clamp(acceleration / (calibration.hardAccelMs2 * 2), 0.15, 1);
        hardAccelCount += 1;
        hardAccelScore += severity;
        events.push({
          eventType: 'HARD_ACCELERATION',
          timestamp: new Date(current.timestampMs).toISOString(),
          latitude: current.latitude,
          longitude: current.longitude,
          severity,
          speed: current.speedKmh,
        });
      }
    }

    if (
      (current.speedKmh ?? 0) >= calibration.speedingThresholdKmh &&
      ((prev.speedKmh ?? 0) >= calibration.speedingThresholdKmh - 4 ||
        derivedSpeedKmh >= calibration.speedingThresholdKmh - 2) &&
      canEmit('SPEEDING', current.timestampMs)
    ) {
      const severity = clamp(
        ((current.speedKmh ?? calibration.speedingThresholdKmh) -
          calibration.speedingThresholdKmh +
          5) /
          35,
        0.1,
        1,
      );
      speedingCount += 1;
      speedingScore += severity;
      events.push({
        eventType: 'SPEEDING',
        timestamp: new Date(current.timestampMs).toISOString(),
        latitude: current.latitude,
        longitude: current.longitude,
        severity,
        speed: current.speedKmh,
      });
    }
  }

  return {
    events,
    harshBrakingCount,
    hardAccelCount,
    speedingCount,
    harshBrakingScore,
    hardAccelScore,
    speedingScore,
  };
}

function formatLocation(point: LocationPoint | undefined): any {
  if (!point) return null;
  return {
    Full: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`,
    Parts: {
      City: 'Unknown',
      Country: 'Unknown',
    },
    Latitude: point.latitude,
    Longitude: point.longitude,
  };
}

function cleanupWatcher(): void {
  if (state.watchId != null && Geolocation?.clearWatch) {
    Geolocation.clearWatch(state.watchId);
  }
  state.watchId = null;
}

function resetState(): void {
  state.points = [];
  state.startedAtMs = null;
  state.isRunning = false;
  state.lastError = null;
  state.autoMovementProbeHits = 0;
  state.lastMovementProbeAtMs = null;
}

function captureCurrentPoint(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    if (!Geolocation?.getCurrentPosition) {
      resolve();
      return;
    }

    Geolocation.getCurrentPosition(
      (position: any) => {
        pushPoint(position);
        resolve();
      },
      (error: any) => {
        state.lastError = error?.message || 'Unable to read current location.';
        resolve();
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}

function captureCurrentPointData(timeoutMs = 8000): Promise<LocationPoint | null> {
  return new Promise((resolve) => {
    if (!Geolocation?.getCurrentPosition) {
      resolve(null);
      return;
    }

    Geolocation.getCurrentPosition(
      (position: any) => {
        const coords = position?.coords;
        const latitude = Number(coords?.latitude);
        const longitude = Number(coords?.longitude);
        if (!isFinite(latitude) || !isFinite(longitude)) {
          resolve(null);
          return;
        }
        resolve({
          latitude,
          longitude,
          timestampMs: Number(position?.timestamp ?? Date.now()),
          speedKmh: speedMsToKmh(coords?.speed),
          accuracy:
            typeof coords?.accuracy === 'number' && isFinite(coords.accuracy)
              ? Number(coords.accuracy)
              : null,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}

async function buildAndSubmitTripFromPoints(
  rawPointsInput: LocationPoint[],
  vehicleId: string,
  options?: {
    vehicleType?: string | null;
    forcedStartedAtMs?: number | null;
    forcedEndedAtMs?: number | null;
    lastError?: string | null;
  },
): Promise<StopResult> {
  const rawPoints = mergeAndSortPoints(rawPointsInput);
  const lastError = options?.lastError;

  if (rawPoints.length < 2) {
    return {
      submitted: false,
      reason: 'no_points',
      error:
        rawPoints.length === 1
          ? 'Only one GPS point captured. Keep recording a bit longer and ensure location is ON.'
          : lastError || undefined,
    };
  }

  const { profile, calibration } = resolveScoringCalibration(options?.vehicleType);
  const { points, droppedNoisyPoints, inferredSpeedCount } = preprocessPointsForScoring(
    rawPoints,
    calibration,
  );

  if (points.length < 2) {
    return {
      submitted: false,
      reason: 'no_points',
      error: 'GPS data quality was too low for trip scoring. Please try again with better signal.',
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const startedAtMs = options?.forcedStartedAtMs ?? first.timestampMs;
  const endedAtMs = options?.forcedEndedAtMs ?? last.timestampMs;
  const durationMs = Math.max(0, endedAtMs - startedAtMs);
  const distanceKm = computeDistanceKm(points);

  if (durationMs < MIN_TRIP_DURATION_MS && distanceKm < MIN_TRIP_DISTANCE_KM) {
    return { submitted: false, reason: 'too_short' };
  }

  const durationMin = durationMs / 60000;
  const maxSpeed = computeMaxSpeedKmh(points);
  const avgSpeed =
    durationMin > 0 ? Number((distanceKm / (durationMin / 60)).toFixed(1)) : null;
  const confidence = computeDataConfidence(
    points,
    durationMs,
    inferredSpeedCount,
    droppedNoisyPoints,
  );

  const {
    events,
    harshBrakingCount,
    hardAccelCount,
    speedingCount,
    harshBrakingScore,
    hardAccelScore,
    speedingScore,
  } = buildEvents(points, calibration);

  const exposureNormalization = clamp(distanceKm / 8, 0.65, 1.25);
  const confidenceMultiplier = 0.72 + confidence * 0.28;
  const weightedPenaltyRaw =
    harshBrakingScore * 5.2 +
    hardAccelScore * 4.4 +
    speedingScore * 3.1;
  const weightedPenalty = (weightedPenaltyRaw / exposureNormalization) * confidenceMultiplier;
  const safetyScore = Math.round(clamp(100 - weightedPenalty * 3.2, 42, 100));

  const tripId = `INHOUSE_APP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const payload = {
    vehicleId,
    tripId,
    startTime: new Date(startedAtMs).toISOString(),
    endTime: new Date(endedAtMs).toISOString(),
    distanceKm: Number(distanceKm.toFixed(3)),
    durationMin: Number(durationMin.toFixed(2)),
    safetyScore,
    maxSpeed: maxSpeed != null ? Number(maxSpeed.toFixed(1)) : null,
    avgSpeed,
    startLocation: formatLocation(first),
    endLocation: formatLocation(last),
    statistics: {
      Mileage: Number(distanceKm.toFixed(3)),
      DurationMinutes: Number(durationMin.toFixed(2)),
      MaxSpeed: maxSpeed != null ? Number(maxSpeed.toFixed(1)) : null,
      AverageSpeed: avgSpeed,
      BrakingsCount: harshBrakingCount,
      AccelerationsCount: hardAccelCount,
      SpeedingCount: speedingCount,
      DataConfidence: Number(confidence.toFixed(2)),
      VehicleProfile: profile,
      RawPointCount: rawPoints.length,
      ProcessedPointCount: points.length,
      DroppedNoisyPoints: droppedNoisyPoints,
      InferredSpeedCount: inferredSpeedCount,
      Calibration: {
        harshBrakeDecelMs2: calibration.harshBrakeDecelMs2,
        hardAccelMs2: calibration.hardAccelMs2,
        speedingThresholdKmh: calibration.speedingThresholdKmh,
      },
      WeightedPenalty: Number(weightedPenalty.toFixed(2)),
    },
    scores: {
      Safety: safetyScore,
      Confidence: Number(confidence.toFixed(2)),
    },
    events,
  };

  if (!getNetworkOnlineState()) {
    const queueSize = await queueInHouseTripUpload(payload);
    return {
      submitted: true,
      tripId,
      distanceKm: payload.distanceKm,
      durationMin: payload.durationMin,
      safetyScore,
      points: points.length,
      events: events.length,
      queuedOffline: true,
      queueSize,
    };
  }

  try {
    await telematicsApi.submitInHouseTrip(payload);
    return {
      submitted: true,
      tripId,
      distanceKm: payload.distanceKm,
      durationMin: payload.durationMin,
      safetyScore,
      points: points.length,
      events: events.length,
    };
  } catch (error: any) {
    if (isLikelyTransientUploadError(error)) {
      const queueSize = await queueInHouseTripUpload(payload);
      return {
        submitted: true,
        tripId,
        distanceKm: payload.distanceKm,
        durationMin: payload.durationMin,
        safetyScore,
        points: points.length,
        events: events.length,
        queuedOffline: true,
        queueSize,
      };
    }

    return {
      submitted: false,
      reason: 'upload_failed',
      error: error?.message || 'Upload failed',
    };
  }
}

export const inHouseTelematics = {
  isAvailable(): boolean {
    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      return true;
    }
    return Boolean(Geolocation?.watchPosition);
  },

  getStatus(): RecorderStatus {
    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      return nativeStatusCache;
    }
    return {
      isRunning: state.isRunning,
      startedAtMs: state.startedAtMs,
      pointsCaptured: state.points.length,
      mode: state.isRunning ? 'tracking' : 'idle',
      hasPendingCompletedTrip: false,
    };
  },

  async refreshStatusFromNative(): Promise<RecorderStatus> {
    if (!(Platform.OS === 'android' && inHouseTelematicsNative.isAvailable())) {
      return this.getStatus();
    }

    const raw = await inHouseTelematicsNative.getServiceStatus();
    nativeStatusCache = recorderStatusFromNative(raw);
    return nativeStatusCache;
  },

  async isLocationEnabled(): Promise<boolean> {
    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      try {
        return await inHouseTelematicsNative.isLocationEnabled();
      } catch {
        return true;
      }
    }

    return true;
  },

  async syncNativeConfiguration(config: {
    provider: 'damoov' | 'inhouse';
    autoModeEnabled: boolean;
    linked: boolean;
    vehicleId?: string | null;
    vehicleType?: string | null;
  }): Promise<void> {
    if (!(Platform.OS === 'android' && inHouseTelematicsNative.isAvailable())) {
      return;
    }
    await inHouseTelematicsNative.syncConfiguration(config);
    await this.refreshStatusFromNative();
  },

  async getPointsSnapshot(): Promise<LocationPoint[]> {
    const nativePoints =
      Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()
        ? (await inHouseTelematicsNative.getRecordedPoints())
            .map(pointFromNative)
            .filter((point): point is LocationPoint => point != null)
        : [];

    return mergeAndSortPoints([...state.points, ...nativePoints]);
  },

  async start(): Promise<{ started: boolean; reason?: string }> {
    if (!this.isAvailable()) {
      return { started: false, reason: 'Geolocation module is not available.' };
    }

    if (this.getStatus().isRunning) {
      return { started: true };
    }

    resetState();
    state.startedAtMs = Date.now();
    state.isRunning = true;
    state.lastError = null;

    try {
      if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
        await inHouseTelematicsNative.startForegroundTracking();
        await this.refreshStatusFromNative();
        return { started: true };
      }

      // Seed the recorder with an immediate point so short trips do not end with 0 points.
      await captureCurrentPoint(10000);

      state.watchId = Geolocation.watchPosition(
        (position: any) => {
          pushPoint(position);
        },
        (error: any) => {
          state.lastError = error?.message || 'watchPosition failed';
          console.log('inHouseTelematics watchPosition error', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5,
          interval: 6000,
          fastestInterval: 3000,
          maximumAge: 1000,
          timeout: 20000,
        },
      );
      return { started: true };
    } catch (error: any) {
      cleanupWatcher();
      resetState();
      return {
        started: false,
        reason: error?.message || 'Unable to start location tracking.',
      };
    }
  },

  async maybeStartAutoByMovementProbe(): Promise<{ started: boolean }> {
    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      const status = await this.refreshStatusFromNative();
      return { started: status.isRunning };
    }

    if (state.isRunning) return { started: true };
    if (!this.isAvailable()) return { started: false };

    const current = await captureCurrentPointData(6000);
    if (!current) return { started: false };

    const prev = state.lastAutoProbePoint;
    state.lastAutoProbePoint = current;

    const speed = current.speedKmh ?? 0;
    let movementDetected = speed >= AUTO_MOVING_SPEED_THRESHOLD_KMH;

    if (prev) {
      const movedMeters = haversineMeters(
        prev.latitude,
        prev.longitude,
        current.latitude,
        current.longitude,
      );
      const elapsedMs = Math.max(1, current.timestampMs - prev.timestampMs);
      const approxSpeedKmh = (movedMeters / (elapsedMs / 1000)) * 3.6;
      if (movedMeters >= 35 && approxSpeedKmh >= AUTO_MOVING_SPEED_THRESHOLD_KMH) {
        movementDetected = true;
      }
    }

    if (!movementDetected) {
      state.autoMovementProbeHits = 0;
      state.lastMovementProbeAtMs = null;
      return { started: false };
    }

    const nowMs = current.timestampMs;
    if (
      state.lastMovementProbeAtMs != null &&
      nowMs - state.lastMovementProbeAtMs <= AUTO_START_PROBE_WINDOW_MS
    ) {
      state.autoMovementProbeHits += 1;
    } else {
      state.autoMovementProbeHits = 1;
    }
    state.lastMovementProbeAtMs = nowMs;

    if (state.autoMovementProbeHits >= AUTO_START_PROBE_HITS_REQUIRED) {
      state.autoMovementProbeHits = 0;
      state.lastMovementProbeAtMs = null;
      const started = await this.start();
      return { started: started.started };
    }

    return { started: false };
  },

  stopAndDiscard(): void {
    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      inHouseTelematicsNative
        .stopForegroundTracking()
        .then(() => this.refreshStatusFromNative())
        .catch((error: any) => {
          state.lastError = error?.message || 'Failed to stop native tracking service.';
        });
    }
    cleanupWatcher();
    resetState();
  },

  async stopAndUpload(
    vehicleId: string,
    options?: { vehicleType?: string | null },
  ): Promise<StopResult> {
    if (!this.getStatus().isRunning) {
      return { submitted: false, reason: 'not_running' };
    }

    let nativePoints: LocationPoint[] = [];
    let nativeTripMeta: NativeCompletedTrip | null = null;

    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      try {
        nativeTripMeta = await inHouseTelematicsNative.stopForegroundTracking();
        nativePoints = pointsFromCompletedNativeTrip(nativeTripMeta);
        await this.refreshStatusFromNative();
      } catch (error: any) {
        state.lastError = error?.message || 'Failed to read native tracking points.';
      }
    }

    cleanupWatcher();
    state.isRunning = false;

    if (!(Platform.OS === 'android' && inHouseTelematicsNative.isAvailable())) {
      // Capture one final sample at stop time (best effort) for JS watcher path.
      await captureCurrentPoint(5000);
    }

    const rawPoints = [...state.points, ...nativePoints];
    const startedAtMs =
      typeof nativeTripMeta?.startedAtMs === 'number' ? nativeTripMeta.startedAtMs : state.startedAtMs;
    const endedAtMs =
      typeof nativeTripMeta?.endedAtMs === 'number' ? nativeTripMeta.endedAtMs : null;
    const lastError = state.lastError;
    resetState();

    if (!startedAtMs || rawPoints.length < 2) {
      return {
        submitted: false,
        reason: 'no_points',
        error:
          rawPoints.length === 1
            ? 'Only one GPS point captured. Keep recording a bit longer and ensure location is ON.'
            : lastError || undefined,
      };
    }

    return buildAndSubmitTripFromPoints(rawPoints, vehicleId, {
      vehicleType: options?.vehicleType ?? nativeTripMeta?.vehicleType ?? null,
      forcedStartedAtMs: startedAtMs,
      forcedEndedAtMs: endedAtMs,
      lastError,
    });
  },

  async consumeCompletedNativeTripAndUpload(
    fallbackVehicleId: string,
    options?: { vehicleType?: string | null },
  ): Promise<StopResult | null> {
    if (!(Platform.OS === 'android' && inHouseTelematicsNative.isAvailable())) {
      return null;
    }

    const nativeTrip = await inHouseTelematicsNative.consumeCompletedTrip();
    await this.refreshStatusFromNative();

    if (!nativeTrip) return null;

    const rawPoints = pointsFromCompletedNativeTrip(nativeTrip);
    const vehicleId =
      typeof nativeTrip.vehicleId === 'string' && nativeTrip.vehicleId.length > 0
        ? nativeTrip.vehicleId
        : fallbackVehicleId;

    return buildAndSubmitTripFromPoints(rawPoints, vehicleId, {
      vehicleType: options?.vehicleType ?? nativeTrip.vehicleType ?? null,
      forcedStartedAtMs:
        typeof nativeTrip.startedAtMs === 'number' ? nativeTrip.startedAtMs : null,
      forcedEndedAtMs:
        typeof nativeTrip.endedAtMs === 'number' ? nativeTrip.endedAtMs : null,
      lastError: state.lastError,
    });
  },

  async autoProcess(
    vehicleId: string,
    options?: { vehicleType?: string | null },
  ): Promise<AutoProcessResult> {
    if (Platform.OS === 'android' && inHouseTelematicsNative.isAvailable()) {
      const status = await this.refreshStatusFromNative();
      if (!status.hasPendingCompletedTrip) {
        return { action: 'none' };
      }

      const result = await this.consumeCompletedNativeTripAndUpload(vehicleId, options);
      if (!result) {
        return { action: 'none' };
      }
      if (result.submitted) {
        return { action: 'trip_saved', result };
      }
      return { action: 'trip_not_saved', result };
    }

    if (!state.isRunning || !state.startedAtMs) {
      return { action: 'none' };
    }

    const points = await this.getPointsSnapshot();
    if (points.length < 2) {
      return { action: 'none' };
    }

    const nowMs = Date.now();
    const activeMs = nowMs - state.startedAtMs;
    if (activeMs < AUTO_MIN_ACTIVE_BEFORE_STOP_MS) {
      return { action: 'none' };
    }

    const lastMovingMs = findLastMovingTimestamp(points);
    if (!lastMovingMs) {
      return { action: 'none' };
    }

    const idleMs = nowMs - lastMovingMs;
    if (idleMs < AUTO_IDLE_STOP_MS) {
      return { action: 'none' };
    }

    const result = await this.stopAndUpload(vehicleId, options);
    if (result.submitted) {
      return { action: 'trip_saved', result };
    }
    return { action: 'trip_not_saved', result };
  },
};

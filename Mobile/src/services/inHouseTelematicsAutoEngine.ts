import { AppState } from 'react-native';
import { inHouseTelematics } from './inHouseTelematics';
import { vehicleService, type Vehicle } from './vehicleService';
import {
  getAccessToken,
  getTelematicsAutoModeEnabled,
  getTelematicsLinked,
  getTelematicsProvider,
  setTelematicsLinked,
} from './storage';

const ENGINE_TICK_MS = 20_000;
const VEHICLE_CACHE_TTL_MS = 2 * 60 * 1000;

type InHouseTelematicsAutoEngineEvent = {
  type: 'trip_saved';
  vehicleId: string;
  tripId: string;
  queuedOffline?: boolean;
};

let engineInitialized = false;
let engineInterval: ReturnType<typeof setInterval> | null = null;
let engineTickInFlight = false;
let cachedPrimaryVehicle: Vehicle | null = null;
let cachedPrimaryVehicleAtMs = 0;
const listeners = new Set<(event: InHouseTelematicsAutoEngineEvent) => void>();

function emitEvent(event: InHouseTelematicsAutoEngineEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // keep other listeners alive
    }
  }
}

function shouldRunEngine(): boolean {
  if (!getAccessToken()) return false;
  if (getTelematicsProvider() !== 'inhouse') return false;
  if (!getTelematicsAutoModeEnabled()) return false;
  return true;
}

async function resolvePrimaryVehicle(forceRefresh = false): Promise<Vehicle | null> {
  const nowMs = Date.now();
  if (
    !forceRefresh &&
    cachedPrimaryVehicle &&
    nowMs - cachedPrimaryVehicleAtMs < VEHICLE_CACHE_TTL_MS
  ) {
    return cachedPrimaryVehicle;
  }

  const vehicles = await vehicleService.getVehicles();
  const primaryVehicle = vehicles.find(vehicle => vehicle.isPrimary) || vehicles[0] || null;
  cachedPrimaryVehicle = primaryVehicle;
  cachedPrimaryVehicleAtMs = nowMs;
  return primaryVehicle;
}

async function runEngineTick(forceRefreshVehicle = false): Promise<void> {
  if (engineTickInFlight) return;

  engineTickInFlight = true;
  try {
    const hasAuth = Boolean(getAccessToken());
    let primaryVehicle: Vehicle | null = null;
    let linked = false;

    if (hasAuth) {
      try {
        primaryVehicle = await resolvePrimaryVehicle(forceRefreshVehicle);
        if (primaryVehicle?.id) {
          const storedLinked = getTelematicsLinked(primaryVehicle.id);
          const backendLinked = Boolean(primaryVehicle.telematicsDevice?.isActive);
          if (backendLinked && !storedLinked) {
            setTelematicsLinked(primaryVehicle.id, true);
          }
          linked = storedLinked || backendLinked;
        }
      } catch {
        primaryVehicle = cachedPrimaryVehicle;
        if (primaryVehicle?.id) {
          linked = getTelematicsLinked(primaryVehicle.id);
        }
      }
    }

    await inHouseTelematics.syncNativeConfiguration({
      provider: getTelematicsProvider(),
      autoModeEnabled: getTelematicsAutoModeEnabled(),
      linked,
      vehicleId: primaryVehicle?.id ?? null,
      vehicleType: primaryVehicle?.vehicleType ?? null,
    });

    if (!shouldRunEngine()) return;
    if (!inHouseTelematics.isAvailable()) return;
    if (!primaryVehicle?.id || !linked) return;

    const status = await inHouseTelematics.refreshStatusFromNative();
    if (status.mode === 'idle' && !status.hasPendingCompletedTrip) {
      await inHouseTelematics.maybeStartAutoByMovementProbe();
    }

    const outcome = await inHouseTelematics.autoProcess(primaryVehicle.id, {
      vehicleType: primaryVehicle.vehicleType,
    });

    if (outcome.action === 'trip_saved') {
      cachedPrimaryVehicleAtMs = 0;
      emitEvent({
        type: 'trip_saved',
        vehicleId: primaryVehicle.id,
        tripId: outcome.result.tripId,
        queuedOffline: outcome.result.queuedOffline,
      });
    }
  } catch {
    // best-effort background engine
  } finally {
    engineTickInFlight = false;
  }
}

export function triggerInHouseTelematicsAutoEngineTick(
  forceRefreshVehicle = false,
): void {
  runEngineTick(forceRefreshVehicle).catch(() => {});
}

export function subscribeInHouseTelematicsAutoEngine(
  listener: (event: InHouseTelematicsAutoEngineEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initializeInHouseTelematicsAutoEngine(): void {
  if (engineInitialized) return;
  engineInitialized = true;

  engineInterval = setInterval(() => {
    runEngineTick(false).catch(() => {});
  }, ENGINE_TICK_MS);

  AppState.addEventListener('change', nextState => {
    if (nextState === 'active') {
      runEngineTick(true).catch(() => {});
    }
  });

  runEngineTick(true).catch(() => {});
}

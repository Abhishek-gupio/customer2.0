import { NativeModules, Platform } from 'react-native';

type NativeTelemetryPoint = {
  latitude: number;
  longitude: number;
  timestampMs: number;
  speedKmh?: number | null;
  accuracy?: number | null;
};

type NativeCompletedTrip = {
  vehicleId?: string | null;
  vehicleType?: string | null;
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  points?: NativeTelemetryPoint[] | null;
};

type NativeServiceStatus = {
  mode?: 'idle' | 'monitoring' | 'tracking' | string;
  startedAtMs?: number | null;
  pointsCaptured?: number | null;
  hasPendingCompletedTrip?: boolean | null;
  vehicleId?: string | null;
  vehicleType?: string | null;
};

const InHouseTelemetry = NativeModules.InHouseTelemetry as {
  isAvailable: () => Promise<boolean>;
  isLocationEnabled: () => Promise<boolean>;
  startForegroundTracking: () => Promise<void>;
  stopForegroundTracking: () => Promise<NativeCompletedTrip | null>;
  getRecordedPoints: () => Promise<NativeTelemetryPoint[]>;
  clearRecordedPoints: () => Promise<void>;
  syncConfiguration: (config: {
    provider: 'damoov' | 'inhouse';
    autoModeEnabled: boolean;
    linked: boolean;
    vehicleId?: string | null;
    vehicleType?: string | null;
  }) => Promise<void>;
  getServiceStatus: () => Promise<NativeServiceStatus | null>;
  consumeCompletedTrip: () => Promise<NativeCompletedTrip | null>;
} | null;

const isModuleAvailable = Platform.OS === 'android' && InHouseTelemetry != null;

export const inHouseTelematicsNative = {
  isAvailable: (): boolean => isModuleAvailable,

  async isLocationEnabled(): Promise<boolean> {
    if (!InHouseTelemetry) return true;
    return Boolean(await InHouseTelemetry.isLocationEnabled());
  },

  async startForegroundTracking(): Promise<void> {
    if (!InHouseTelemetry) return;
    await InHouseTelemetry.startForegroundTracking();
  },

  async stopForegroundTracking(): Promise<NativeCompletedTrip | null> {
    if (!InHouseTelemetry) return null;
    const trip = await InHouseTelemetry.stopForegroundTracking();
    return trip && typeof trip === 'object' ? trip : null;
  },

  async getRecordedPoints(): Promise<NativeTelemetryPoint[]> {
    if (!InHouseTelemetry) return [];
    const points = await InHouseTelemetry.getRecordedPoints();
    return Array.isArray(points) ? points : [];
  },

  async clearRecordedPoints(): Promise<void> {
    if (!InHouseTelemetry) return;
    await InHouseTelemetry.clearRecordedPoints();
  },

  async syncConfiguration(config: {
    provider: 'damoov' | 'inhouse';
    autoModeEnabled: boolean;
    linked: boolean;
    vehicleId?: string | null;
    vehicleType?: string | null;
  }): Promise<void> {
    if (!InHouseTelemetry) return;
    await InHouseTelemetry.syncConfiguration(config);
  },

  async getServiceStatus(): Promise<NativeServiceStatus | null> {
    if (!InHouseTelemetry) return null;
    const status = await InHouseTelemetry.getServiceStatus();
    return status && typeof status === 'object' ? status : null;
  },

  async consumeCompletedTrip(): Promise<NativeCompletedTrip | null> {
    if (!InHouseTelemetry) return null;
    const trip = await InHouseTelemetry.consumeCompletedTrip();
    return trip && typeof trip === 'object' ? trip : null;
  },
};

export type { NativeCompletedTrip, NativeServiceStatus, NativeTelemetryPoint };

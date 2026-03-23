/**
 * Bridge to Damoov Telematics SDK (Android native module).
 * On iOS or when module is unavailable, methods no-op and resolve.
 */
import { NativeModules, Platform } from 'react-native';

const DamoovTelematics = NativeModules.DamoovTelematics as {
  setDeviceId: (deviceToken: string) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
  arePermissionsGranted: () => Promise<boolean>;
} | null;

const isAvailable = Platform.OS === 'android' && DamoovTelematics != null;

export const damoovTelematics = {
  isAvailable: () => isAvailable,

  setDeviceId: (deviceToken: string): Promise<void> => {
    if (!DamoovTelematics) return Promise.resolve();
    return DamoovTelematics.setDeviceId(deviceToken);
  },

  setEnabled: (enabled: boolean): Promise<void> => {
    if (!DamoovTelematics) return Promise.resolve();
    return DamoovTelematics.setEnabled(enabled);
  },

  logout: (): Promise<void> => {
    if (!DamoovTelematics) return Promise.resolve();
    return DamoovTelematics.logout();
  },

  arePermissionsGranted: (): Promise<boolean> => {
    if (!DamoovTelematics) return Promise.resolve(false);
    return DamoovTelematics.arePermissionsGranted();
  },
};

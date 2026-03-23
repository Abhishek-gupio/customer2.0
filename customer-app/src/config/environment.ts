// src/config/environment.ts
// Environment configuration for the Customer app (mirrors Valet app approach)

import { Platform, NativeModules } from 'react-native';

export type Environment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  name: Environment;
  apiBaseUrl: string;
  appName: string;
  version: string;
  buildNumber: string;
  enableLogging: boolean;
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  timeout: number;
  carImageUrl?: string; // Cloudinary URL for car image in production
}

const DEV_PORT = 8000; // Updated to match backend API port

const isAndroid = Platform.OS === 'android';

const isProbablyEmulator = (() => {
  try {
    const { PlatformConstants } = NativeModules as any;
    const model = PlatformConstants?.Model || PlatformConstants?.Device || '';
    const name = (model || '').toString().toLowerCase();
    return name.includes('sdk') || name.includes('emulator') || name.includes('simulator');
  } catch {
    return false;
  }
})();

const LOCALHOST = 'localhost';
const AVD_HOST = '10.0.2.2';
// For Genymotion use 10.0.3.2 if needed

// If testing on a physical Android device without `adb reverse`,
// put your dev machine's LAN IP here (e.g. '192.168.1.123').
// Leave empty ('') to fall back to localhost (use `adb reverse tcp:3000 tcp:3000`).
const LAN_IP: string = '';

const DEV_HOST = isAndroid
  ? (isProbablyEmulator ? AVD_HOST : (LAN_IP && LAN_IP.length > 0 ? LAN_IP : LOCALHOST))
  : LOCALHOST;

const development: EnvironmentConfig = {
  name: 'development',
  apiBaseUrl: `http://${DEV_HOST}:${DEV_PORT}/api/v1/customer`, // Updated endpoint path
  appName: 'Customer (Dev)',
  version: '1.0.0',
  buildNumber: '1',
  enableLogging: true,
  enableAnalytics: false,
  enableCrashReporting: false,
  timeout: 60000,
};

const staging: EnvironmentConfig = {
  name: 'staging',
  apiBaseUrl: 'https://staging-api.valet.com/api/customer',
  appName: 'Customer (Staging)',
  version: '1.0.0',
  buildNumber: '1',
  enableLogging: true,
  enableAnalytics: true,
  enableCrashReporting: false,
  timeout: 15000,
};

const production: EnvironmentConfig = {
  name: 'production',
  // apiBaseUrl: 'https://api8001.gupio.tech/api/v1/customer',
  apiBaseUrl: 'https://valetapi.gupio.tech/api/v1/customer',
  // apiBaseUrl: 'http://13.204.143.247:8000/api/v1/customer',
  appName: 'Customer',
  version: '1.0.0',
  buildNumber: '1',
  enableLogging: false,
  enableAnalytics: true,
  enableCrashReporting: true,
  timeout: 20000,
  // Cloudinary URL for car image in production
  // Default fallback URL (same as ValetMapView uses)
  // To use a custom URL:
  // 1. Upload mapping_car.png to Cloudinary
  // 2. Copy the secure URL (should look like: https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v1234567890/mapping_car.png)
  // 3. Replace the URL below
  // 4. Make sure the image is publicly accessible
  carImageUrl: 'https://res.cloudinary.com/dveyxa6i5/image/upload/v1764738772/mapping_car_vxavjt.png', // Default Cloudinary URL (can be overridden)
};

const getCurrentEnvironment = (): Environment => {
  // Force production mode - change to 'development' if needed for local testing
  // return 'production';
  // Uncomment below to use development mode when running with Metro bundler
  if (__DEV__) return 'production';
  return 'production';
};

export const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = getCurrentEnvironment();
  switch (env) {
    case 'development':
      return development;
    case 'staging':
      return staging;
    case 'production':
      return production;
    default:
      return development;
  }
};

export const config = getEnvironmentConfig();

// Debug logging to verify environment
console.log('🔧 [ENV] Customer App Environment:', config.name);
console.log('🔧 [ENV] API Base URL:', config.apiBaseUrl);
console.log('🔧 [ENV] App Name:', config.appName);

export const isDevelopment = (): boolean => config.name === 'development';
export const isStaging = (): boolean => config.name === 'staging';
export const isProduction = (): boolean => config.name === 'production';

export default config;



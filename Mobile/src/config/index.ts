import { Platform } from 'react-native';

// Backend port must match Backend/.env PORT (e.g. 9000)
const DEV_PORT = 9000;
// Android emulator: 10.0.2.2 (localhost = emulator itself)
// iOS simulator / adb reverse: localhost
const DEV_HOST =
  Platform.OS === 'android'
    ? `http://localhost:${DEV_PORT}`
    : `http://192.168.68.113:${DEV_PORT}`;

export const API_BASE_URL =
  (typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_HOST : 'https://your-api.com') as string;

export const AUTH_PATH = '/api/v1/auth';

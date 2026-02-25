import { Platform } from 'react-native';

const DEV_PORT = 9000;

const DEV_HOST =
  Platform.OS === 'android'
    ? `http://localhost:${DEV_PORT}` // works with adb reverse
    : `http://localhost:${DEV_PORT}`;

export const API_BASE_URL =
  __DEV__ ? DEV_HOST : 'https://your-api.com';

export const AUTH_PATH = '/api/v1/auth';
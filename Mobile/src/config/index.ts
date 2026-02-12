import { Platform } from 'react-native';

// Backend runs on port 9000. For physical device, set to your machine IP (e.g. http://192.168.1.5:9000)
const DEV_HOST =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:9000' // Android emulator → host machine
    : 'http://localhost:9000'; // iOS simulator

export const API_BASE_URL =
  (typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_HOST : 'https://your-api.com') as string;

export const AUTH_PATH = '/api/v1/auth';

import { Platform } from 'react-native';

// ─── API ─────────────────────────────────────────────────────────────────
const DEV_PORT = 9000;
const DEV_HOST =
  Platform.OS === 'android'
    ? `http://localhost:${DEV_PORT}`
    : `http://localhost:${DEV_PORT}`;

/** Production API base URL – change this or replace with env (e.g. react-native-config) when building for prod */
const PRODUCTION_API_BASE_URL = 'https://your-api.com';

export const API_BASE_URL = __DEV__ ? DEV_HOST : PRODUCTION_API_BASE_URL;
export const AUTH_PATH = '/api/v1/auth';

// Socket/realtime (e.g. notifications) – single place to change
const SOCKET_PORT = 3000;
const DEV_SOCKET_HOST = `http://localhost:${SOCKET_PORT}`;
const PRODUCTION_SOCKET_BASE_URL = 'https://your-api.com';
export const SOCKET_BASE_URL = __DEV__ ? DEV_SOCKET_HOST : PRODUCTION_SOCKET_BASE_URL;

/** Google Sign-In: OAuth 2.0 Web client ID (for ID token). Same as backend GOOGLE_CLIENT_ID. */
export const GOOGLE_WEB_CLIENT_ID = '789540291597-vlbm38kh3a2ruk1egkajgfq9untkjqp0.apps.googleusercontent.com';

// ─── Location / Geo (reverse geocode + IP fallback) – all URLs and user agent from config ───
export const GEO = {
  userAgent: 'CustomerApp/1.0',
  reverseGeocodeBase: 'https://nominatim.openstreetmap.org',
  ipProviders: [
    'https://ipapi.co/json/',
    'https://ipinfo.io/json',
    'https://get.geojs.io/v1/ip/geo.json',
  ] as readonly string[],
};
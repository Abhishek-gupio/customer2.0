import { Platform } from 'react-native';

// ─── API ─────────────────────────────────────────────────────────────────
/** Set to true to use production API even when running in dev (Metro). Use for testing prod. */
const FORCE_USE_PRODUCTION_API = false;
/** Set to true when testing on a real phone connected to the same Wi-Fi as your backend machine. */
const USE_LAN_FOR_DEV = false;

const DEV_PORT = 9000;
const LOCAL_LAN_HOST = `http://192.168.1.100:${DEV_PORT}`; // Replace with your computer's IP when testing on a real phone.
const DEV_HOST =
  Platform.OS === 'android'
    ? `http://10.0.2.2:${DEV_PORT}`
    : `http://localhost:${DEV_PORT}`;
const DEV_HOST_FOR_DEVICE = LOCAL_LAN_HOST;


/** Production API base URL – no trailing slash. Used in release builds (or when FORCE_USE_PRODUCTION_API is true). */
const PRODUCTION_API_BASE_URL = 'https://customerapi.gupio.tech';

const _base = (__DEV__ && !FORCE_USE_PRODUCTION_API)
  ? (USE_LAN_FOR_DEV ? DEV_HOST_FOR_DEVICE : DEV_HOST)
  : PRODUCTION_API_BASE_URL;
/** Base URL for API (no trailing slash). In dev uses local host; in release or when forced, uses production. */
export const API_BASE_URL = _base.replace(/\/$/, '');

export const AUTH_PATH = '/api/v1/auth';

// Socket/realtime (e.g. notifications)
const SOCKET_PORT = 9000;
const DEV_SOCKET_HOST =
  Platform.OS === 'android'
    ? `http://10.0.2.2:${SOCKET_PORT}`
    : `http://localhost:${SOCKET_PORT}`;
const PRODUCTION_SOCKET_BASE_URL = 'https://customerapi.gupio.tech';
export const SOCKET_BASE_URL = (__DEV__ && !FORCE_USE_PRODUCTION_API)
  ? (USE_LAN_FOR_DEV ? LOCAL_LAN_HOST.replace(`:${DEV_PORT}`, `:${SOCKET_PORT}`) : DEV_SOCKET_HOST)
  : PRODUCTION_SOCKET_BASE_URL;

/** Build absolute URL for a path (e.g. /uploads/foo or uploads/foo). Use for profile pics, documents, receipts. */
export function getAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
}

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

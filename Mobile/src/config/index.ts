import { Platform } from 'react-native';

// ─── API ─────────────────────────────────────────────────────────────────
/** Set to true to use production API even when running in dev (Metro). Use for testing prod. */
const FORCE_USE_PRODUCTION_API = false;

const DEV_PORT = 9000;
// 10.0.2.2 only resolves on the Android *emulator* (its NAT alias for the host).
// A physical device has no such alias, so it must hit its own localhost via
// `adb reverse tcp:9000 tcp:9000`, which tunnels that back to this machine over USB.
const ANDROID_LOCALHOST = 'http://localhost';
const IOS_LOCALHOST = 'http://localhost';
const DEV_HOST = `${Platform.OS === 'android' ? ANDROID_LOCALHOST : IOS_LOCALHOST}:${DEV_PORT}`;


/** Production API base URL – no trailing slash. Used in release builds (or when FORCE_USE_PRODUCTION_API is true). */
const PRODUCTION_API_BASE_URL = 'https://customerapi.gupio.tech';

const _base = (__DEV__ && !FORCE_USE_PRODUCTION_API) ? DEV_HOST : PRODUCTION_API_BASE_URL;
/** Base URL for API (no trailing slash). In dev uses local host; in release or when forced, uses production. */
export const API_BASE_URL = _base.replace(/\/$/, '');

export const AUTH_PATH = '/api/v1/auth';

// Socket/realtime (e.g. notifications)
const SOCKET_PORT = 9000;
const DEV_SOCKET_HOST = `http://localhost:${SOCKET_PORT}`;
const PRODUCTION_SOCKET_BASE_URL = 'https://customerapi.gupio.tech';
export const SOCKET_BASE_URL = (__DEV__ && !FORCE_USE_PRODUCTION_API) ? DEV_SOCKET_HOST : PRODUCTION_SOCKET_BASE_URL;

/** Build absolute URL for a path (e.g. /uploads/foo or uploads/foo). Use for profile pics, documents, receipts. */
export function getAbsoluteUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
}

/**
 * The URL encoded in a vehicle's printed QR sticker. Not under /api — Backend's
 * app.ts serves the no-app-required web fallback page directly at GET /v/:token,
 * whose own JS then calls the JSON API under /api/v1/public/vehicle-qr/*.
 */
export function getVehicleQrUrl(token: string): string {
  return `${API_BASE_URL}/v/${token}`;
}

/** Google Sign-In: OAuth 2.0 Web client ID (for ID token). Same as backend GOOGLE_CLIENT_ID. */
export const GOOGLE_WEB_CLIENT_ID = '1024404965563-segb2pqhssinho0a4m74nq4d9e0tg569.apps.googleusercontent.com';

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
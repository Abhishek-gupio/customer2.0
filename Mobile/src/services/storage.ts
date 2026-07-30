const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_ID_KEY = 'auth_user_id';
const AUTH_PERSISTED_AT_KEY = 'auth_persisted_at_ms';
const VOICE_LANGUAGE_INDEX_KEY = 'voice_language_index';
const TELEMATICS_PROVIDER_KEY = 'telematics_provider';
const TELEMATICS_AUTO_MODE_KEY = 'telematics_auto_mode_enabled';
const AUTO_EXPENSE_ENABLED_KEY = 'auto_expense_enabled';
const THEME_MODE_KEY = 'theme_mode';
const PRIMARY_VEHICLE_ID_KEY = 'primary_vehicle_id';
const LAST_RECEIVED_OTP_KEY = 'last_received_otp';
const LAST_RECEIVED_OTP_AT_KEY = 'last_received_otp_at_ms';
const DIY_GUIDES_CACHE_KEY = 'diy_guides_cache';

const AUTH_KEYS = new Set([
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_ID_KEY,
  AUTH_PERSISTED_AT_KEY,
]);

const SHARED_PERSISTED_KEYS = new Set([
  ...AUTH_KEYS,
  AUTO_EXPENSE_ENABLED_KEY,
  PRIMARY_VEHICLE_ID_KEY,
  LAST_RECEIVED_OTP_KEY,
  LAST_RECEIVED_OTP_AT_KEY,
]);

/** Serialize auth AsyncStorage I/O (async-auth only) so login/refresh can await durability. */
let authAsyncDiskTail: Promise<void> = Promise.resolve();

function enqueueAuthAsyncDisk(op: () => Promise<void>): void {
  authAsyncDiskTail = authAsyncDiskTail.then(op).catch(() => {});
}

/** Await after writing auth keys when using AsyncStorage fallback (no-op for MMKV). */
export function awaitAuthStoragePersisted(): Promise<void> {
  if (storageBackend !== 'async-auth') return Promise.resolve();
  return authAsyncDiskTail;
}

type StorageImpl = {
  set: (k: string, v: string) => void;
  getString: (k: string) => string | undefined;
  remove?: (k: string) => void;
};

type AsyncStorageModule = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
  multiGet: (keys: readonly string[]) => Promise<Array<[string, string | null]>>;
};

let storage: StorageImpl;
let storageBackend: 'mmkv' | 'async-auth' | 'memory' = 'memory';
let mmkvLoadError: unknown = null;
let asyncStorageLoadError: unknown = null;

const persistedAsyncCache: Record<string, string> = {};
const miscMem: Record<string, string> = {};

function getAsyncStorage(): AsyncStorageModule | null {
  try {
    const mod = require('@react-native-async-storage/async-storage') as {
      default: AsyncStorageModule;
    };
    return mod.default;
  } catch (e) {
    asyncStorageLoadError = e;
    return null;
  }
}

try {
  const MMKV = (require('react-native-mmkv') as { MMKV: new () => StorageImpl }).MMKV;
  storage = new MMKV();
  storageBackend = 'mmkv';
} catch (e) {
  mmkvLoadError = e;
  const asyncStorage = getAsyncStorage();
  storageBackend = asyncStorage ? 'async-auth' : 'memory';
  storage = {
    set(k: string, v: string) {
      if (SHARED_PERSISTED_KEYS.has(k)) {
        if (v === '') {
          delete persistedAsyncCache[k];
          enqueueAuthAsyncDisk(() =>
            asyncStorage ? asyncStorage.removeItem(k).then(() => {}) : Promise.resolve(),
          );
        } else {
          persistedAsyncCache[k] = v;
          enqueueAuthAsyncDisk(() =>
            asyncStorage ? asyncStorage.setItem(k, v).then(() => {}) : Promise.resolve(),
          );
        }
      } else {
        miscMem[k] = v;
      }
    },
    getString(k: string) {
      if (SHARED_PERSISTED_KEYS.has(k)) return persistedAsyncCache[k];
      return miscMem[k];
    },
    remove(k: string) {
      if (SHARED_PERSISTED_KEYS.has(k)) {
        delete persistedAsyncCache[k];
        enqueueAuthAsyncDisk(() =>
          asyncStorage ? asyncStorage.removeItem(k).then(() => {}) : Promise.resolve(),
        );
      } else {
        delete miscMem[k];
      }
    },
  };
  if (__DEV__) {
    const mmkvMsg =
      mmkvLoadError instanceof Error
        ? `${mmkvLoadError.name}: ${mmkvLoadError.message}`
        : String(mmkvLoadError);
    const asyncMsg = asyncStorage
      ? 'AsyncStorage fallback active for auth persistence.'
      : asyncStorageLoadError instanceof Error
        ? `${asyncStorageLoadError.name}: ${asyncStorageLoadError.message}`
        : String(asyncStorageLoadError);
    console.warn(`[storage] MMKV unavailable. ${mmkvMsg}`);
    console.warn(
      asyncStorage
        ? `[storage] ${asyncMsg}`
        : `[storage] AsyncStorage unavailable; using in-memory storage only. ${asyncMsg}`,
    );
  }
}

if (__DEV__ && storageBackend === 'mmkv') {
  console.log('[storage] backend=mmkv');
}

export async function hydrateAuthFromPersistedStorage(): Promise<void> {
  if (storageBackend !== 'async-auth') return;
  try {
    const asyncStorage = getAsyncStorage();
    if (!asyncStorage) return;
    const keys = [...SHARED_PERSISTED_KEYS];
    const pairs = await asyncStorage.multiGet(keys);
    for (const [k, v] of pairs) {
      if (v != null && v !== '') persistedAsyncCache[k] = v;
    }
  } catch {
    // keep empty cache
  }
}

export function getStorageBackend(): 'mmkv' | 'async-auth' | 'memory' {
  return storageBackend;
}

export function getMmkvLoadError(): unknown {
  return mmkvLoadError;
}

const DEV_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtbHQ1emxuODAwMDBqMnV0am1haHhqMzQiLCJwaG9uZU51bWJlciI6Ijk5OTk5OTk5OTkiLCJpYXQiOjE3NzE0ODc3NDksImV4cCI6MTc3NDA3OTc0OX0.BwokEb4KaF-rmX2Vpz8zXaJ2WV197pJTKW6Ijj1sv0A';

const ENABLE_DEV_SEED = false;
if (__DEV__ && ENABLE_DEV_SEED && storageBackend === 'mmkv' && !storage.getString(ACCESS_TOKEN_KEY)) {
  storage.set(ACCESS_TOKEN_KEY, DEV_TOKEN);
  storage.set(USER_ID_KEY, 'cmlt5zln80000j2utjmahxj34');
  storage.set(AUTH_PERSISTED_AT_KEY, String(Date.now()));
  console.log('[DEV] Seeded dummy auth token (login via OTP for refresh token)');
}

export function setAccessToken(token: string) {
  storage.set(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | undefined {
  const token = storage.getString(ACCESS_TOKEN_KEY);
  if (__DEV__ && ENABLE_DEV_SEED && !token) {
    console.log('[DEV] No token in storage, falling back to dummy dev token');
    return DEV_TOKEN;
  }
  return token;
}

export function setRefreshToken(token: string) {
  storage.set(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | undefined {
  return storage.getString(REFRESH_TOKEN_KEY);
}

export function setUserId(id: string) {
  storage.set(USER_ID_KEY, id);
}

export function getUserId(): string | undefined {
  return storage.getString(USER_ID_KEY);
}

export function clearAuthStorage() {
  if (storage.remove) {
    storage.remove(ACCESS_TOKEN_KEY);
    storage.remove(REFRESH_TOKEN_KEY);
    storage.remove(USER_ID_KEY);
    storage.remove(AUTH_PERSISTED_AT_KEY);
  } else {
    storage.set(ACCESS_TOKEN_KEY, '');
    storage.set(REFRESH_TOKEN_KEY, '');
    storage.set(USER_ID_KEY, '');
    storage.set(AUTH_PERSISTED_AT_KEY, '');
  }
}

export function setAuthPersistedAt(msSinceEpoch: number): void {
  storage.set(AUTH_PERSISTED_AT_KEY, String(Math.floor(msSinceEpoch)));
}

export function getAuthPersistedAt(): number | undefined {
  const s = storage.getString(AUTH_PERSISTED_AT_KEY);
  if (s == null || s === '') return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getVoiceLanguageIndex(): number {
  const s = storage.getString(VOICE_LANGUAGE_INDEX_KEY);
  if (s == null) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function setVoiceLanguageIndex(index: number): void {
  storage.set(VOICE_LANGUAGE_INDEX_KEY, String(index));
}

export function setStorageValue(key: string, value: string): void {
  storage.set(key, value);
}

export function getStorageValue(key: string): string | undefined {
  return storage.getString(key);
}

export function removeStorageValue(key: string): void {
  if (storage.remove) {
    storage.remove(key);
    return;
  }
  storage.set(key, '');
}



export function getAutoExpenseEnabled(): boolean {
  const s = storage.getString(AUTO_EXPENSE_ENABLED_KEY);
  if (s == null || s === '') return true;
  return s === 'true';
}

export function setAutoExpenseEnabled(val: boolean): void {
  storage.set(AUTO_EXPENSE_ENABLED_KEY, val ? 'true' : 'false');
}

export function getThemeMode(): 'light' | 'dark' | null {
  const s = storage.getString(THEME_MODE_KEY);
  return s === 'light' || s === 'dark' ? s : null;
}

export function setThemeMode(mode: 'light' | 'dark'): void {
  storage.set(THEME_MODE_KEY, mode);
}

export function setPrimaryVehicleId(id: string | null | undefined): void {
  if (!id) {
    if (storage.remove) {
      storage.remove(PRIMARY_VEHICLE_ID_KEY);
    } else {
      storage.set(PRIMARY_VEHICLE_ID_KEY, '');
    }
    return;
  }
  storage.set(PRIMARY_VEHICLE_ID_KEY, id);
}

export function getPrimaryVehicleId(): string | null {
  const s = storage.getString(PRIMARY_VEHICLE_ID_KEY);
  return s && s.length > 0 ? s : null;
}

export function setLastReceivedOtp(otp: string, receivedAt = Date.now()): void {
  storage.set(LAST_RECEIVED_OTP_KEY, otp);
  storage.set(LAST_RECEIVED_OTP_AT_KEY, String(Math.floor(receivedAt)));
}

export function getDIYGuidesCache(): unknown {
  const s = storage.getString(DIY_GUIDES_CACHE_KEY);
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function setDIYGuidesCache(guides: unknown): void {
  storage.set(DIY_GUIDES_CACHE_KEY, JSON.stringify(guides));
}

export function getLastReceivedOtp():
  | { otp: string; receivedAt: number }
  | null {
  const otp = storage.getString(LAST_RECEIVED_OTP_KEY);
  const receivedAtRaw = storage.getString(LAST_RECEIVED_OTP_AT_KEY);
  if (!otp || !/^\d{4,8}$/.test(otp)) return null;
  const receivedAt = receivedAtRaw ? parseInt(receivedAtRaw, 10) : 0;
  return {
    otp,
    receivedAt: Number.isFinite(receivedAt) && receivedAt > 0 ? receivedAt : 0,
  };
}

export async function getLastReceivedOtpAsync():
  Promise<{ otp: string; receivedAt: number } | null> {
  if (storageBackend === 'async-auth') {
    try {
      const asyncStorage = getAsyncStorage();
      if (asyncStorage) {
        const [otp, receivedAtRaw] = await Promise.all([
          asyncStorage.getItem(LAST_RECEIVED_OTP_KEY),
          asyncStorage.getItem(LAST_RECEIVED_OTP_AT_KEY),
        ]);
        if (!otp || !/^\d{4,8}$/.test(otp)) return null;
        const receivedAt = receivedAtRaw ? parseInt(receivedAtRaw, 10) : 0;
        persistedAsyncCache[LAST_RECEIVED_OTP_KEY] = otp;
        if (receivedAtRaw) {
          persistedAsyncCache[LAST_RECEIVED_OTP_AT_KEY] = receivedAtRaw;
        }
        return {
          otp,
          receivedAt: Number.isFinite(receivedAt) && receivedAt > 0 ? receivedAt : 0,
        };
      }
    } catch {
      // fall back to in-memory/cache path below
    }
  }

  return getLastReceivedOtp();
}

export function clearLastReceivedOtp(): void {
  if (storage.remove) {
    storage.remove(LAST_RECEIVED_OTP_KEY);
    storage.remove(LAST_RECEIVED_OTP_AT_KEY);
  } else {
    storage.set(LAST_RECEIVED_OTP_KEY, '');
    storage.set(LAST_RECEIVED_OTP_AT_KEY, '');
  }
}

export function getTelematicsLinked(vehicleId: string | null | undefined): boolean {
  if (!vehicleId) return false;
  const s = storage.getString(`telematics_linked_${vehicleId}`);
  return s === 'true';
}

export function setTelematicsLinked(vehicleId: string | null | undefined, linked: boolean): void {
  if (!vehicleId) return;
  storage.set(`telematics_linked_${vehicleId}`, linked ? 'true' : 'false');
}

export function getLastOdometerUpdate(vehicleId: string): number | undefined {
  const s = storage.getString(`last_odometer_update_${vehicleId}`);
  if (s == null || s === '') return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function setLastOdometerUpdate(vehicleId: string, msSinceEpoch: number): void {
  storage.set(`last_odometer_update_${vehicleId}`, String(Math.floor(msSinceEpoch)));
}

export type TelematicsProvider = 'damoov' | 'inhouse';

export function getTelematicsProvider(): TelematicsProvider {
  const provider = storage.getString(TELEMATICS_PROVIDER_KEY);
  return provider === 'inhouse' ? 'inhouse' : 'damoov';
}

export function setTelematicsProvider(provider: TelematicsProvider): void {
  storage.set(TELEMATICS_PROVIDER_KEY, provider);
}

export function getTelematicsAutoModeEnabled(): boolean {
  const value = storage.getString(TELEMATICS_AUTO_MODE_KEY);
  if (value == null || value === '') return true;
  return value === 'true';
}

export function setTelematicsAutoModeEnabled(enabled: boolean): void {
  storage.set(TELEMATICS_AUTO_MODE_KEY, enabled ? 'true' : 'false');
}

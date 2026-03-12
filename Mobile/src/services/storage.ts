const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_ID_KEY = 'auth_user_id';
const VOICE_LANGUAGE_INDEX_KEY = 'voice_language_index';

type StorageImpl = {
  set: (k: string, v: string) => void;
  getString: (k: string) => string | undefined;
  remove?: (k: string) => void;
};

let storage: StorageImpl | null = null;

try {
  const MMKV = (require('react-native-mmkv') as { MMKV: new () => StorageImpl }).MMKV;
  storage = new MMKV();
} catch {
  const mem: Record<string, string> = {};
  storage = {
    set: (k: string, v: string) => { mem[k] = v; },
    getString: (k: string) => mem[k],
    remove: (k: string) => { delete mem[k]; },
  };
}

const DEV_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtbHQ1emxuODAwMDBqMnV0am1haHhqMzQiLCJwaG9uZU51bWJlciI6Ijk5OTk5OTk5OTkiLCJpYXQiOjE3NzE0ODc3NDksImV4cCI6MTc3NDA3OTc0OX0.BwokEb4KaF-rmX2Vpz8zXaJ2WV197pJTKW6Ijj1sv0A';

// DEV ONLY: Seed a valid JWT only if storage is empty (don't overwrite real login)
if (__DEV__ && !storage!.getString(ACCESS_TOKEN_KEY)) {
  // Token signed with default dev secret; expires in 30 days. Login via OTP to get real tokens + refresh.
  storage!.set(ACCESS_TOKEN_KEY, DEV_TOKEN);
  storage!.set(USER_ID_KEY, 'cmlt5zln80000j2utjmahxj34');
  console.log('[DEV] Seeded dummy auth token (login via OTP for refresh token)');
}

export function setAccessToken(token: string) {
  storage!.set(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | undefined {
  const token = storage!.getString(ACCESS_TOKEN_KEY);
  if (__DEV__ && !token) {
    console.log('[DEV] No token in storage, falling back to dummy dev token');
    return DEV_TOKEN;
  }
  return token;
}

export function setRefreshToken(token: string) {
  storage!.set(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | undefined {
  return storage!.getString(REFRESH_TOKEN_KEY);
}

export function setUserId(id: string) {
  storage!.set(USER_ID_KEY, id);
}

export function getUserId(): string | undefined {
  return storage!.getString(USER_ID_KEY);
}

export function clearAuthStorage() {
  if (storage!.remove) {
    storage!.remove(ACCESS_TOKEN_KEY);
    storage!.remove(REFRESH_TOKEN_KEY);
    storage!.remove(USER_ID_KEY);
  } else {
    storage!.set(ACCESS_TOKEN_KEY, '');
    storage!.set(REFRESH_TOKEN_KEY, '');
    storage!.set(USER_ID_KEY, '');
  }
}

/** Default voice language for Add by Voice (0 = Auto/device, 1+ = specific locale). Persisted. */
export function getVoiceLanguageIndex(): number {
  const s = storage!.getString(VOICE_LANGUAGE_INDEX_KEY);
  if (s == null) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function setVoiceLanguageIndex(index: number): void {
  storage!.set(VOICE_LANGUAGE_INDEX_KEY, String(index));
}

const AUTO_EXPENSE_ENABLED_KEY = 'auto_expense_enabled';

export function getAutoExpenseEnabled(): boolean {
  const s = storage!.getString(AUTO_EXPENSE_ENABLED_KEY);
  return s === 'true';
}

export function setAutoExpenseEnabled(val: boolean): void {
  storage!.set(AUTO_EXPENSE_ENABLED_KEY, val ? 'true' : 'false');
}

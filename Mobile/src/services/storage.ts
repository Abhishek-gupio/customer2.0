const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_ID_KEY = 'auth_user_id';

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

export function setAccessToken(token: string) {
  storage!.set(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | undefined {
  return storage!.getString(ACCESS_TOKEN_KEY);
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

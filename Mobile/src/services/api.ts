import { API_BASE_URL } from '../config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAuthStorage,
  awaitAuthStoragePersisted,
} from './storage';

const base = `${API_BASE_URL}/api`;
type NetworkListener = (online: boolean) => void;
const networkListeners = new Set<NetworkListener>();
let networkOnline = true;

export function getNetworkOnlineState(): boolean {
  return networkOnline;
}

export function subscribeNetworkState(listener: (online: boolean) => void): () => void {
  networkListeners.add(listener);
  return () => networkListeners.delete(listener);
}

function setNetworkOnlineState(next: boolean): void {
  if (networkOnline === next) return;
  networkOnline = next;
  for (const listener of networkListeners) {
    listener(networkOnline);
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: object };

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${base}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json().catch(() => ({}));
      const payload = json?.data ?? json;
      if (res.ok && payload?.accessToken) {
        setAccessToken(payload.accessToken);
        if (payload.refreshToken) setRefreshToken(payload.refreshToken);
        await awaitAuthStoragePersisted();
        return true;
      }
      // Only clear local auth if refresh token is actually invalid/revoked.
      // For transient backend/network issues, keep tokens so the user isn't forced to re-login.
      if (res.status === 401 || res.status === 403) {
        clearAuthStorage();
      }
      return false;
    } catch {
      // Network/server unreachable: don't wipe auth; allow retry later.
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/** Call from code that uses raw fetch (e.g. SSE) to refresh token on 401. */
export { doRefresh };

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { body, ...rest } = options;
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) ?? {}),
  };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (__DEV__) {
    console.warn(`[api] No token found for request to ${url}`);
  }

  const fetchBody: RequestInit['body'] =
    body != null ? JSON.stringify(body) : undefined;

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body: fetchBody });
  } catch (e: any) {
    const msg = e?.message || '';
    const isNetworkErr = /network request failed|failed to fetch|network error/i.test(msg);
    if (isNetworkErr) setNetworkOnlineState(false);
    throw new Error(
      isNetworkErr
        ? 'Network error. Check internet and that the server is reachable.'
        : msg || 'Request failed',
    );
  }
  setNetworkOnlineState(true);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !isRetry) {
    const refreshed = await doRefresh();
    if (refreshed) return request<T>(path, options, true);
  }

  if (!res.ok) {
    const err = data as any;
    const message =
      err?.error?.message ??
      err?.message ??
      err?.error ??
      res.statusText ??
      'Request failed';
    throw new Error(`${message}`); // Only throw the message, without the status code for cleaner UI
  }
  return data as T;
}

async function upload<T>(
  path: string,
  formData: FormData,
  isRetry = false,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const token = getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (__DEV__) {
    console.warn(`[api] No token found for upload to ${url}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: formData });
  } catch (e: any) {
    const msg = e?.message || '';
    const isNetworkErr = /network request failed|failed to fetch|network error/i.test(msg);
    if (isNetworkErr) setNetworkOnlineState(false);
    throw new Error(
      isNetworkErr
        ? 'Network error. Check that the app can reach the server (e.g. use your computer\'s IP instead of localhost).'
        : msg || 'Upload failed',
    );
  }
  setNetworkOnlineState(true);

  const text = await res.text();
  let data: any = {};
  try {
    data = text && text.trim().startsWith('{') ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      throw new Error(res.status === 404 ? 'Upload endpoint not found. Is the backend running?' : `Upload failed (${res.status})`);
    }
  }

  if (res.status === 401 && !isRetry) {
    const refreshed = await doRefresh();
    if (refreshed) return upload<T>(path, formData, true);
  }

  if (!res.ok) {
    const err = data as { message?: string; error?: { message?: string } };
    const message = err?.error?.message ?? err?.message ?? res.statusText ?? 'Upload failed';
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  post: <T>(path: string, body?: object) =>
    request<T>(path, { method: 'POST', body }),
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),
  patch: <T>(path: string, body?: object) =>
    request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: object) =>
    request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    upload<T>(path, formData),
};

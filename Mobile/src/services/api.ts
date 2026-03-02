import { API_BASE_URL } from '../config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAuthStorage,
} from './storage';

const base = `${API_BASE_URL}/api`;

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
        return true;
      }
      clearAuthStorage();
      return false;
    } catch {
      clearAuthStorage();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

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
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const fetchBody: RequestInit['body'] =
    body != null ? JSON.stringify(body) : undefined;

  const res = await fetch(url, { ...rest, headers, body: fetchBody });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !isRetry) {
    const refreshed = await doRefresh();
    if (refreshed) return request<T>(path, options, true);
  }

  if (!res.ok) {
    console.error(`API Error [${res.status}] ${url}:`, JSON.stringify(data));
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
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !isRetry) {
    const refreshed = await doRefresh();
    if (refreshed) return upload<T>(path, formData, true);
  }

  if (!res.ok) {
    console.error(`API Error [${res.status}] ${url}:`, JSON.stringify(data));
    const err = data as { message?: string; error?: { message?: string } };
    const message = err?.error?.message ?? err?.message ?? res.statusText ?? 'Upload failed';
    const errObj = new Error(`${res.status}: ${message}`) as Error & { data?: unknown };
    errObj.data = data;
    throw errObj;
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
  upload: <T>(path: string, formData: FormData) =>
    upload<T>(path, formData),
};

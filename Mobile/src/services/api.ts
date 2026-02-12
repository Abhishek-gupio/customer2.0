import { API_BASE_URL, AUTH_PATH } from '../config';
import { getAccessToken } from './storage';

const base = `${API_BASE_URL}${AUTH_PATH}`;

type RequestOptions = Omit<RequestInit, 'body'> & { body?: object };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  const res = await fetch(url, {
    ...rest,
    headers,
    body: fetchBody,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { message?: string })?.message ?? res.statusText ?? 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  post: <T>(path: string, body?: object) =>
    request<T>(path, { method: 'POST', body }),
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),
};

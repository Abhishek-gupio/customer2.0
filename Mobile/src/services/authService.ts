import { api } from './api';
import {
  setAccessToken,
  setRefreshToken,
  setUserId,
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setAuthPersistedAt,
  awaitAuthStoragePersisted,
} from './storage';
import { damoovTelematics } from '../native/damoovTelematics';

type ApiEnvelope<T> = { success?: boolean; data?: T } & Partial<T>;

function unwrapResponse<T>(response: ApiEnvelope<T>): T {
  return ((response as { data?: T })?.data ?? response) as T;
}

/** Decode JWT payload without verification (client-side only for id). */
function decodeJwtPayload(token: string): { id: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    let json: string;
    if (typeof atob !== 'undefined') {
      json = atob(b64);
    } else {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      for (let i = 0; i < b64.length; i += 4) {
        const a = chars.indexOf(b64[i]);
        const b = chars.indexOf(b64[i + 1]);
        const c = chars.indexOf(b64[i + 2]);
        const d = chars.indexOf(b64[i + 3]);
        result += String.fromCharCode((a << 2) | (b >> 4));
        if (c >= 0) result += String.fromCharCode(((b << 4) | (c >> 2)) & 0xff);
        if (d >= 0) result += String.fromCharCode(((c << 6) | d) & 0xff);
      }
      json = decodeURIComponent(escape(result));
    }
    const payload = JSON.parse(json) as { id?: string };
    return payload.id ? { id: payload.id } : null;
  } catch {
    return null;
  }
}

/** Normalize phone: 10 digits for Indian numbers. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Always use last 10 digits for consistency (Indian phone format)
  return digits.slice(-10);
}

export function formatPhoneNumber(phoneNumber: string): string {
  const normalizedPhone = normalizePhone(phoneNumber);
  return phoneNumber.trim().startsWith('+')
    ? phoneNumber.trim()
    : `+91${normalizedPhone}`;
}

export type SignupPayload = {
  fullName?: string;
  email?: string;
  phoneNumber: string;
};

export type SignupResponse = {
  message: string;
  requiresOtpVerification?: boolean;
  /** Present in development so you can see OTP without SMS */
  otp?: string;
  otpExpiresIn?: number;
};

export type VerifyOtpPayload = {
  phoneNumber: string;
  otp: string;
};

export type VerifyOtpResponse = {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId?: string;
};

export type LoginResponse = {
  message: string;
  requiresOtpVerification?: boolean;
  otp?: string;
  otpExpiresIn?: number;
};

export type CheckUserResponse = {
  exists: boolean;
  message: string;
  userId?: string;
};

export async function login(phoneNumber: string): Promise<LoginResponse> {
  const response = await api.post<ApiEnvelope<LoginResponse>>('/v1/auth/login', {
    phoneNumber: formatPhoneNumber(phoneNumber),
  });
  return unwrapResponse(response);
}

export async function checkUserExists(phoneNumber: string): Promise<CheckUserResponse> {
  const response = await api.post<ApiEnvelope<CheckUserResponse>>('/v1/auth/check-user', {
    phoneNumber: formatPhoneNumber(phoneNumber),
  });
  return unwrapResponse(response);
}

export async function sendOtp(phoneNumber: string): Promise<LoginResponse> {
  const response = await api.post<ApiEnvelope<LoginResponse>>('/v1/auth/send-otp', {
    phoneNumber: formatPhoneNumber(phoneNumber),
  });
  return unwrapResponse(response);
}

export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  const response = await api.post<ApiEnvelope<SignupResponse>>('/v1/auth/signup', {
    fullName: payload.fullName?.trim() || undefined,
    email: payload.email?.trim() || undefined,
    phoneNumber: formatPhoneNumber(payload.phoneNumber),
  });
  return unwrapResponse(response);
}

export async function verifyOtp(phoneNumber: string, otp: string): Promise<VerifyOtpResponse & { userId?: string }> {
  const res = await api.post<ApiEnvelope<VerifyOtpResponse>>('/v1/auth/verify-otp', {
    phoneNumber: formatPhoneNumber(phoneNumber),
    otp,
  });
  if (typeof console !== 'undefined') {
    console.log('verifyOtp response:', res);
  }
  // Unwrap data property if present (backend wraps in { success, data })
  const payload = unwrapResponse(res);
  setAccessToken(payload.accessToken);
  setRefreshToken(payload.refreshToken);
  setAuthPersistedAt(Date.now());
  if (typeof console !== 'undefined') {
    console.log('Access token set:', payload.accessToken);
  }
  const idFromServer = payload.userId as string | undefined;
  const jwtPayload = decodeJwtPayload(payload.accessToken);
  const id = idFromServer ?? jwtPayload?.id;
  if (id) setUserId(id);
  await awaitAuthStoragePersisted();
  return { ...payload, userId: id };
}

export function getStoredAccessToken(): string | undefined {
  return getAccessToken();
}

export function getStoredRefreshToken(): string | undefined {
  return getRefreshToken();
}

export function logoutStorage(): void {
  damoovTelematics.logout().catch(() => {});
  clearAuthStorage();
}

export type LoginWithGoogleResponse = VerifyOtpResponse;

/** Sign in with Google: exchange ID token for app tokens and persist. */
export async function loginWithGoogle(idToken: string): Promise<LoginWithGoogleResponse & { userId?: string }> {
  const res = await api.post<ApiEnvelope<LoginWithGoogleResponse>>('/v1/auth/google', { idToken });
  const payload = unwrapResponse(res);
  setAccessToken(payload.accessToken);
  setRefreshToken(payload.refreshToken);
  setAuthPersistedAt(Date.now());
  const idFromServer = payload.userId as string | undefined;
  const jwtPayload = decodeJwtPayload(payload.accessToken);
  const id = idFromServer ?? jwtPayload?.id;
  if (id) setUserId(id);
  await awaitAuthStoragePersisted();
  return { ...payload, userId: id };
}

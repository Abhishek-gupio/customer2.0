import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config/environment';
import authStorage from './authStorage';

async function getApiBase(): Promise<string> {
  // Mirror valet app: use centralized environment config
  return config.apiBaseUrl;
}

export async function registerFcmToken(token: string, deviceInfo?: any) {
  const base = await getApiBase();
  const res = await fetch(`${base}/fcm/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
    body: JSON.stringify({ token, deviceInfo }),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to register FCM token');
  }
  return json;
}

export async function unregisterFcmToken(token: string) {
  const base = await getApiBase();
  const res = await fetch(`${base}/fcm/unregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
    body: JSON.stringify({ token }),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to unregister FCM token');
  }
  return json;
}

async function getToken(): Promise<string> {
  try {
    // Use authStorage which checks for 30-day expiration
    const token = await authStorage.getToken();
    return token || '';
  } catch {
    return '';
  }
}

export async function sendOtp(identifier: string) {
  const base = await getApiBase();
  console.log(`base : ${base}`)
  const res = await fetch(`${base}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to send OTP');
  }
  console.log(json)
  return json;
}

export async function verifyOtp(identifier: string, otp: string, otpToken?: string) {
  const base = await getApiBase();
  const body: any = { identifier, otp };
  if (otpToken) body.token = otpToken;
  const res = await fetch(`${base}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to verify OTP');
  }
  return json as { success: true; data: { token: string; customer?: any } };
}

export async function resendOtp(identifier: string) {
  const base = await getApiBase();
  const res = await fetch(`${base}/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to resend OTP');
  }
  console.log(json)
  return json as { success: true; data: { token: string; identifier?: string; otp?: string } };
}

import {
  clearStoredVehicleInfo,
  clearStoredRequestStatus,
} from './notificationHandler';

export async function logout() {
  const base = await getApiBase();
  const token = await getToken();

  // Always clear local storage regardless of server response
  await clearStoredVehicleInfo();
  await clearStoredRequestStatus();
  await authStorage.clearToken();
  await authStorage.clearUser();

  if (!token) {
    // nothing to do client-side
    return { success: true, message: 'No token to logout' } as any;
  }
  const res = await fetch(`${base}/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to logout');
  }
  return json;
}

export async function getProfile() {
  const base = await getApiBase();
  const token = await getToken();
  if (!token) throw new Error('Access token required');
  const res = await fetch(`${base}/profile`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to fetch profile');
  }
  return json.data as {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    image?: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    client?: { id: string; name: string; email: string; contactNumber: string; site?: { id: string; name: string; city: string; state: string } | null } | null;
  };
}

export async function updateProfileName(fullName: string) {
  const base = await getApiBase();
  const token = await getToken();
  if (!token) throw new Error('Access token required');
  const res = await fetch(`${base}/profile/name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ fullName }),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to update name');
  }
  return json.data as { id: string; fullName: string; email: string; phoneNumber: string; image?: string | null; status: 'ACTIVE' | 'INACTIVE' };
}

export async function updateProfilePicture(fileUri: string) {
  const base = await getApiBase();
  const token = await getToken();
  if (!token) throw new Error('Access token required');

  const form = new FormData();
  // React Native FormData requires name/type for file
  form.append('profilePic', {
    // @ts-ignore - React Native file shape
    uri: fileUri,
    name: 'profile.jpg',
    type: 'image/jpeg',
  });

  const res = await fetch(`${base}/profile/picture`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to update profile picture');
  }
  return json.data as { id: string; fullName: string; email: string; phoneNumber: string; image?: string | null; status: 'ACTIVE' | 'INACTIVE' };
}

export async function requestVehicleDrop(vehicleNumber?: string, authToken?: string) {
  const token = authToken ?? (await getToken());
  console.log('[authApi] requestVehicleDrop param authToken length/type', authToken ? authToken.length : 0, typeof authToken);
  console.log('[authApi] requestVehicleDrop resolved token length/type', token ? token.length : 0, typeof token);
  if (!token) {
    console.warn('[authApi] No auth token available for requestVehicleDrop');
    throw new Error('Access token required');
  }
  const base = await getApiBase();
  const res = await fetch(`${base}/request-drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ vehicleNumber })
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    console.warn('[authApi] requestVehicleDrop failed', { status: res.status, body: json });
    throw new Error(json?.message || 'Failed to send drop request');
  }
  console.log('[authApi] requestVehicleDrop success', json);
  return json;
}

export async function getRequestStatus(vehicleNumber?: string, authToken?: string) {
  const token = authToken ?? (await getToken());
  if (!token) {
    console.warn('[authApi] No auth token available for getRequestStatus');
    throw new Error('Access token required');
  }
  const base = await getApiBase();
  const queryParams = vehicleNumber ? `?vehicleNumber=${encodeURIComponent(vehicleNumber)}` : '';
  const res = await fetch(`${base}/request-status${queryParams}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    console.warn('[authApi] getRequestStatus failed', { status: res.status, body: json });
    throw new Error(json?.message || 'Failed to get request status');
  }
  console.log('[authApi] getRequestStatus success', json);
  return json;
}

export async function getVehicleRequestData(vehicleNumber?: string, authToken?: string) {
  const token = authToken ?? (await getToken());
  if (!token) {
    console.warn('[authApi] No auth token available for getVehicleRequestData');
    throw new Error('Access token required');
  }
  const base = await getApiBase();
  const queryParams = vehicleNumber ? `?vehicleNumber=${encodeURIComponent(vehicleNumber)}` : '';
  const res = await fetch(`${base}/vehicle-request-data${queryParams}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });

  // Handle 429 (rate limit) specifically
  if (res.status === 429) {
    console.warn('[authApi] Rate limited (429) - too many requests');
    throw new Error('Rate limited - please wait');
  }

  // Check if response is JSON before parsing
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const responseText = await res.text();
    console.warn('[authApi] Non-JSON response received', {
      status: res.status,
      contentType,
      preview: responseText.substring(0, 200)
    });
    throw new Error(`Server returned non-JSON response (${res.status})`);
  }

  const json = await res.json();
  if (!res.ok || !json?.success) {
    console.warn('[authApi] getVehicleRequestData failed', { status: res.status, body: json });
    throw new Error(json?.message || 'Failed to get vehicle request data');
  }
  console.log('[authApi] getVehicleRequestData success', json);
  return json;
}

export async function cancelDropRequest(vehicleNumber?: string, authToken?: string) {
  const token = authToken ?? (await getToken());
  console.log('[authApi] cancelDropRequest called', {
    vehicleNumber,
    hasToken: !!token,
    tokenLength: token ? token.length : 0
  });

  if (!token) {
    console.warn('[authApi] No auth token available for cancelDropRequest');
    throw new Error('Authentication token required. Please log in again.');
  }
  const base = await getApiBase();
  console.log('[authApi] cancelDropRequest API base URL:', base);

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const requestBody = { vehicleNumber };
    console.log('[authApi] cancelDropRequest request body:', requestBody);

    const res = await fetch(`${base}/cancel-drop-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    console.log('[authApi] cancelDropRequest response status:', res.status);

    if (timeoutId) clearTimeout(timeoutId);

    // Parse response (matching customer-web-app pattern)
    const json = await res.json();

    // Check response status first (matching customer-web-app pattern)
    if (!res.ok) {
      const errorMessage = json?.message || `Failed to cancel drop request (HTTP ${res.status})`;
      console.warn('[authApi] cancelDropRequest failed', { status: res.status, body: json });
      throw new Error(errorMessage);
    }

    // Check if response indicates success (matching customer-web-app pattern)
    if (!json?.success) {
      const errorMessage = json?.message || 'Failed to cancel drop request';
      console.warn('[authApi] cancelDropRequest failed', { status: res.status, body: json });
      throw new Error(errorMessage);
    }

    console.log('[authApi] cancelDropRequest success', json);
    return json;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    // Handle timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      console.warn('[authApi] Cancel request timeout');
      throw new Error('Request timed out. Please check your connection and try again.');
    }

    // Handle network errors
    if (
      error.message?.includes('Network request failed') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.toLowerCase().includes('network')
    ) {
      console.warn('[authApi] Network error during cancel');
      throw new Error('Network error. Please check your internet connection and try again.');
    }

    // Re-throw if it's already a formatted error
    if (error instanceof Error) {
      throw error;
    }

    // Default error
    throw new Error(error?.message || 'Failed to cancel drop request. Please try again.');
  }
}

export async function resendDropRequest(vehicleNumber?: string, authToken?: string) {
  const token = authToken ?? (await getToken());
  console.log('[authApi] resendDropRequest param authToken length/type', authToken ? authToken.length : 0, typeof authToken);
  console.log('[authApi] resendDropRequest resolved token length/type', token ? token.length : 0, typeof token);
  if (!token) {
    console.warn('[authApi] No auth token available for resendDropRequest');
    throw new Error('Access token required');
  }
  const base = await getApiBase();

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const res = await fetch(`${base}/resend-drop-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ vehicleNumber }),
      signal: controller.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    // Handle rate limiting
    if (res.status === 429) {
      console.warn('[authApi] Rate limited (429) - too many resend requests');
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    // Handle network errors
    if (!res.ok && res.status >= 500) {
      console.warn('[authApi] Server error during resend', { status: res.status });
      throw new Error('Server error. Please try again in a moment.');
    }

    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await res.text();
      console.warn('[authApi] Non-JSON response received', {
        status: res.status,
        contentType,
        preview: responseText.substring(0, 200)
      });
      throw new Error(`Server returned an unexpected response. Please try again.`);
    }

    const json = await res.json();
    if (!res.ok || !json?.success) {
      console.warn('[authApi] resendDropRequest failed', { status: res.status, body: json });
      throw new Error(json?.message || 'Failed to resend drop request. Please try again.');
    }
    console.log('[authApi] resendDropRequest success', json);
    return json;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    // Handle timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      console.warn('[authApi] Resend request timeout');
      throw new Error('Request timed out. Please check your connection and try again.');
    }

    // Handle network errors
    if (
      error.message?.includes('Network request failed') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.toLowerCase().includes('network')
    ) {
      console.warn('[authApi] Network error during resend');
      throw new Error('Network error. Please check your internet connection and try again.');
    }

    // Re-throw if it's already a formatted error
    if (error.message && (
      error.message.includes('too many requests') ||
      error.message.includes('Server error') ||
      error.message.includes('timed out') ||
      error.message.includes('Network error')
    )) {
      throw error;
    }

    // Default error
    throw new Error(error?.message || 'Failed to resend drop request. Please try again.');
  }
}



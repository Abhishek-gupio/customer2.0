import { config } from '../config/environment';
import authStorage from './authStorage';

async function getToken(): Promise<string> {
  try {
    const token = await authStorage.getToken();
    return token || '';
  } catch {
    return '';
  }
}

async function getApiBase(): Promise<string> {
  // Remove '/customer' suffix and use the base API URL
  const baseUrl = config.apiBaseUrl;
  return baseUrl.replace('/api/v1/customer', '/api/v1');
}

/**
 * Helper function to make fetch requests with timeout and proper error handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = config.timeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // prevent caching
    const headers = new Headers(options.headers || {});
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection and try again.');
    }

    // Handle network errors
    if (
      error.message?.includes('Network request failed') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('connection') ||
      !error.response
    ) {
      throw new Error('Network error: Unable to connect to the server. Please check your internet connection.');
    }

    // Re-throw other errors
    throw error;
  }
}

export interface PickupDetails {
  pickupBy: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    employeeId: string | null;
  };
  pickupTime: string;
  pickupFrom: string | null;
  parkAt: string | null;
  meterPhotoUrl: string | null;
  vehiclePhotoUrl: string | null;
  vehicleVideoUrl: string | null;
}

export interface DropDetails {
  droppedBy: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    employeeId: string | null;
  };
  dropTime: string;
  dropLocation: string | null;
  notes: string | null;
}

export interface VehicleInfo {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
}

export interface SiteInfo {
  id: string;
  siteName: string;
  siteAddress: string;
  city: string;
  state: string;
  pincode: string;
}

export interface CustomerInfo {
  id: string | null;
  name: string;
  email: string | null;
  phoneNumber: string;
  address: string | null;
}

export interface HistoryRecord {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  vehicle: VehicleInfo;
  pickup: PickupDetails;
  drop: DropDetails | null;
  customer: CustomerInfo;
  site: SiteInfo | null;
  clients: {
    valetClient: {
      id: string;
      clientName: string;
      clientType: string;
      clientEmail: string;
    } | null;
    customerClient: {
      id: string;
      clientName: string;
      clientType: string;
      clientEmail: string;
    } | null;
  };
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryResponse {
  success: boolean;
  message: string;
  data: {
    history: HistoryRecord[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalRecords: number;
      recordsPerPage: number;
    };
  };
}

export interface HistoryFilters {
  vehicleNumber?: string;
  startDate?: string;
  endDate?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  valetId?: string;
  siteId?: string;
  clientId?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch vehicle history with optional filters
 */
export async function getVehicleHistory(filters?: HistoryFilters): Promise<HistoryResponse> {
  const base = await getApiBase();
  const token = await getToken();

  if (!token) {
    throw new Error('Access token required');
  }

  // Build query parameters
  const queryParams = new URLSearchParams();

  if (filters) {
    if (filters.vehicleNumber) queryParams.append('vehicleNumber', filters.vehicleNumber);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.valetId) queryParams.append('valetId', filters.valetId);
    if (filters.siteId) queryParams.append('siteId', filters.siteId);
    if (filters.clientId) queryParams.append('clientId', filters.clientId);
    if (filters.page) queryParams.append('page', String(filters.page));
    if (filters.limit) queryParams.append('limit', String(filters.limit));
  }

  const url = `${base}/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    // Check if response is JSON
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('❌ Non-JSON response received:', contentType);
      console.error('URL:', url);
      throw new Error(`Expected JSON response, got ${contentType || 'unknown type'}. Check API endpoint.`);
    }

    const json = await res.json();

    // Handle server errors (5xx) including 502 Bad Gateway
    if (!res.ok) {
      const statusCode = res.status;
      if (statusCode >= 500 && statusCode < 600) {
        if (statusCode === 502) {
          throw new Error('Bad Gateway - Server is temporarily unavailable. Please try again.');
        }
        throw new Error(`Server error (${statusCode}). The server encountered an issue. Please try again.`);
      }
      throw new Error(json?.message || 'Failed to fetch vehicle history');
    }

    if (!json?.success) {
      throw new Error(json?.message || 'Failed to fetch vehicle history');
    }

    return json as HistoryResponse;
  } catch (error: any) {
    // Re-throw with more context if it's not already a formatted error
    if (error.message && (error.message.includes('timeout') || error.message.includes('Network error') || error.message.includes('Server error') || error.message.includes('Bad Gateway'))) {
      throw error;
    }
    throw new Error(error.message || 'Failed to fetch vehicle history');
  }
}

/**
 * Fetch history for a specific vehicle by vehicle number
 */
export async function getVehicleHistoryByNumber(vehicleNumber: string): Promise<any> {
  const base = await getApiBase();
  const token = await getToken();

  if (!token) {
    throw new Error('Access token required');
  }

  if (!vehicleNumber) {
    throw new Error('Vehicle number is required');
  }

  const url = `${base}/history/vehicle/${vehicleNumber}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('❌ Non-JSON response received:', contentType);
      console.error('URL:', url);
      throw new Error(`Expected JSON response, got ${contentType || 'unknown type'}. Check API endpoint.`);
    }

    const json = await res.json();

    if (!res.ok || !json?.success) {
      throw new Error(json?.message || 'Failed to fetch vehicle history');
    }

    return json;
  } catch (error: any) {
    // Re-throw with more context if it's not already a formatted error
    if (error.message && (error.message.includes('timeout') || error.message.includes('Network error'))) {
      throw error;
    }
    throw new Error(error.message || 'Failed to fetch vehicle history');
  }
}

/**
 * Fetch customer vehicle history - only returns vehicles for the authenticated customer
 * This endpoint requires customer authentication and automatically filters by customer ID
 */
export async function getCustomerVehicleHistory(filters?: Omit<HistoryFilters, 'valetId' | 'siteId' | 'clientId'>): Promise<HistoryResponse> {
  const base = await getApiBase();
  const token = await getToken();

  if (!token) {
    throw new Error('Access token required');
  }

  // Build query parameters
  const queryParams = new URLSearchParams();

  if (filters) {
    if (filters.vehicleNumber) queryParams.append('vehicleNumber', filters.vehicleNumber);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.page) queryParams.append('page', String(filters.page));
    if (filters.limit) queryParams.append('limit', String(filters.limit));
  }

  const url = `${base}/history/customer/my-vehicles${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    // Check if response is JSON
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('❌ Non-JSON response received:', contentType);
      console.error('URL:', url);
      throw new Error(`Expected JSON response, got ${contentType || 'unknown type'}. Check API endpoint.`);
    }

    const json = await res.json();

    // Handle server errors (5xx) including 502 Bad Gateway
    if (!res.ok) {
      const statusCode = res.status;
      if (statusCode >= 500 && statusCode < 600) {
        if (statusCode === 502) {
          throw new Error('Bad Gateway - Server is temporarily unavailable. Please try again.');
        }
        throw new Error(`Server error (${statusCode}). The server encountered an issue. Please try again.`);
      }
      throw new Error(json?.message || 'Failed to fetch customer vehicle history');
    }

    if (!json?.success) {
      throw new Error(json?.message || 'Failed to fetch customer vehicle history');
    }

    return json as HistoryResponse;
  } catch (error: any) {
    // Re-throw with more context if it's not already a formatted error
    if (error.message && (error.message.includes('timeout') || error.message.includes('Network error') || error.message.includes('Server error') || error.message.includes('Bad Gateway'))) {
      throw error;
    }
    throw new Error(error.message || 'Failed to fetch customer vehicle history');
  }
}

/**
 * Fetch history statistics/summary
 */
export async function getHistoryStats(filters?: Omit<HistoryFilters, 'vehicleNumber' | 'status' | 'page' | 'limit'>): Promise<any> {
  const base = await getApiBase();
  const token = await getToken();

  if (!token) {
    throw new Error('Access token required');
  }

  const queryParams = new URLSearchParams();

  if (filters) {
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.valetId) queryParams.append('valetId', filters.valetId);
    if (filters.siteId) queryParams.append('siteId', filters.siteId);
    if (filters.clientId) queryParams.append('clientId', filters.clientId);
  }

  const url = `${base}/history/stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.error('❌ Non-JSON response received:', contentType);
      console.error('URL:', url);
      throw new Error(`Expected JSON response, got ${contentType || 'unknown type'}. Check API endpoint.`);
    }

    const json = await res.json();

    if (!res.ok || !json?.success) {
      throw new Error(json?.message || 'Failed to fetch history statistics');
    }

    return json;
  } catch (error: any) {
    // Re-throw with more context if it's not already a formatted error
    if (error.message && (error.message.includes('timeout') || error.message.includes('Network error'))) {
      throw error;
    }
    throw new Error(error.message || 'Failed to fetch history statistics');
  }
}

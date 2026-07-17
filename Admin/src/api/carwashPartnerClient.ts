const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getPartnerToken(): string | null {
  return localStorage.getItem('washPartnerToken');
}

/**
 * Mirrors dealerClient.ts's dealerApiRequest but authenticates with the wash
 * partner JWT — a separate credential from both the customer and admin token.
 */
export async function partnerApiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { message: string } }> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getPartnerToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: { message: json?.error?.message ?? json?.message ?? 'Request failed' } };
  }
  return json as { success: true; data: T };
}

export interface WashCenter {
  id: string;
  partnerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  supportsBike: boolean;
  supportsCar: boolean;
  supportsEV: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface WashSlot {
  id: string;
  centerId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
}

export interface WashTechnician {
  id: string;
  partnerId: string;
  name: string;
  phoneNumber: string;
  photoUrl: string | null;
  isActive: boolean;
  rating: number | null;
  createdAt: string;
}

export interface WashJob {
  id: string;
  serviceModel: 'VISIT_CENTER' | 'DOORSTEP';
  washType: string;
  status: 'CONFIRMED' | 'TECHNICIAN_ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REFUNDED';
  amountPaise: number;
  addressLine: string | null;
  createdAt: string;
  customer: { fullName: string | null; phoneNumber: string };
  technician: { name: string } | null;
}

export const partnerApi = {
  login: (phoneNumber: string, password: string) =>
    partnerApiRequest<{ accessToken: string; expiresIn: number; partner: { id: string; name: string; status: string } }>(
      '/v1/carwash/partner/auth/login',
      { method: 'POST', body: JSON.stringify({ phoneNumber, password }) },
    ),

  createCenter: (data: { name: string; address: string; latitude: number; longitude: number }) =>
    partnerApiRequest<WashCenter>('/v1/carwash/partner/centers', { method: 'POST', body: JSON.stringify(data) }),

  listCenters: () => partnerApiRequest<WashCenter[]>('/v1/carwash/partner/centers'),

  createSlots: (centerId: string, data: { fromDate: string; toDate: string; intervalHours: number; capacity: number }) =>
    partnerApiRequest<{ count: number }>(`/v1/carwash/partner/centers/${centerId}/slots`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listSlots: (centerId: string) => partnerApiRequest<WashSlot[]>(`/v1/carwash/partner/centers/${centerId}/slots`),

  createTechnician: (data: { name: string; phoneNumber: string; password: string }) =>
    partnerApiRequest<WashTechnician>('/v1/carwash/partner/technicians', { method: 'POST', body: JSON.stringify(data) }),

  listTechnicians: () => partnerApiRequest<WashTechnician[]>('/v1/carwash/partner/technicians'),

  listJobs: () => partnerApiRequest<WashJob[]>('/v1/carwash/partner/jobs'),

  assignTechnician: (jobId: string, technicianId: string) =>
    partnerApiRequest<WashJob>(`/v1/carwash/partner/jobs/${jobId}/assign-technician`, {
      method: 'POST',
      body: JSON.stringify({ technicianId }),
    }),
};

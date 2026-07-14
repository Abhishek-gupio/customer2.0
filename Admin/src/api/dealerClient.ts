const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getDealerToken(): string | null {
  return localStorage.getItem('dealerToken');
}

/**
 * Mirrors client.ts's api() but authenticates with the dealer JWT, a
 * separate credential from the admin token — dealers are not admins.
 */
export async function dealerApiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { message: string } }> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getDealerToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: { message: json?.error?.message ?? json?.message ?? 'Request failed' } };
  }
  return json as { success: true; data: T };
}

export interface DealerListing {
  id: string;
  dealerId: string;
  name: string;
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
  fourWheelerCapacity: number;
  twoWheelerCapacity: number;
  hourlyRatePaise: number;
  dailyRatePaise: number | null;
  photos: string[];
  status: 'ACTIVE' | 'PAUSED' | 'REMOVED';
  createdAt: string;
}

export interface DealerSlotWindow {
  id: string;
  listingId: string;
  date: string;
  startHour: number;
  endHour: number;
  capacity: number;
  booked: number;
}

export interface DealerBooking {
  id: string;
  listingId: string;
  vehicleId: string | null;
  startTime: string;
  endTime: string;
  amountPaise: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  createdAt: string;
  listing: { name: string };
}

export const dealerApi = {
  login: (phoneNumber: string, password: string) =>
    dealerApiRequest<{ accessToken: string; expiresIn: number; dealer: { id: string; ownerName: string; status: string } }>(
      '/v1/parking/dealer/auth/login',
      { method: 'POST', body: JSON.stringify({ phoneNumber, password }) },
    ),

  createListing: (data: {
    name: string;
    addressLine: string;
    city: string;
    latitude: number;
    longitude: number;
    fourWheelerCapacity: number;
    twoWheelerCapacity: number;
    hourlyRatePaise: number;
    dailyRatePaise?: number;
  }) => dealerApiRequest<DealerListing>('/v1/parking/dealer/listings', { method: 'POST', body: JSON.stringify(data) }),

  updateListing: (id: string, data: Partial<DealerListing>) =>
    dealerApiRequest<DealerListing>(`/v1/parking/dealer/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  uploadPhotos: (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    return dealerApiRequest<DealerListing>(`/v1/parking/dealer/listings/${id}/photos`, {
      method: 'POST',
      body: formData,
    });
  },

  listListings: () => dealerApiRequest<DealerListing[]>('/v1/parking/dealer/listings'),

  createSlotWindows: (listingId: string, data: { fromDate: string; toDate: string; startHour: number; endHour: number; capacity: number }) =>
    dealerApiRequest<{ count: number }>(`/v1/parking/dealer/listings/${listingId}/slots`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listSlotWindows: (listingId: string) =>
    dealerApiRequest<DealerSlotWindow[]>(`/v1/parking/dealer/listings/${listingId}/slots`),

  listBookings: () => dealerApiRequest<DealerBooking[]>('/v1/parking/dealer/bookings'),
};

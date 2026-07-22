import type {
  DealerListing,
  DealerSlotWindow,
  DealerBooking,
  ParkingVehicleType,
  ParkingPaymentMethod,
  WalkIn,
  ListingLiveStatus,
  LiveListingSummary,
  WalkInHistoryEntry,
  Pagination,
} from './dealerClient';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getEmployeeToken(): string | null {
  return localStorage.getItem('parkingEmployeeToken');
}

/**
 * Mirrors dealerClient.ts's dealerApiRequest but authenticates with the
 * employee JWT — a dealer's on-ground staff, a separate and more restricted
 * credential from the dealer's own login.
 */
export async function employeeApiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { message: string } }> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getEmployeeToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: { message: json?.error?.message ?? json?.message ?? 'Request failed' } };
  }
  return json as { success: true; data: T };
}

export const employeeApi = {
  login: (phoneNumber: string, password: string) =>
    employeeApiRequest<{ accessToken: string; expiresIn: number; employee: { id: string; name: string } }>(
      '/v1/parking/employee/auth/login',
      { method: 'POST', body: JSON.stringify({ phoneNumber, password }) },
    ),

  listListings: () => employeeApiRequest<DealerListing[]>('/v1/parking/employee/listings'),

  listSlotWindows: (listingId: string) =>
    employeeApiRequest<DealerSlotWindow[]>(`/v1/parking/employee/listings/${listingId}/slots`),

  checkInWalkIn: (listingId: string, slotId: string, data: { vehicleType: ParkingVehicleType; vehicleNumber: string }) =>
    employeeApiRequest<WalkIn>(`/v1/parking/employee/listings/${listingId}/slots/${slotId}/checkin`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  checkOutWalkIn: (walkInId: string, paymentMethod: ParkingPaymentMethod) =>
    employeeApiRequest<WalkIn>(`/v1/parking/employee/walkins/${walkInId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    }),

  getListingLiveStatus: (listingId: string) =>
    employeeApiRequest<ListingLiveStatus>(`/v1/parking/employee/listings/${listingId}/live`),

  getWalkInHistory: (listingId: string, params?: { page?: number; limit?: number }) =>
    employeeApiRequest<{ data: WalkInHistoryEntry[]; pagination: Pagination }>(
      `/v1/parking/employee/listings/${listingId}/walkins/history?page=${params?.page ?? 1}&limit=${params?.limit ?? 20}`,
    ),

  listLiveListings: () => employeeApiRequest<LiveListingSummary[]>('/v1/parking/employee/live-listings'),

  listBookings: (params?: { scope?: 'active' | 'history'; page?: number; limit?: number; q?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams({
      scope: params?.scope ?? 'active',
      page: String(params?.page ?? 1),
      limit: String(params?.limit ?? 20),
    });
    if (params?.q) query.set('q', params.q);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    return employeeApiRequest<{ data: DealerBooking[]; pagination: Pagination }>(
      `/v1/parking/employee/bookings?${query.toString()}`,
    );
  },

  checkoutBooking: (bookingId: string) =>
    employeeApiRequest<DealerBooking>(`/v1/parking/employee/bookings/${bookingId}/checkout`, { method: 'POST' }),

  markBookingNoShow: (bookingId: string) =>
    employeeApiRequest<DealerBooking>(`/v1/parking/employee/bookings/${bookingId}/no-show`, { method: 'POST' }),

  undoBookingNoShow: (bookingId: string) =>
    employeeApiRequest<DealerBooking>(`/v1/parking/employee/bookings/${bookingId}/undo-no-show`, { method: 'POST' }),

  markBookingCheckedIn: (bookingId: string) =>
    employeeApiRequest<DealerBooking>(`/v1/parking/employee/bookings/${bookingId}/checkin`, { method: 'POST' }),
};

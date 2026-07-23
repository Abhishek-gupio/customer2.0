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

export type ParkingVehicleType = 'CAR' | 'BIKE';

export interface DealerSlotWindow {
  id: string;
  listingId: string;
  date: string;
  startHour: number;
  endHour: number;
  capacity: number;
  booked: number;
  manualOccupiedCars: number;
  manualOccupiedBikes: number;
}

export type ParkingPaymentMethod = 'CASH' | 'ONLINE';

export interface WalkIn {
  id: string;
  source: 'walkin';
  vehicleType: ParkingVehicleType;
  vehicleNumber: string;
  amountPaise: number;
  paymentMethod: ParkingPaymentMethod | null;
  employeeName: string | null;
  enteredAt: string;
  paymentLink?: {
    paymentLinkId: string;
    shortUrl: string;
  };
}

export interface LiveBooking {
  id: string;
  source: 'app';
  vehicleNumber: string | null;
  customerName: string | null;
  customerPhone: string;
  amountPaise: number;
  startTime: string;
  endTime: string;
}

export interface ListingLiveStatus {
  bookings: LiveBooking[];
  walkIns: WalkIn[];
}

export interface WalkInHistoryEntry {
  id: string;
  vehicleType: ParkingVehicleType;
  vehicleNumber: string;
  amountPaise: number;
  paymentMethod: ParkingPaymentMethod | null;
  // CASH is confirmed instantly; ONLINE only once Razorpay's webhook actually
  // fires — revenue totals must key off this, not paymentMethod's presence.
  paymentConfirmed: boolean;
  employeeName: string | null;
  enteredAt: string;
  exitedAt: string;
}

export interface LiveListingSummary {
  listingId: string;
  listingName: string;
  appCount: number;
  walkInCount: number;
  // Present only on the admin (Gupio ops) overview across all dealers.
  city?: string;
  dealerName?: string;
}

export interface DealerEmployee {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  assignedListings: { id: string; name: string }[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DealerBooking {
  id: string;
  listingId: string;
  vehicleId: string | null;
  vehicleNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  startTime: string;
  endTime: string;
  amountPaise: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  createdAt: string;
  checkedInAt: string | null;
  actualCheckOutTime: string | null;
  extraAmountPaise: number | null;
  extraOrderId: string | null;
  listing: { name: string };
}

export interface ParkingSettlement {
  id: string;
  dealerId: string;
  date: string;
  totalCollected: number;
  gupioCommission: number;
  amountSettled: number;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
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

  checkInWalkIn: (listingId: string, slotId: string, data: { vehicleType: ParkingVehicleType; vehicleNumber: string }) =>
    dealerApiRequest<WalkIn>(`/v1/parking/dealer/listings/${listingId}/slots/${slotId}/checkin`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  checkOutWalkIn: (walkInId: string, paymentMethod: ParkingPaymentMethod) =>
    dealerApiRequest<WalkIn>(`/v1/parking/dealer/walkins/${walkInId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    }),

  getListingLiveStatus: (listingId: string) =>
    dealerApiRequest<ListingLiveStatus>(`/v1/parking/dealer/listings/${listingId}/live`),

  getWalkInHistory: (listingId: string, params?: { page?: number; limit?: number }) =>
    dealerApiRequest<{ data: WalkInHistoryEntry[]; pagination: Pagination }>(
      `/v1/parking/dealer/listings/${listingId}/walkins/history?page=${params?.page ?? 1}&limit=${params?.limit ?? 20}`,
    ),

  listLiveListings: () => dealerApiRequest<LiveListingSummary[]>('/v1/parking/dealer/live-listings'),

  listBookings: (params?: { scope?: 'active' | 'history'; page?: number; limit?: number; q?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams({
      scope: params?.scope ?? 'active',
      page: String(params?.page ?? 1),
      limit: String(params?.limit ?? 20),
    });
    if (params?.q) query.set('q', params.q);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    return dealerApiRequest<{ data: DealerBooking[]; pagination: Pagination }>(
      `/v1/parking/dealer/bookings?${query.toString()}`,
    );
  },

  checkoutBooking: (bookingId: string) =>
    dealerApiRequest<DealerBooking>(`/v1/parking/dealer/bookings/${bookingId}/checkout`, { method: 'POST' }),

  markBookingNoShow: (bookingId: string) =>
    dealerApiRequest<DealerBooking>(`/v1/parking/dealer/bookings/${bookingId}/no-show`, { method: 'POST' }),

  undoBookingNoShow: (bookingId: string) =>
    dealerApiRequest<DealerBooking>(`/v1/parking/dealer/bookings/${bookingId}/undo-no-show`, { method: 'POST' }),

  markBookingCheckedIn: (bookingId: string) =>
    dealerApiRequest<DealerBooking>(`/v1/parking/dealer/bookings/${bookingId}/checkin`, { method: 'POST' }),

  listSettlements: (params?: { page?: number; limit?: number }) =>
    dealerApiRequest<{ data: ParkingSettlement[]; pagination: Pagination }>(
      `/v1/parking/dealer/settlements?page=${params?.page ?? 1}&limit=${params?.limit ?? 20}`,
    ),

  createEmployee: (data: { name: string; phoneNumber: string; password: string; listingIds: string[] }) =>
    dealerApiRequest<DealerEmployee>('/v1/parking/dealer/employees', { method: 'POST', body: JSON.stringify(data) }),

  listEmployees: () => dealerApiRequest<DealerEmployee[]>('/v1/parking/dealer/employees'),

  setEmployeeActive: (employeeId: string, isActive: boolean) =>
    dealerApiRequest<DealerEmployee>(`/v1/parking/dealer/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  setEmployeeListings: (employeeId: string, listingIds: string[]) =>
    dealerApiRequest<DealerEmployee>(`/v1/parking/dealer/employees/${employeeId}/listings`, {
      method: 'PATCH',
      body: JSON.stringify({ listingIds }),
    }),
};

import { api } from './api';

export interface ParkingSearchResult {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  hourlyRatePaise: number;
  dailyRatePaise: number | null;
  photos: string[];
  soldOut: boolean;
  waitlistAvailable: boolean;
  availableSpots: number;
}

export interface ParkingListingDetail extends Omit<ParkingSearchResult, 'distanceKm' | 'soldOut' | 'waitlistAvailable' | 'availableSpots'> {
  dealer: { ownerName: string; phoneNumber: string };
}

export interface AvailabilitySlot {
  id: string;
  startHour: number;
  endHour: number;
  capacity: number;
  available: number;
}

export type ParkingBookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface ParkingBooking {
  id: string;
  listingId: string;
  vehicleId: string | null;
  startTime: string;
  endTime: string;
  amountPaise: number;
  status: ParkingBookingStatus;
  orderId: string | null;
  createdAt: string;
  actualCheckOutTime: string | null;
  extraAmountPaise: number | null;
  extraOrderId: string | null;
  listing?: { name: string; addressLine: string; city: string };
}

export interface ExtraPaymentInfo {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateBookingResult {
  booking: ParkingBooking;
  // null only in the narrow retry window where a prior request created the booking
  // but hadn't yet reached Razorpay — the screen should ask the user to retry.
  payment: { orderId: string; razorpayOrderId: string; amountPaise: number; currency: string; keyId: string } | null;
}

function unwrap<T>(res: { data?: T } | T): T {
  return ((res as any)?.data ?? res) as T;
}

export const parkingService = {
  search: async (params: {
    lat: number;
    lng: number;
    date: Date;
    startHour: number;
    endHour: number;
    radiusKm?: number;
  }): Promise<ParkingSearchResult[]> => {
    const query = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      date: params.date.toISOString(),
      startHour: String(params.startHour),
      endHour: String(params.endHour),
    });
    if (params.radiusKm != null) query.set('radiusKm', String(params.radiusKm));
    const res = await api.get<{ data?: ParkingSearchResult[] }>(`/v1/parking/search?${query.toString()}`);
    const data = unwrap<ParkingSearchResult[]>(res);
    return Array.isArray(data) ? data : [];
  },

  getListing: async (listingId: string): Promise<ParkingListingDetail> => {
    const res = await api.get<{ data?: ParkingListingDetail }>(`/v1/parking/listings/${listingId}`);
    return unwrap<ParkingListingDetail>(res);
  },

  getAvailability: async (listingId: string, date: Date): Promise<AvailabilitySlot[]> => {
    const query = new URLSearchParams({ date: date.toISOString() });
    const res = await api.get<{ data?: AvailabilitySlot[] }>(
      `/v1/parking/listings/${listingId}/availability?${query.toString()}`,
    );
    const data = unwrap<AvailabilitySlot[]>(res);
    return Array.isArray(data) ? data : [];
  },

  createBooking: async (input: {
    listingId: string;
    vehicleId: string;
    startTime: Date;
    endTime: Date;
    /** Same key across retries of one "Book & Pay" tap prevents a double booking on network retry. */
    idempotencyKey: string;
  }): Promise<CreateBookingResult> => {
    const res = await api.post<{ data?: CreateBookingResult }>('/v1/parking/bookings', {
      listingId: input.listingId,
      vehicleId: input.vehicleId,
      idempotencyKey: input.idempotencyKey,
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
    });
    return unwrap<CreateBookingResult>(res);
  },

  listMyBookings: async (params?: { page?: number; limit?: number }): Promise<{ data: ParkingBooking[]; pagination: Pagination }> => {
    const query = new URLSearchParams({
      page: String(params?.page ?? 1),
      limit: String(params?.limit ?? 20),
    });
    const res = await api.get<{ data?: { data: ParkingBooking[]; pagination: Pagination } }>(
      `/v1/parking/bookings?${query.toString()}`,
    );
    const result = unwrap<{ data: ParkingBooking[]; pagination: Pagination }>(res);
    return result?.data ? result : { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  },

  cancelBooking: async (bookingId: string): Promise<ParkingBooking> => {
    const res = await api.post<{ data?: ParkingBooking }>(`/v1/parking/bookings/${bookingId}/cancel`);
    return unwrap<ParkingBooking>(res);
  },

  joinWaitlist: async (listingId: string, desiredDate: Date): Promise<void> => {
    await api.post('/v1/parking/waitlist', { listingId, desiredDate: desiredDate.toISOString() });
  },

  leaveWaitlist: async (listingId: string, desiredDate: Date): Promise<void> => {
    const query = new URLSearchParams({ listingId, desiredDate: desiredDate.toISOString() });
    await api.delete(`/v1/parking/waitlist?${query.toString()}`);
  },

  getExtraPayment: async (bookingId: string): Promise<ExtraPaymentInfo> => {
    const res = await api.get<{ data?: ExtraPaymentInfo }>(`/v1/parking/bookings/${bookingId}/extra-payment`);
    return unwrap<ExtraPaymentInfo>(res);
  },
};

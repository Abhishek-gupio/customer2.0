import { api } from './api';

export type WashType =
  | 'EXTERIOR' | 'INTERIOR' | 'FOAM' | 'PRESSURE' | 'STEAM' | 'WATERLESS' | 'DETAILING'
  | 'CERAMIC_COATING' | 'WAX_POLISH' | 'ENGINE_CLEAN' | 'TYRE_POLISH' | 'GLASS_TREATMENT'
  | 'UNDERCARRIAGE' | 'SANITIZATION' | 'BIKE_WASH' | 'EV_SAFE_WASH';

export const WASH_TYPE_LABELS: Record<WashType, string> = {
  EXTERIOR: 'Exterior', INTERIOR: 'Interior', FOAM: 'Foam Wash', PRESSURE: 'Pressure Wash',
  STEAM: 'Steam Wash', WATERLESS: 'Waterless', DETAILING: 'Detailing', CERAMIC_COATING: 'Ceramic Coating',
  WAX_POLISH: 'Wax Polish', ENGINE_CLEAN: 'Engine Clean', TYRE_POLISH: 'Tyre Polish',
  GLASS_TREATMENT: 'Glass Treatment', UNDERCARRIAGE: 'Undercarriage', SANITIZATION: 'Sanitization',
  BIKE_WASH: 'Bike Wash', EV_SAFE_WASH: 'EV Safe Wash',
};

export type WashServiceModel = 'VISIT_CENTER' | 'DOORSTEP';

export type WashBookingStatus =
  | 'PENDING_PAYMENT' | 'CONFIRMED' | 'TECHNICIAN_ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export interface WashCenter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  supportsBike: boolean;
  supportsCar: boolean;
  supportsEV: boolean;
  partner: { name: string; rating: number | null };
}

export interface WashCenterDetail extends Omit<WashCenter, 'distanceKm'> {}

export interface WashSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  available: number;
}

export interface WashPartnerOption {
  id: string;
  name: string;
  rating: number | null;
}

export interface WashBooking {
  id: string;
  serviceModel: WashServiceModel;
  washType: WashType;
  status: WashBookingStatus;
  amountPaise: number;
  addressLine: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  createdAt: string;
  center?: { name: string; address: string; latitude?: number | null; longitude?: number | null } | null;
  partner?: { name: string } | null;
  technician?: { name: string; phoneNumber: string; photoUrl: string | null } | null;
}

export interface CreateBookingResult {
  booking: WashBooking;
  payment: { orderId: string; razorpayOrderId: string; amountPaise: number; currency: string; keyId: string } | null;
}

function unwrap<T>(res: { data?: T } | T): T {
  return ((res as any)?.data ?? res) as T;
}

export const carwashService = {
  searchCenters: async (params: { lat: number; lng: number; radiusKm?: number }): Promise<WashCenter[]> => {
    const query = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
    if (params.radiusKm != null) query.set('radiusKm', String(params.radiusKm));
    const res = await api.get<{ data?: WashCenter[] }>(`/v1/carwash/centers/nearby?${query.toString()}`);
    const data = unwrap<WashCenter[]>(res);
    return Array.isArray(data) ? data : [];
  },

  getCenter: async (centerId: string): Promise<WashCenterDetail> => {
    const res = await api.get<{ data?: WashCenterDetail }>(`/v1/carwash/centers/${centerId}`);
    return unwrap<WashCenterDetail>(res);
  },

  getSlots: async (centerId: string, date: Date): Promise<WashSlot[]> => {
    const query = new URLSearchParams({ date: date.toISOString() });
    const res = await api.get<{ data?: WashSlot[] }>(`/v1/carwash/centers/${centerId}/slots?${query.toString()}`);
    const data = unwrap<WashSlot[]>(res);
    return Array.isArray(data) ? data : [];
  },

  listPartners: async (): Promise<WashPartnerOption[]> => {
    const res = await api.get<{ data?: WashPartnerOption[] }>('/v1/carwash/partners');
    const data = unwrap<WashPartnerOption[]>(res);
    return Array.isArray(data) ? data : [];
  },

  createVisitCenterBooking: async (input: {
    centerId: string;
    slotId: string;
    washType: WashType;
    vehicleId?: string;
    idempotencyKey: string;
  }): Promise<CreateBookingResult> => {
    const res = await api.post<{ data?: CreateBookingResult }>('/v1/carwash/bookings', {
      serviceModel: 'VISIT_CENTER',
      centerId: input.centerId,
      slotId: input.slotId,
      washType: input.washType,
      vehicleId: input.vehicleId,
      idempotencyKey: input.idempotencyKey,
    });
    return unwrap<CreateBookingResult>(res);
  },

  createDoorstepBooking: async (input: {
    partnerId: string;
    washType: WashType;
    addressLine: string;
    latitude?: number;
    longitude?: number;
    vehicleId?: string;
    scheduledAt?: Date;
    idempotencyKey: string;
  }): Promise<CreateBookingResult> => {
    const res = await api.post<{ data?: CreateBookingResult }>('/v1/carwash/bookings', {
      serviceModel: 'DOORSTEP',
      partnerId: input.partnerId,
      washType: input.washType,
      addressLine: input.addressLine,
      latitude: input.latitude,
      longitude: input.longitude,
      vehicleId: input.vehicleId,
      scheduledAt: input.scheduledAt?.toISOString(),
      idempotencyKey: input.idempotencyKey,
    });
    return unwrap<CreateBookingResult>(res);
  },

  listMyBookings: async (): Promise<WashBooking[]> => {
    const res = await api.get<{ data?: WashBooking[] }>('/v1/carwash/bookings');
    const data = unwrap<WashBooking[]>(res);
    return Array.isArray(data) ? data : [];
  },

  getBooking: async (bookingId: string): Promise<WashBooking> => {
    const res = await api.get<{ data?: WashBooking }>(`/v1/carwash/bookings/${bookingId}`);
    return unwrap<WashBooking>(res);
  },

  cancelBooking: async (bookingId: string): Promise<WashBooking> => {
    const res = await api.post<{ data?: WashBooking }>(`/v1/carwash/bookings/${bookingId}/cancel`);
    return unwrap<WashBooking>(res);
  },
};

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('adminToken');
}

/** In-flight GET requests by key so duplicate calls reuse the same request (one API call instead of many). */
const inFlightGet = new Map<string, Promise<{ success: true; data: unknown } | { success: false; error: { message: string } }>>();

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { message: string } }> {
  const method = (options.method || 'GET').toUpperCase();
  const key = `${method}:${path}`;

  async function run(): Promise<{ success: true; data: T } | { success: false; error: { message: string } }> {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: { message: json?.error?.message ?? json?.message ?? 'Request failed' },
      };
    }
    return json as { success: true; data: T };
  }

  if (method === 'GET') {
    let promise = inFlightGet.get(key);
    if (!promise) {
      promise = run().finally(() => {
        inFlightGet.delete(key);
      });
      inFlightGet.set(key, promise);
    }
    return promise as Promise<{ success: true; data: T } | { success: false; error: { message: string } }>;
  }

  return run();
}

export const adminApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; expiresIn: number; admin: { id: string; email: string; name: string | null; role: string } }>(
      '/v1/admin/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  signup: (data: { email: string; password: string; name?: string; role?: string }) =>
    api<{ id: string; email: string; name: string | null; role: string }>(
      '/v1/admin/auth/signup',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  me: () => api<{ admin: { id: string; email: string; role: string } }>('/v1/admin/me'),
  forgotPassword: (email: string) =>
    api<{ message: string; otp?: string }>('/v1/admin/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
  verifyResetOtp: (email: string, otp: string) =>
    api<{ message: string; verified: boolean }>('/v1/admin/auth/verify-reset-otp', {
      method: 'POST', body: JSON.stringify({ email, otp }),
    }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    api<{ message: string }>('/v1/admin/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ email, otp, newPassword }),
    }),
  stats: (days: number = 7) =>
    api<{
      customers: number;
      vehicles: number;
      totalExpenses: number;
      expenseCount: number;
      supportTicketsOpen: number;
      unverifiedVehiclesCount: number;
      totalCustomersToday: number;
      recentHighExpenses: { id: string; amount: number; customer: { fullName: string }; category: string; date: string }[];
      expenseCategoryBreakdown: { category: string; amount: number; count: number }[];
      ticketPriorityDistribution: { priority: string; count: number }[];
      vehicleHealthDistribution: { critical: number; warning: number; good: number };
      trendData?: { date: string; label: string; customers: number; expenseAmount: number; tickets: number; vehicles: number }[];
      databaseAvailable?: boolean;
    }>(`/v1/admin/stats?days=${days}`),
  listCustomers: (params?: { page?: number; limit?: number; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);
    const q = sp.toString();
    return api<{ data: CustomerListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/customers${q ? `?${q}` : ''}`
    );
  },
  getCustomer: (id: string) => api<CustomerDetail>(`/v1/admin/customers/${id}`),
  listTickets: (params?: { page?: number; limit?: number; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);
    const q = sp.toString();
    return api<{ data: SupportTicketListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/tickets${q ? `?${q}` : ''}`
    );
  },
  getTicketMessages: (id: string) => api<TicketMessage[]>(`/v1/admin/tickets/${id}/messages`),
  addTicketMessage: (id: string, content: string) =>
    api<TicketMessage>(`/v1/admin/tickets/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  updateTicketStatus: (id: string, status: TicketStatus) =>
    api<{ success: true }>(`/v1/admin/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  listVehicles: (params?: { page?: number; limit?: number; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);
    const q = sp.toString();
    return api<{ data: AdminVehicleListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/vehicles${q ? `?${q}` : ''}`
    );
  },
};

export interface CustomerListItem {
  id: string;
  phoneNumber: string;
  email: string | null;
  fullName: string | null;
  profilePic: string | null;
  createdAt: string;
  _count: { vehicles: number; expenses: number; documents: number; supportTickets: number };
}

/** Vehicle-related data as returned by admin customer detail (matches app vehicle info). */
export interface AdminVehicleDetail {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  fuelType: string | null;
  vehicleType: string | null;
  currentOdometer: number | null;
  registrationDate: string | null;
  rcVerified: boolean;
  isActive: boolean;
  isPrimary: boolean;
  chassisNumber: string | null;
  engineNumber: string | null;
  imageUrl: string | null;
  _count: { challans: number; documents: number; expenses: number };
  healthScore: AdminVehicleHealthScore | null;
  telematicsDevice: AdminTelematicsDevice | null;
  accessList: AdminVehicleAccess[];
  challans: AdminChallan[];
  documents: AdminVehicleDocument[];
  odometerLogs: AdminOdometerLog[];
  serviceRecords: AdminServiceRecord[];
  drivingTrips: AdminDrivingTrip[];
}

export interface AdminVehicleHealthScore {
  id: string;
  overallScore: number;
  ageScore: number | null;
  mileageScore: number | null;
  maintenanceScore: number | null;
  drivingScore: number | null;
  explanations: unknown;
  recommendations: unknown;
  lastCalculated: string;
  nextDueDate: string | null;
}

export interface AdminTelematicsDevice {
  id: string;
  instanceId: string;
  platform: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
}

export interface AdminVehicleAccess {
  id: string;
  role: string;
  customer: { id: string; fullName: string | null; email: string | null; phoneNumber: string };
}

export interface AdminChallan {
  id: string;
  challanNumber: string;
  amount: number;
  status: string;
  date: string;
  violationType: string;
  location: string | null;
  source: string;
}

export interface AdminVehicleDocument {
  id: string;
  type: string;
  verificationStatus: string | null;
  expiryDate: string | null;
  documentNumber: string | null;
  fileUrl?: string | null;
  downloadUrl?: string | null;
  mimeType?: string | null;
}

export interface AdminOdometerLog {
  id: string;
  reading: number;
  date: string;
}

export interface AdminServiceRecord {
  id: string;
  serviceType: string;
  garageName: string | null;
  odometerAtService: number | null;
  serviceDate: string;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
  notes: string | null;
  parts: AdminServicePart[];
}

export interface AdminServicePart {
  id: string;
  partType: string;
  partName: string | null;
  brand: string | null;
  cost: number | null;
  warrantyMonths: number | null;
  warrantyKm: number | null;
}

export interface AdminDrivingTrip {
  id: string;
  tripId: string;
  startTime: string;
  endTime: string;
  distanceKm: number;
  durationMin: number;
  maxSpeed: number | null;
  avgSpeed: number | null;
  safetyScore: number;
  status: string;
}

export interface CustomerDetail {
  id: string;
  phoneNumber: string;
  email: string | null;
  fullName: string | null;
  profilePic: string | null;
  createdAt: string;
  updatedAt: string;
  vehicles: AdminVehicleDetail[];
  devices: unknown[];
  emergencyContacts: unknown[];
  digilocker: unknown;
  _count: { vehicles: number; expenses: number; documents: number; supportTickets: number; chats: number; sosRequests: number };
  expenses?: any[];
  documents?: AdminVehicleDocument[];
  supportTickets?: SupportTicket[];
  expenseSummary?: {
    total: number;
    breakdown: Record<string, number>;
    currency: string;
  };
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'VEHICLE' | 'APP_ISSUE' | 'OTHER' | 'DOCUMENTS' | 'VALET' | 'AI_ASSISTANT' | 'ACCOUNT';

export interface SupportTicketListItem {
  id: string;
  customerId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  customer: { id: string; fullName: string | null; phoneNumber: string; email: string | null };
  _count: { messages: number };
}

export interface SupportTicket extends SupportTicketListItem {
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

export interface AdminVehicleListItem {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  fuelType: string | null;
  vehicleType: string | null;
  ownerName: string | null;
  rcVerified: boolean;
  isActive: boolean;
  createdAt: string;
  customer: { id: string; fullName: string | null; phoneNumber: string; email: string | null };
  _count: { challans: number; documents: number; expenses: number };
}

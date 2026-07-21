import type { ListingLiveStatus, LiveListingSummary, WalkInHistoryEntry } from './dealerClient';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

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
    const headers: Record<string, string> = { ...options.headers as Record<string, string> };

    // Automatically set Content-Type to JSON if it's not FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = `${API_BASE}${path}`;
    console.log(`API Call: ${method} ${fullUrl}`);
    const res = await fetch(fullUrl, { ...options, headers });

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
      recentHighExpenses: { id: string; amount: number; customer: { id: string; fullName: string }; category: string; date: string }[];
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
  getExpense: (id: string) => api<AdminExpenseDetail>(`/v1/admin/expenses/${id}`),
  listExpenses: (params?: { page?: number; limit?: number; search?: string; customerId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);
    if (params?.customerId) sp.set('customerId', params.customerId);
    const q = sp.toString();
    return api<{ data: AdminExpenseListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/expenses${q ? `?${q}` : ''}`
    );
  },
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
  listVehicles: (params?: { page?: number; limit?: number; search?: string; type?: string; healthStatus?: string; verificationStatus?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);
    if (params?.type) sp.set('type', params.type);
    if (params?.healthStatus) sp.set('healthStatus', params.healthStatus);
    if (params?.verificationStatus) sp.set('verificationStatus', params.verificationStatus);
    const q = sp.toString();
    return api<{ data: AdminVehicleListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/vehicles${q ? `?${q}` : ''}`
    );
  },
  deleteCustomers: (customerIds: string[]) =>
    api<{ count: number }>(`/v1/admin/customers`, {
      method: 'DELETE',
      body: JSON.stringify({ customerIds }),
    }),
  updateCustomer: (id: string, data: { fullName?: string; email?: string; phoneNumber?: string }) =>
    api<any>(`/v1/admin/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  listCatalogVehicles: (params?: { type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set('type', params.type);
    const q = sp.toString();
    return api<CatalogVehicle[]>(`/v1/admin/catalog/vehicles${q ? `?${q}` : ''}`);
  },
  createCatalogVehicle: (formData: FormData) =>
    api<CatalogVehicle>('/v1/admin/catalog/vehicles', { method: 'POST', body: formData }),
  createCatalogVehicleAsset: (catalogId: string, file: File, imageType = 'HERO') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('imageType', imageType);
    return api<{ id: string; assetUrl: string; type: string; assetIndex: number }>(
      `/v1/admin/catalog/vehicles/${catalogId}/assets`,
      { method: 'POST', body: formData }
    );
  },
  updateCatalogVehicleAsset: (catalogId: string, assetId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api<any>(`/v1/admin/catalog/vehicles/${catalogId}/assets/${assetId}`, {
      method: 'PATCH',
      body: formData,
      // The API wrapper should NOT set Content-Type header when body is FormData
    });
  },
  listAdmins: (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);
    if (params?.role) sp.set('role', params.role);
    const q = sp.toString();
    return api<{ data: AdminUserListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/manage/admins${q ? `?${q}` : ''}`
    );
  },
  deleteAdmins: (adminIds: string[]) =>
    api<{ count: number }>(`/v1/admin/manage/admins`, {
      method: 'DELETE',
      body: JSON.stringify({ adminIds }),
    }),
  toggleSupportCustomerAccess: (id: string) =>
    api<{ enabled: boolean }>(`/v1/admin/manage/admins/${id}/toggle-support-customers`, {
      method: 'POST',
    }),
  toggleAdminStatus: (id: string) =>
    api<{ isActive: boolean }>(`/v1/admin/manage/admins/${id}/toggle-status`, {
      method: 'PATCH',
    }),

  createParkingDealer: (data: any) =>
    api<ParkingDealerListItem>('/v1/parking/admin/dealers', { method: 'POST', body: JSON.stringify(data) }),
  listParkingDealers: () => api<ParkingDealerListItem[]>('/v1/parking/admin/dealers'),
  updateDealerCommission: (dealerId: string, commissionRate: number) =>
    api<ParkingDealerListItem>(`/v1/parking/admin/dealers/${dealerId}/commission`, {
      method: 'PATCH',
      body: JSON.stringify({ commissionRate }),
    }),
  listParkingLiveListings: () => api<LiveListingSummary[]>('/v1/parking/admin/live-listings'),
  getParkingListingLiveStatus: (listingId: string) =>
    api<ListingLiveStatus>(`/v1/parking/admin/listings/${listingId}/live`),
  getParkingWalkInHistory: (listingId: string) =>
    api<WalkInHistoryEntry[]>(`/v1/parking/admin/listings/${listingId}/walkins/history`),

  createWashPartner: (data: { name: string; phoneNumber: string; password: string }) =>
    api<WashPartnerListItem>('/v1/carwash/admin/partners', { method: 'POST', body: JSON.stringify(data) }),
  listWashPartners: () => api<WashPartnerListItem[]>('/v1/carwash/admin/partners'),

  listPaymentOrders: (params?: { status?: string; stuckOnly?: boolean; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.stuckOnly) sp.set('stuckOnly', 'true');
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return api<{ data: PaymentOrderListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/payments/admin/orders${q ? `?${q}` : ''}`
    );
  },

  // Vehicle QR Messaging moderation
  listMessagingReports: (status?: string) =>
    api<MessagingReport[]>(`/v1/admin/messaging/reports${status ? `?status=${status}` : ''}`),
  resolveMessagingReport: (id: string, status: 'REVIEWED' | 'DISMISSED' | 'ACTIONED') =>
    api<MessagingReport>(`/v1/admin/messaging/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  listMessagingConversations: (params?: { page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return api<{ data: MessagingConversationListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/v1/admin/messaging/conversations${q ? `?${q}` : ''}`
    );
  },
  deleteMessagingConversation: (id: string) =>
    api<{ ok: boolean }>(`/v1/admin/messaging/conversations/${id}`, { method: 'DELETE' }),
  suspendMessagingCustomer: (id: string, reason: string) =>
    api<{ id: string; isSuspended: boolean }>(`/v1/admin/messaging/customers/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  unsuspendMessagingCustomer: (id: string) =>
    api<{ id: string; isSuspended: boolean }>(`/v1/admin/messaging/customers/${id}/unsuspend`, { method: 'POST' }),
  getMessagingAnalytics: () => api<MessagingAnalytics>('/v1/admin/messaging/analytics'),

  // Community platform moderation
  listCommunityReports: (status?: string) =>
    api<CommunityReport[]>(`/v1/admin/community/reports${status ? `?status=${status}` : ''}`),
  resolveCommunityReport: (id: string, status: 'REVIEWED' | 'DISMISSED' | 'ACTIONED') =>
    api<CommunityReport>(`/v1/admin/community/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getCommunityAnalytics: () => api<CommunityAnalytics>('/v1/admin/community/analytics'),
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

export interface AdminExpenseDetail {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  receiptUrl: string | null;
  verificationStatus: string;
  customerId: string;
  customer?: {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string | null;
    profilePic: string | null;
  };
  vehicle?: {
    id: string;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    imageUrl: string | null;
  };
}

export interface AdminExpenseListItem {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  receiptUrl: string | null;
  verificationStatus: string;
  customerId: string;
  customer?: {
    id: string;
    fullName: string;
    phoneNumber: string;
  };
  vehicle?: {
    id: string;
    registrationNumber: string;
  };
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
  resolvedBy?: string | null;
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
  healthScore?: AdminVehicleHealthScore | null;
  _count: { challans: number; documents: number; expenses: number };
}

export interface CatalogVehicle {
  id: string;
  vehicleType: string;
  make: string;
  model: string;
  variant: string | null;
  normalizedKey: string;
  images: { id: string; assetUrl: string; type: string; assetIndex: number }[];
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  canAccessCustomers: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  canAccessCustomers?: boolean;
}

export interface ParkingDealerListItem {
  id: string;
  ownerName: string;
  phoneNumber: string;
  email: string | null;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'SUSPENDED';
  commissionRate: number;
  createdAt: string;
  _count?: { listings: number };
}

export interface WashPartnerListItem {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  rating: number | null;
  createdAt: string;
  _count?: { centers: number; technicians: number; bookings: number };
}

export interface PaymentOrderListItem {
  id: string;
  purpose: string;
  referenceId: string;
  amountPaise: number;
  currency: string;
  status: 'CREATED' | 'ATTEMPTED' | 'PAID' | 'FAILED' | 'CANCELLED';
  razorpayOrderId: string | null;
  createdAt: string;
  isStuck: boolean;
  customer: { id: string; fullName: string | null; phoneNumber: string };
  attempts: { id: string; status: string; failureReason: string | null; razorpayPaymentId: string | null }[];
  refunds: { id: string; status: string; amountPaise: number }[];
}

export interface MessagingReport {
  id: string;
  conversationId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
  createdAt: string;
  resolvedAt: string | null;
  conversation?: { vehicle: { registrationNumber: string } };
}

export interface MessagingConversationListItem {
  id: string;
  category: string;
  priority: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  status: 'OPEN' | 'WAITING_FOR_OWNER' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  lastMessage: string | null;
  updatedAt: string;
  createdAt: string;
  vehicle: { registrationNumber: string };
  customer: { fullName: string | null; phoneNumber: string };
  owner: { fullName: string | null; phoneNumber: string };
  _count: { messages: number; reports: number };
}

export interface MessagingAnalytics {
  totalConversations: number;
  totalMessages: number;
  resolutionRate: number;
  pendingReports: number;
  dailyActiveConversations: number;
  avgOwnerResponseTimeMinutes: number | null;
  mostReportedConversationIds: { conversationId: string; reportCount: number }[];
}

export interface CommunityReport {
  id: string;
  reporterId: string;
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
  createdAt: string;
  resolvedAt: string | null;
  reporter?: { id: string; fullName: string | null; phoneNumber: string };
}

export interface CommunityAnalytics {
  totalCommunities: number;
  totalPosts: number;
  totalComments: number;
  pendingReports: number;
}



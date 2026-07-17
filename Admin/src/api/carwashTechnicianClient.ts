const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getTechnicianToken(): string | null {
  return localStorage.getItem('washTechnicianToken');
}

/**
 * Mirrors carwashPartnerClient.ts's partnerApiRequest but authenticates with
 * the technician JWT — a separate, least-privilege credential from the
 * partner (business owner) that manages them.
 */
export async function technicianApiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { message: string } }> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getTechnicianToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: { message: json?.error?.message ?? json?.message ?? 'Request failed' } };
  }
  return json as { success: true; data: T };
}

export interface TechnicianJob {
  id: string;
  serviceModel: 'VISIT_CENTER' | 'DOORSTEP';
  washType: string;
  status: 'TECHNICIAN_ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  amountPaise: number;
  addressLine: string | null;
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  createdAt: string;
  customer: { fullName: string | null; phoneNumber: string };
}

export const technicianApi = {
  login: (phoneNumber: string, password: string) =>
    technicianApiRequest<{ accessToken: string; expiresIn: number; technician: { id: string; name: string } }>(
      '/v1/carwash/technician/auth/login',
      { method: 'POST', body: JSON.stringify({ phoneNumber, password }) },
    ),

  listJobs: () => technicianApiRequest<TechnicianJob[]>('/v1/carwash/technician/jobs'),

  uploadBeforePhotos: (jobId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    return technicianApiRequest<TechnicianJob>(`/v1/carwash/technician/jobs/${jobId}/before-photos`, {
      method: 'POST',
      body: formData,
    });
  },

  completeJob: (jobId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    return technicianApiRequest<TechnicianJob>(`/v1/carwash/technician/jobs/${jobId}/complete`, {
      method: 'POST',
      body: formData,
    });
  },
};

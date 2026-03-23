import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { getAccessToken } from './storage';
import { api } from './api';

const DOCUMENTS_URL = `${API_BASE_URL}/api/v1/documents`;

const DOC_TYPE_MAP: Record<string, string> = {
  RC: 'RC',
  Insurance: 'INSURANCE',
  PUC: 'PUC',
  FASTag: 'FASTAG',
  DL: 'DL',
  Other: 'OTHER',
};

export const BACKEND_TYPE_MAP: Record<string, string> = {
  RC: 'RC',
  INSURANCE: 'Insurance',
  PUC: 'PUC',
  FASTAG: 'FASTag',
  DL: 'DL',
  OTHER: 'Other',
};

export interface UploadDocumentParams {
  type: string;
  fileUri: string;
  fileName?: string;
  mimeType?: string;
  vehicleId?: string;
  documentNumber?: string;
}

export interface DocumentResponse {
  id: string;
  customerId: string;
  vehicleId: string | null;
  type: string;
  documentNumber: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  issuerName?: string | null;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  ocrData?: any;
  extractedFields?: any;
  verificationStatus?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  vehicle?: { registrationNumber?: string } | null;
  dates?: string[];
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/** Result of pre-upload image quality check (A3: reduce failed uploads). */
export interface ImageQualityResult {
  ok: boolean;
  hints: string[];
}

/** Pre-upload check: blur and glare. Call before upload for documents/receipts. */
export async function checkImageQuality(
  fileUri: string,
  fileName?: string,
  mimeType?: string,
): Promise<ImageQualityResult> {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName || `image_${Date.now()}.jpg`,
      type: mimeType || 'image/jpeg',
    } as any);
    const res = await api.upload<{ success?: boolean; data?: ImageQualityResult; ok?: boolean; hints?: string[] }>(
      '/v1/documents/check-image-quality',
      formData,
    );
    const data = (res as any)?.data ?? res;
    return {
      ok: data?.ok ?? true,
      hints: Array.isArray(data?.hints) ? data.hints : [],
    };
  } catch {
    return { ok: true, hints: [] };
  }
}

export async function uploadDocument(params: UploadDocumentParams): Promise<DocumentResponse> {
  const formData = new FormData();

  formData.append('file', {
    uri: params.fileUri,
    name: params.fileName || `document_${Date.now()}.jpg`,
    type: params.mimeType || 'image/jpeg',
  } as any);

  formData.append('type', DOC_TYPE_MAP[params.type] || 'OTHER');
  if (params.vehicleId) formData.append('vehicleId', params.vehicleId);
  if (params.documentNumber) formData.append('documentNumber', params.documentNumber);

  const token = getAccessToken();
  if (!token) {
    console.warn('No access token found for document upload');
    throw new Error('You are not logged in. Please sign in again.');
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  // Debug: log token (remove in production)
  if (__DEV__) console.log('UploadDocument: using token', token);

  const res = await fetch(DOCUMENTS_URL, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || 'Upload failed');
  return data.data ?? data;
}

export async function listDocuments(): Promise<DocumentResponse[]> {
  const res = await fetch(DOCUMENTS_URL, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to fetch documents');
  return data.data ?? [];
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const res = await fetch(`${DOCUMENTS_URL}/${id}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Document not found');
  return data.data ?? data;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${DOCUMENTS_URL}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.message || 'Failed to delete');
  }
}

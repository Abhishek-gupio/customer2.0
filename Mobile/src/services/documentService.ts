import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { getAccessToken } from './storage';
import { api } from './api';
import { clearCachedValue, getCachedValue, getStaleCachedValue, setCachedValue } from './cache';

const DOCUMENTS_URL = `${API_BASE_URL}/api/v1/documents`;
const DOCUMENTS_CACHE_KEY = 'cache:documents:list';
const DOCUMENTS_CACHE_TTL_MS = 5 * 60 * 1000;

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

  const res = await api.upload<any>('/v1/documents', formData);
  clearCachedValue(DOCUMENTS_CACHE_KEY);
  return res.data ?? res;
}

export async function listDocuments(): Promise<DocumentResponse[]> {
  try {
    const res = await api.get<any>('/v1/documents');
    const docs = res.data ?? [];
    setCachedValue(DOCUMENTS_CACHE_KEY, docs, DOCUMENTS_CACHE_TTL_MS);
    return docs;
  } catch (error) {
    const cached = getCachedValue<DocumentResponse[]>(DOCUMENTS_CACHE_KEY) || getStaleCachedValue<DocumentResponse[]>(DOCUMENTS_CACHE_KEY);
    if (cached) return cached;
    throw error;
  }
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const res = await api.get<any>(`/v1/documents/${id}`);
  return res.data ?? res;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/v1/documents/${id}`);
  clearCachedValue(DOCUMENTS_CACHE_KEY);
}

export async function syncDigiLocker(client_id?: string): Promise<any> {
    return api.post('/v1/documents/digilocker/sync', { client_id });
}

export async function connectDigiLocker(): Promise<{ url: string; client_id: string }> {
  try {
    // res here is already the full JSON { status, data, message }
    // We need to return the INNER data object which contains url and client_id
    const res = await api.get<any>('/v1/documents/digilocker/connect');
    return res.data || res; 
  } catch (error: any) {
    throw new Error(error.message || 'Failed to connect to DigiLocker');
  }
}

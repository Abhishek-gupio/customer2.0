import { getStorageValue, setStorageValue } from './storage';
import { uploadDocument, type UploadDocumentParams, type DocumentResponse } from './documentService';
import { api } from './api';
import { clearCachedValue } from './cache';

const DOCUMENT_UPLOAD_QUEUE_KEY = 'queue:document-uploads';
const EXPENSE_CREATE_QUEUE_KEY = 'queue:expense-create';

type QueuedDocumentUpload = UploadDocumentParams & {
  queuedAt: number;
};

function readQueue(): QueuedDocumentUpload[] {
  try {
    const raw = getStorageValue(DOCUMENT_UPLOAD_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function getQueuedDocumentUploadCount(): number {
  return readQueue().length;
}

function writeQueue(queue: QueuedDocumentUpload[]): void {
  setStorageValue(DOCUMENT_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
}

export async function queueDocumentUpload(params: UploadDocumentParams): Promise<void> {
  const queue = readQueue();
  queue.push({ ...params, queuedAt: Date.now() });
  writeQueue(queue);
}

export async function flushQueuedDocumentUploads(
  onSuccess?: (doc: DocumentResponse, queued: UploadDocumentParams) => void,
): Promise<{ uploaded: number; remaining: number }> {
  const queue = readQueue();
  if (!queue.length) return { uploaded: 0, remaining: 0 };

  const remaining: QueuedDocumentUpload[] = [];
  let uploaded = 0;

  for (const item of queue) {
    try {
      const doc = await uploadDocument(item);
      uploaded += 1;
      onSuccess?.(doc, item);
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  if (uploaded > 0) clearCachedValue('cache:documents:list');
  return { uploaded, remaining: remaining.length };
}

type QueuedExpenseCreate = {
  payload: Record<string, unknown>;
  queuedAt: number;
};

function readExpenseQueue(): QueuedExpenseCreate[] {
  try {
    const raw = getStorageValue(EXPENSE_CREATE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function getQueuedExpenseCreateCount(): number {
  return readExpenseQueue().length;
}

function writeExpenseQueue(queue: QueuedExpenseCreate[]): void {
  setStorageValue(EXPENSE_CREATE_QUEUE_KEY, JSON.stringify(queue));
}

export async function queueExpenseCreate(payload: Record<string, unknown>): Promise<void> {
  const queue = readExpenseQueue();
  queue.push({ payload, queuedAt: Date.now() });
  writeExpenseQueue(queue);
}

export async function flushQueuedExpenseCreates(
  onSuccess?: (payload: Record<string, unknown>, response: any) => void,
): Promise<{ uploaded: number; remaining: number }> {
  const queue = readExpenseQueue();
  if (!queue.length) return { uploaded: 0, remaining: 0 };

  const remaining: QueuedExpenseCreate[] = [];
  let uploaded = 0;

  for (const item of queue) {
    try {
      const response = await api.post('/v1/expenses', item.payload);
      uploaded += 1;
      onSuccess?.(item.payload, response);
    } catch {
      remaining.push(item);
    }
  }

  writeExpenseQueue(remaining);
  if (uploaded > 0) {
    clearCachedValue('cache:expenses:list');
    clearCachedValue('cache:home:primaryVehicle');
  }
  return { uploaded, remaining: remaining.length };
}

export function getQueuedActionSummary() {
  return {
    documentUploads: getQueuedDocumentUploadCount(),
    expenseCreates: getQueuedExpenseCreateCount(),
  };
}

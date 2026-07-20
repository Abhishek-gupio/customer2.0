import { getStorageValue, setStorageValue } from './storage';
import { uploadDocument, type UploadDocumentParams, type DocumentResponse } from './documentService';
import { api, getNetworkOnlineState, subscribeNetworkState } from './api';
import { clearCachedValue } from './cache';
import { telematicsApi, type InHouseTripPayload } from '../api/telematics';

const DOCUMENT_UPLOAD_QUEUE_KEY = 'queue:document-uploads';
const EXPENSE_CREATE_QUEUE_KEY = 'queue:expense-create';
const INHOUSE_TRIP_UPLOAD_QUEUE_KEY = 'queue:inhouse-trip-upload';

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

type QueuedInHouseTripUpload = {
  payload: InHouseTripPayload;
  queuedAt: number;
};

function readInHouseTripQueue(): QueuedInHouseTripUpload[] {
  try {
    const raw = getStorageValue(INHOUSE_TRIP_UPLOAD_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeInHouseTripQueue(queue: QueuedInHouseTripUpload[]): void {
  setStorageValue(INHOUSE_TRIP_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
}

export function getQueuedInHouseTripUploadCount(): number {
  return readInHouseTripQueue().length;
}

export async function queueInHouseTripUpload(payload: InHouseTripPayload): Promise<number> {
  const queue = readInHouseTripQueue();
  queue.push({ payload, queuedAt: Date.now() });
  writeInHouseTripQueue(queue);
  return queue.length;
}

export async function flushQueuedInHouseTripUploads(
  onSuccess?: (payload: InHouseTripPayload) => void,
): Promise<{ uploaded: number; remaining: number }> {
  const queue = readInHouseTripQueue();
  if (!queue.length) return { uploaded: 0, remaining: 0 };

  const remaining: QueuedInHouseTripUpload[] = [];
  let uploaded = 0;

  for (const item of queue) {
    try {
      await telematicsApi.submitInHouseTrip(item.payload);
      uploaded += 1;
      onSuccess?.(item.payload);
    } catch {
      remaining.push(item);
    }
  }

  writeInHouseTripQueue(remaining);
  return { uploaded, remaining: remaining.length };
}

let autoSyncInitialized = false;
let autoSyncInFlight = false;
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

async function flushAllQueuesSilently(): Promise<void> {
  if (autoSyncInFlight) return;
  autoSyncInFlight = true;
  try {
    await Promise.all([
      flushQueuedDocumentUploads(),
      flushQueuedExpenseCreates(),
      flushQueuedInHouseTripUploads(),
    ]);
  } catch {
    // best-effort flush
  } finally {
    autoSyncInFlight = false;
  }
}

export function initializeOfflineQueueAutoSync(): void {
  if (autoSyncInitialized) return;
  autoSyncInitialized = true;

  subscribeNetworkState((online) => {
    if (online) {
      flushAllQueuesSilently().catch(() => {});
    }
  });

  if (getNetworkOnlineState()) {
    flushAllQueuesSilently().catch(() => {});
  }

  // Safety net: periodically retry queues even when no network-state transition is emitted.
  autoSyncInterval = setInterval(() => {
    if (getNetworkOnlineState()) {
      flushAllQueuesSilently().catch(() => {});
    }
  }, 20000);
}

export function getQueuedActionSummary() {
  return {
    documentUploads: getQueuedDocumentUploadCount(),
    expenseCreates: getQueuedExpenseCreateCount(),
    inHouseTripUploads: getQueuedInHouseTripUploadCount(),
  };
}

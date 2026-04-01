import { getStorageValue, removeStorageValue, setStorageValue } from './storage';

type CacheEntry<T> = {
  value: T;
  savedAt: number;
  ttlMs: number;
};

function safeParse<T>(value: string | undefined): CacheEntry<T> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CacheEntry<T>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'savedAt' in parsed &&
      'ttlMs' in parsed &&
      'value' in parsed
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function getCachedValue<T>(key: string): T | null {
  const entry = safeParse<T>(getStorageValue(key));
  if (!entry) return null;
  const expired = Date.now() - entry.savedAt > entry.ttlMs;
  return expired ? null : entry.value;
}

export function getStaleCachedValue<T>(key: string): T | null {
  const entry = safeParse<T>(getStorageValue(key));
  return entry ? entry.value : null;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  const payload: CacheEntry<T> = {
    value,
    savedAt: Date.now(),
    ttlMs,
  };
  setStorageValue(key, JSON.stringify(payload));
}

export function clearCachedValue(key: string): void {
  removeStorageValue(key);
}

export function clearCachedValuesByPrefix(prefix: string): void {
  try {
    const keys = [
      // Known cache keys are small and stored in app storage. We only scan the
      // keys we explicitly use for cached API payloads.
      'cache:documents:list',
      'cache:vehicles:list',
      'cache:notifications:list',
      'cache:expenses:list',
      'cache:home:location',
      'cache:home:primaryVehicle',
    ];
    for (const key of keys) {
      if (key.startsWith(prefix)) removeStorageValue(key);
    }
  } catch {
    // Cache invalidation must never block app flow.
  }
}

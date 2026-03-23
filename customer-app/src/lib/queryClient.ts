import { QueryClient } from '@tanstack/react-query';

/**
 * PRODUCTION-READY: React Query client configuration
 * Optimized for network reliability and preventing duplicate requests
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 1 minute (location data changes frequently)
      staleTime: 1 * 60 * 1000, // 1 minute
      // Keep cached data for 5 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes (replaces cacheTime)
      // Retry failed requests automatically
      retry: 3, // Retry 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      // Refetch on reconnect (fixes network issues)
      refetchOnReconnect: true,
      // Don't refetch on window focus (mobile apps don't have windows)
      refetchOnWindowFocus: false,
      // Refetch on mount to get fresh data
      refetchOnMount: true,
      // Network mode: prefer online, fallback to cache
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});


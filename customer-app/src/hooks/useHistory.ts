import { useState, useEffect, useCallback } from 'react';
import {
  getVehicleHistory,
  getCustomerVehicleHistory,
  HistoryRecord,
  HistoryFilters,
} from '../services/historyApi';
import authStorage from '../services/authStorage';

export interface UseHistoryReturn {
  data: HistoryRecord[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  resetPagination: () => void;
}

export const useHistory = (filters?: HistoryFilters): UseHistoryReturn => {
  const [data, setData] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchHistory = useCallback(
    async (page: number = 1, shouldAppend: boolean = false) => {
      try {
        setError(null);
        if (!shouldAppend) {
          setLoading(true);
        }

        // Check if customer is logged in
        const user = await authStorage.getUser();
        const isCustomer = !!(user && (user.id || user.email || user.phoneNumber));

        let response;
        
        // Use customer-specific endpoint if customer is logged in
        if (isCustomer) {
          // Use the dedicated customer vehicle history endpoint
          // This endpoint automatically filters by the authenticated customer's ID
          response = await getCustomerVehicleHistory({
            ...filters,
            page,
            limit: 50, // Reasonable page size for customer history
          });
        } else {
          // Use general history endpoint for non-customer users
          response = await getVehicleHistory({
            ...filters,
            page,
            limit: 10,
          });
        }

        const newData = response.data.history as HistoryRecord[];

        if (shouldAppend) {
          setData((prevData) => [...prevData, ...newData]);
        } else {
          setData(newData);
        }

        // Set pagination metadata
        setCurrentPage(response.data.pagination.currentPage);
        setTotalPages(response.data.pagination.totalPages);
        setTotalRecords(response.data.pagination.totalRecords);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch history';
        setError(errorMessage);
        console.error('Error fetching history:', err);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  // Fetch initial data
  useEffect(() => {
    setCurrentPage(1);
    setData([]);
    fetchHistory(1, false);
  }, [filters, fetchHistory]);

  const loadMore = useCallback(async () => {
    if (currentPage < totalPages) {
      await fetchHistory(currentPage + 1, true);
    }
  }, [currentPage, totalPages, fetchHistory]);

  const refetch = useCallback(async () => {
    await fetchHistory(1, false);
  }, [fetchHistory]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setData([]);
  }, []);

  return {
    data,
    loading,
    error,
    hasMore: currentPage < totalPages,
    currentPage,
    totalPages,
    totalRecords,
    refetch,
    loadMore,
    resetPagination,
  };
};

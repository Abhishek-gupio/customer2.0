import { useCallback, useState } from 'react';
import { vehicleService, type Vehicle } from '../../../services/vehicleService';
import { api } from '../../../services/api';
import {
  getCachedValue,
  getStaleCachedValue,
  setCachedValue,
} from '../../../services/cache';
import { getLastOdometerUpdate } from '../../../services/storage';

const HOME_PRIMARY_VEHICLE_CACHE_KEY = 'cache:home:primaryVehicle';
const HOME_CACHE_TTL_MS = 10 * 60 * 1000;

export function useHomeVehicle() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(() =>
    getStaleCachedValue<Vehicle>(HOME_PRIMARY_VEHICLE_CACHE_KEY),
  );
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [serviceDueText, setServiceDueText] = useState('Checking...');
  const [serviceAlertCount, setServiceAlertCount] = useState(0);
  const [serviceDueSoonCount, setServiceDueSoonCount] = useState(0);
  const [monthlySpendTotal, setMonthlySpendTotal] = useState<number | null>(
    null,
  );
  const [monthlyExpenseCount, setMonthlyExpenseCount] = useState(0);
  const [expenseAlertCount, setExpenseAlertCount] = useState(0);
  const [expenseHeadline, setExpenseHeadline] = useState(
    'Track monthly spend and smart alerts.',
  );
  const [showOdometerSlide, setShowOdometerSlide] = useState(false);

  const fetchExpenseHighlights = useCallback(async (vehicleId?: string) => {
    try {
      const [expenseResponse, insightsResponse] = await Promise.allSettled([
        api.get<any>(
          vehicleId ? `/v1/expenses?vehicleId=${vehicleId}` : '/v1/expenses',
        ),
        api.get<any>('/v1/expenses/insights'),
      ]);

      const expensePayload =
        expenseResponse.status === 'fulfilled'
          ? ((expenseResponse.value as any)?.data ?? expenseResponse.value)
          : null;
      const expenseItems =
        expensePayload?.expenses ??
        expensePayload?.data?.expenses ??
        expensePayload?.data ??
        [];
      const normalizedExpenses = Array.isArray(expenseItems)
        ? expenseItems
        : [];
      const currentDate = new Date();
      const currentMonthExpenses = normalizedExpenses.filter((item: any) => {
        const expenseDate = new Date(item?.date);
        return (
          !Number.isNaN(expenseDate.getTime()) &&
          expenseDate.getMonth() === currentDate.getMonth() &&
          expenseDate.getFullYear() === currentDate.getFullYear()
        );
      });

      const currentMonthTotal = currentMonthExpenses.reduce(
        (sum: number, item: any) => {
          const amount =
            typeof item?.amount === 'number'
              ? item.amount
              : Number(item?.amount || 0);
          return Number.isFinite(amount) ? sum + amount : sum;
        },
        0,
      );

      setMonthlySpendTotal(currentMonthTotal);
      setMonthlyExpenseCount(currentMonthExpenses.length);

      const insightsPayload =
        insightsResponse.status === 'fulfilled'
          ? ((insightsResponse.value as any)?.data ?? insightsResponse.value)
          : null;
      const smartTips = Array.isArray(insightsPayload?.smartTips)
        ? insightsPayload.smartTips
        : Array.isArray(insightsPayload?.weeklyDigest?.tips)
          ? insightsPayload.weeklyDigest.tips
          : [];
      const flaggedTips = smartTips.filter((tip: string) =>
        /(up|review|consider|over|high|cut|spend|fuel)/i.test(tip),
      );

      setExpenseAlertCount(flaggedTips.length);

      if (smartTips[0]) {
        setExpenseHeadline(
          String(smartTips[0])
            .replace(/[^\x20-\x7E\u20B9]/g, '')
            .trim() || 'Smart spend insight available.',
        );
      } else if (currentMonthExpenses.length > 0) {
        setExpenseHeadline(
          `${currentMonthExpenses.length} expense${
            currentMonthExpenses.length === 1 ? '' : 's'
          } recorded this month.`,
        );
      } else {
        setExpenseHeadline('No expenses recorded this month yet.');
      }
    } catch (error) {
      console.warn('Could not fetch expense highlights for home', error);
      setMonthlySpendTotal(null);
      setMonthlyExpenseCount(0);
      setExpenseAlertCount(0);
      setExpenseHeadline('Track monthly spend and smart alerts.');
    }
  }, []);

  const fetchPrimaryVehicle = useCallback(async () => {
    try {
      setVehicleLoading(true);
      const cachedPrimary = getCachedValue<Vehicle>(
        HOME_PRIMARY_VEHICLE_CACHE_KEY,
      );
      if (cachedPrimary) {
        setVehicle(cachedPrimary);
      }

      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(item => item.isPrimary) || vehicles[0];

      if (primary) {
        setVehicle(primary);
        setCachedValue(
          HOME_PRIMARY_VEHICLE_CACHE_KEY,
          primary,
          HOME_CACHE_TTL_MS,
        );

        const lastUpdate = getLastOdometerUpdate(primary.id);
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (!lastUpdate || now - lastUpdate > dayMs) {
          setShowOdometerSlide(true);
        } else {
          setShowOdometerSlide(false);
        }

        try {
          const upcoming = await api.get<any>(
            `/v1/expenses/warranty/vehicles/${primary.id}/upcoming`,
          );
          const rawData = (upcoming as any).data || upcoming;

          if (Array.isArray(rawData)) {
            const overdue = rawData.find(
              (item: any) => item.urgency === 'OVERDUE',
            );
            const overdueCount = rawData.filter(
              (item: any) => item.urgency === 'OVERDUE',
            ).length;
            const dueSoonCount = rawData.filter(
              (item: any) =>
                item.urgency === 'DUE_SOON' || item.urgency === 'UPCOMING',
            ).length;
            setServiceAlertCount(overdueCount);
            setServiceDueSoonCount(dueSoonCount);
            if (overdue) {
              setServiceDueText('Overdue!');
            } else {
              const first = rawData[0];
              if (first) {
                const kmLeft =
                  (first.lifecycleKm || 10000) -
                  (first.kmSinceReplacement || 0);
                setServiceDueText(`${kmLeft > 0 ? kmLeft : 0} km`);
              } else {
                setServiceDueText('Healthy');
              }
            }
          } else {
            console.warn(
              'Unexpected upcoming service response format',
              rawData,
            );
            setServiceDueText('Healthy');
            setServiceAlertCount(0);
            setServiceDueSoonCount(0);
          }
        } catch (err) {
          console.warn('Could not fetch upcoming service for home', err);
          setServiceDueText('Checking...');
          setServiceAlertCount(0);
          setServiceDueSoonCount(0);
        }

        void fetchExpenseHighlights(primary.id);
      } else {
        setVehicle(null);
        setServiceDueText('Add vehicle');
        setServiceAlertCount(0);
        setServiceDueSoonCount(0);
        setShowOdometerSlide(false);
        void fetchExpenseHighlights();
      }
    } catch (error) {
      console.error('Error fetching primary vehicle:', error);
      const stalePrimary = getStaleCachedValue<Vehicle>(
        HOME_PRIMARY_VEHICLE_CACHE_KEY,
      );
      if (stalePrimary) {
        setVehicle(stalePrimary);
      }
    } finally {
      setVehicleLoading(false);
    }
  }, [fetchExpenseHighlights]);

  return {
    vehicle,
    vehicleLoading,
    serviceDueText,
    serviceAlertCount,
    serviceDueSoonCount,
    monthlySpendTotal,
    monthlyExpenseCount,
    expenseAlertCount,
    expenseHeadline,
    showOdometerSlide,
    fetchPrimaryVehicle,
  };
}

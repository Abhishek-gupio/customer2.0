import { api } from './api';

/**
 * TRIP EXPENSE SERVICE
 * Calls the backend trip-expense API for toll + fuel cost calculation.
 */

export interface TripTollPlaza {
  name: string;
  road: string;
  state: string;
  tagCost: number;
  cashCost: number;
  lat: number;
  lng: number;
  weather?: { temp: number; condition: string; icon: string };
}

export interface TripRoute {
  routeName: string;
  distance: { km: number; text: string };
  duration: { hours: number; minutes: number; text: string };
  costs: {
    fuel: number;
    tollFastag: number;
    tollCash: number;
    total: number;
    totalWithCash: number;
  };
  tolls: TripTollPlaza[];
  fuelUsed: { liters: number };
  fuelEfficiency: { city: number; hwy: number; unit: string };
  fuelPriceUsed: { price: number; currency: string; type: string };
  polyline?: string;
}

export interface TripExpenseResult {
  id?: string;
  from: string;
  to: string;
  waypoints?: string[];
  vehicleType: string;
  fuelType: string;
  routes: TripRoute[];
  cheapestRoute: TripRoute | null;
  fastestRoute: TripRoute | null;
  calculatedAt: string;
  optimalDeparture?: { bestTime: string; savingsMinutes: number } | null;
  weather?: { temp: number; condition: string; icon: string };
}

export interface VehicleTypeOption {
  value: string;
  label: string;
  tollGuruType: string;
}

export interface TripExpenseRequest {
  from: string;
  to: string;
  waypoints?: string[];
  vehicleId?: string;
  vehicleType?: string;
  fuelType?: string;
}

export const tripExpenseService = {
  async calculate(params: TripExpenseRequest): Promise<TripExpenseResult> {
    const res = await api.post<TripExpenseResult>(
      '/v1/trip-expense/calculate',
      params,
    );
    return (res as any)?.data ?? res;
  },

  async getVehicleTypes(): Promise<VehicleTypeOption[]> {
    const res = await api.get<{ vehicleTypes: VehicleTypeOption[] }>(
      '/v1/trip-expense/vehicle-types',
    );
    return (res as any)?.data?.vehicleTypes ?? (res as any)?.vehicleTypes ?? [];
  },

  async refresh(tripId: string): Promise<TripExpenseResult> {
    const res = await api.post<TripExpenseResult>(
      `/v1/trip-expense/refresh/${tripId}`,
      {},
    );
    return (res as any)?.data ?? res;
  },

  async saveTrip(payload: any): Promise<any> {
    const res = await api.post(
      '/v1/trip-expense/save',
      payload
    );
    return (res as any)?.data ?? res;
  },

  async getHistory(): Promise<any[]> {
    const res = await api.get('/v1/trip-expense/history');
    return (res as any)?.data ?? res ?? [];
  },

  async deleteTrip(tripId: string): Promise<void> {
    await api.delete(`/v1/trip-expense/history/${tripId}`);
  },
};

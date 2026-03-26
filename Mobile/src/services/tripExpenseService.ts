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
}

export interface TripExpenseResult {
  from: string;
  to: string;
  vehicleType: string;
  fuelType: string;
  routes: TripRoute[];
  cheapestRoute: TripRoute | null;
  fastestRoute: TripRoute | null;
  calculatedAt: string;
}

export interface VehicleTypeOption {
  value: string;
  label: string;
  tollGuruType: string;
}

export const tripExpenseService = {
  async calculate(params: {
    from: string;
    to: string;
    vehicleId?: string;
    vehicleType?: string;
    fuelType?: string;
  }): Promise<TripExpenseResult> {
    const res = await api.post<{ data: TripExpenseResult }>(
      '/v1/trip-expense/calculate',
      params,
    );
    return (res as any)?.data ?? res;
  },

  async getVehicleTypes(): Promise<VehicleTypeOption[]> {
    const res = await api.get<{ data: { vehicleTypes: VehicleTypeOption[] } }>(
      '/v1/trip-expense/vehicle-types',
    );
    return (res as any)?.data?.vehicleTypes ?? [];
  },
};

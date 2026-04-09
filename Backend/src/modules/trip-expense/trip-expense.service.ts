import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";
import { fuelPriceService } from "../../services/fuel-price.service";
import { AppError } from "../../utils/AppError";
import { Prisma } from "@repo/db-customer";

/**
 * TRIP EXPENSE SERVICE
 * ====================
 * Calculates trip expenses (tolls, fuel, total cost) for a route
 * using TollGuru API + local fuel price intelligence.
 */

const TOLLGURU_API_KEY = process.env.TOLLGURU_API_KEY || "";
const TOLLGURU_BASE_URL = "https://apis.tollguru.com/toll/v2";

const VEHICLE_TYPE_MAP: Record<string, string> = {
  CAR: "2AxlesAuto",
  SEDAN: "2AxlesAuto",
  SUV: "2AxlesAuto",
  HATCHBACK: "2AxlesAuto",
  BIKE: "2AxlesMotorcycle",
  MOTORCYCLE: "2AxlesMotorcycle",
  SCOOTER: "2AxlesMotorcycle",
  TRUCK: "2AxlesTruck",
  BUS: "2AxlesBus",
  AUTO: "2AxlesAuto",
};

const DEFAULT_FUEL_EFFICIENCY: Record<string, { city: number; hwy: number }> = {
  CAR:        { city: 12, hwy: 16 },
  SEDAN:      { city: 13, hwy: 18 },
  SUV:        { city: 10, hwy: 14 },
  HATCHBACK:  { city: 15, hwy: 20 },
  BIKE:       { city: 40, hwy: 50 },
  MOTORCYCLE: { city: 40, hwy: 50 },
  SCOOTER:    { city: 45, hwy: 55 },
  TRUCK:      { city: 5,  hwy: 8 },
  BUS:        { city: 4,  hwy: 6 },
  AUTO:       { city: 12, hwy: 16 },
};

const FALLBACK_FUEL_PRICES: Record<string, number> = {
  PETROL: 103.0,
  DIESEL: 89.0,
  CNG: 76.0,
  ELECTRIC: 0,
};

interface TollPlaza {
  name: string;
  road: string;
  state: string;
  tagCost: number;
  cashCost: number;
  lat: number;
  lng: number;
  weather?: { temp: number; condition: string; icon: string };
}

interface RouteResult {
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
  tolls: TollPlaza[];
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
  routes: RouteResult[];
  cheapestRoute: RouteResult | null;
  fastestRoute: RouteResult | null;
  calculatedAt: string;
  optimalDeparture?: { bestTime: string; savingsMinutes: number } | null;
  weather?: { temp: number; condition: string; icon: string };
}

export const tripExpenseService = {
  /**
   * Calculate trip expenses from origin to destination
   */
  async calculateTripExpense(params: {
    from: string;
    to: string;
    vehicleId?: string;
    customerId?: string;
    vehicleType?: string;
    fuelType?: string;
    fuelEfficiency?: { city: number; hwy: number };
    waypoints?: string[];
  }): Promise<TripExpenseResult> {
    const { from, to, waypoints = [] } = params;

    let vehicleType = (params.vehicleType || "CAR").toUpperCase();
    let fuelType = (params.fuelType || "PETROL").toUpperCase();
    let fuelEfficiency = params.fuelEfficiency;
    let mileageFromVehicle: number | null = null;

    if (params.vehicleId && params.customerId) {
      try {
        const vehicle = await (dbInstances as any).customerVehicle.findUnique({
          where: { id: params.vehicleId },
        });

        if (vehicle) {
          vehicleType = (vehicle.vehicleType || "CAR").toUpperCase();
          fuelType = (vehicle.fuelType || "PETROL").toUpperCase();
          if (vehicle.mileage) {
            const parsedMileage = parseFloat(vehicle.mileage);
            if (!isNaN(parsedMileage)) {
              mileageFromVehicle = parsedMileage;
            }
          }
        }
      } catch (err) {
        logger.warn({ err, vehicleId: params.vehicleId }, "Failed to fetch vehicle, using defaults");
      }
    }

    if (!fuelEfficiency) {
      if (mileageFromVehicle !== null && mileageFromVehicle > 0) {
        fuelEfficiency = {
          city: mileageFromVehicle * 0.8,
          hwy: mileageFromVehicle,
        };
      } else {
        fuelEfficiency = DEFAULT_FUEL_EFFICIENCY[vehicleType] || DEFAULT_FUEL_EFFICIENCY.CAR;
      }
    }

    const originCity = this.extractCity(from);
    let fuelPrice = await fuelPriceService.getPrice(originCity, fuelType);
    if (!fuelPrice || fuelPrice <= 0) {
      fuelPrice = FALLBACK_FUEL_PRICES[fuelType] || FALLBACK_FUEL_PRICES.PETROL;
    }

    // Phase 3: Weather (Simulated for Now)
    const weather = { temp: 28, condition: "Sunny", icon: "sunny" };

    const tollGuruVehicleType = VEHICLE_TYPE_MAP[vehicleType] || "2AxlesAuto";

    // Phase 3: Optimal Start Time
    const optimalDeparture = await this.calculateOptimalStartTime({
      from,
      to,
      waypoints,
      vehicleType: tollGuruVehicleType,
      fuelPrice,
      fuelEfficiency,
    });

    const tollGuruResponse = await this.callTollGuruAPI({
      from,
      to,
      waypoints,
      vehicleType: tollGuruVehicleType,
      fuelPrice,
      fuelEfficiency: fuelEfficiency!,
    });

    const routes = this.parseRoutes(tollGuruResponse, fuelType, fuelPrice, fuelEfficiency!);

    const cheapestRoute = routes.length > 0
      ? routes.reduce((min: RouteResult, r: RouteResult) => r.costs.total < min.costs.total ? r : min, routes[0])
      : null;
    const fastestRoute = routes.length > 0
      ? routes.reduce((min: RouteResult, r: RouteResult) => 
          (r.duration.hours * 60 + r.duration.minutes) < (min.duration.hours * 60 + min.duration.minutes) ? r : min, 
          routes[0]
        )
      : null;

    const result: TripExpenseResult = {
      routes,
      cheapestRoute,
      fastestRoute,
      from,
      to,
      vehicleType,
      fuelType,
      optimalDeparture,
      calculatedAt: new Date().toISOString(),
      weather,
      waypoints: params.waypoints,
    };

    // Phase 4: Persist trip to database for AI Assistant (Mike)
    if (params.customerId) {
      try {
        const tripId = `${from.trim()}_${to.trim()}`.replace(/\s+/g, '_').toLowerCase();
        
        const existing = await (dbInstances as any).plannedTrip.findFirst({
          where: {
            customerId: params.customerId,
            tripId,
          },
        });

        if (existing) {
          const updated = await (dbInstances as any).plannedTrip.update({
            where: { id: existing.id },
            data: {
              result: result as any,
              updatedAt: new Date(),
            },
          });
          return { ...result, id: updated.id };
        }

        const saved = await (dbInstances as any).plannedTrip.create({
          data: {
            customerId: params.customerId,
            tripId,
            origin: from,
            destination: to,
            waypoints: waypoints || [],
            vehicleType,
            fuelType,
            result: result as any,
          },
        });
        return { ...result, id: saved.id };
      } catch (err) {
        logger.error({ err }, "Failed to persist planned trip");
      }
    }

    return result;
  },

  async calculateOptimalStartTime(params: any): Promise<{ bestTime: string; savingsMinutes: number } | null> {
    try {
      const now = new Date();
      const offsetsHours = [0, 2, 4];
      const durations = await Promise.all(
        offsetsHours.map(async (h) => {
          const departureTime = new Date(now.getTime() + h * 60 * 60 * 1000);
          const res = await this.callTollGuruAPI({ ...params });
          const durRaw = res?.route?.duration || res?.routes?.[0]?.duration || 0;
          return { time: departureTime, duration: durRaw };
        })
      );

      durations.sort((a, b) => a.duration - b.duration);
      const best = durations[0];
      const worst = durations[durations.length - 1];

      return {
        bestTime: best.time.toISOString(),
        savingsMinutes: Math.floor((worst.duration - best.duration) / 60),
      };
    } catch {
      return null;
    }
  },

  async callTollGuruAPI(params: {
    from: string;
    to: string;
    waypoints?: string[];
    vehicleType: string;
    fuelPrice: number;
    fuelEfficiency: { city: number; hwy: number };
  }) {
    if (!TOLLGURU_API_KEY) {
      throw AppError.badRequest("TollGuru API key missing");
    }

    const requestBody = {
      from: { address: params.from.includes(", India") ? params.from : `${params.from}, India` },
      to: { address: params.to.includes(", India") ? params.to : `${params.to}, India` },
      vehicleType: params.vehicleType,
      fuelPrice: params.fuelPrice,
      fuelEfficiency: params.fuelEfficiency,
      units: { currency: "INR", distance: "km", fuelEfficiency: "kmpl" },
      waypoints: (params.waypoints || []).map(w => ({ address: w.includes(", India") ? w : `${w}, India` })),
      map: { polyline: true },
    };

    try {
      const response = await fetch(`${TOLLGURU_BASE_URL}/origin-destination-waypoints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": TOLLGURU_API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error("API call failed");
      return await response.json();
    } catch (err) {
      logger.error({ err }, "TollGuru API call failed");
      throw AppError.badRequest("Unable to calculate trip expenses");
    }
  },

  parseRoutes(
    tollGuruData: any,
    fuelType: string,
    fuelPrice: number,
    fuelEfficiency: { city: number; hwy: number }
  ): RouteResult[] {
    const rawRoutes = tollGuruData?.routes || (tollGuruData?.route ? [tollGuruData] : []);
    const results: RouteResult[] = [];

    for (const route of rawRoutes) {
      try {
        const summary = route?.summary || {};
        const costs = route?.costs || {};
        const distKmRaw = summary?.distance?.metric || summary?.distance?.value || route?.distance?.metric || 0;
        const distKm = typeof distKmRaw === "string" ? parseFloat(distKmRaw) : distKmRaw;

        const durationSec = summary?.duration?.value || summary?.duration || route?.duration?.value || 0;
        const hours = Math.floor(durationSec / 3600);
        const minutes = Math.floor((durationSec % 3600) / 60);

        const avgEff = (fuelEfficiency.city + fuelEfficiency.hwy) / 2;
        const fuelCost = costs?.fuel || (distKm > 0 ? (distKm / avgEff) * fuelPrice : 0);
        const tollFastag = costs?.tag || costs?.tagAndETC || 0;
        const tollCash = costs?.cash || 0;

        results.push({
          routeName: summary?.name || route?.name || `Route ${results.length + 1}`,
          distance: { km: Math.round(distKm * 10) / 10, text: `${Math.round(distKm * 10) / 10} km` },
          duration: { hours, minutes, text: `${hours}h ${minutes}m` },
          costs: {
            fuel: Math.round(fuelCost * 100) / 100,
            tollFastag: Math.round(tollFastag * 100) / 100,
            tollCash: Math.round(tollCash * 100) / 100,
            total: Math.round((fuelCost + tollFastag) * 100) / 100,
            totalWithCash: Math.round((fuelCost + tollCash) * 100) / 100,
          },
          tolls: (route?.tolls || []).map((t: any) => ({
            name: t?.name || t?.tollName || "Unknown Toll",
            road: t?.road || t?.highway || "",
            state: t?.state || "",
            tagCost: t?.tagCost || t?.tagPrice || t?.cost?.tag || 0,
            cashCost: t?.cashCost || t?.cashPrice || t?.cost?.cash || 0,
            lat: t?.lat || t?.start?.lat || 0,
            lng: t?.lng || t?.start?.lng || 0,
            weather: { temp: 24 + Math.floor(Math.random() * 10), condition: "Clear", icon: "clear-day" },
          })),
          fuelUsed: { liters: distKm > 0 ? Math.round((distKm / avgEff) * 100) / 100 : 0 },
          fuelEfficiency: { ...fuelEfficiency, unit: "km/l" },
          fuelPriceUsed: { price: fuelPrice, currency: "INR", type: fuelType },
          polyline: route?.polyline || route?.map?.polyline || summary?.polyline || "",
        });
      } catch (err) {
        logger.warn({ err }, "Failed to parse route");
      }
    }
    return results;
  },

  extractCity(address: string): string {
    if (!address) return "Delhi";
    const parts = address.split(",").map(p => p.trim());
    return parts[0] || "Delhi";
  },

  getSupportedVehicleTypes() {
    return [
      { value: "CAR", label: "Car / Sedan", tollGuruType: "2AxlesAuto" },
      { value: "SUV", label: "SUV / MUV", tollGuruType: "2AxlesAuto" },
      { value: "HATCHBACK", label: "Hatchback", tollGuruType: "2AxlesAuto" },
      { value: "BIKE", label: "Bike / Motorcycle", tollGuruType: "2AxlesMotorcycle" },
      { value: "SCOOTER", label: "Scooter", tollGuruType: "2AxlesMotorcycle" },
      { value: "TRUCK", label: "Truck", tollGuruType: "2AxlesTruck" },
      { value: "BUS", label: "Bus", tollGuruType: "2AxlesBus" },
    ];
  },

  async getLatestTrip(customerId: string): Promise<TripExpenseResult | null> {
    try {
      const trip = await (dbInstances as any).plannedTrip.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
      });
      return trip ? (trip.result as any) : null;
    } catch (err) {
      logger.error({ err }, "Failed to fetch latest trip");
      return null;
    }
  },

  async saveTripHistory(customerId: string, payload: any) {
    try {
      // Check if a trip with this ID already exists for this customer
      const existing = await (dbInstances as any).plannedTrip.findFirst({
        where: {
          customerId,
          tripId: payload.id,
        },
      });

      if (existing) {
        // Update existing record with new planning/results
        const updated = await (dbInstances as any).plannedTrip.update({
          where: { id: existing.id },
          data: {
            result: payload.tripResult,
            planning: payload.planning,
            updatedAt: new Date(),
          },
        });
        return updated;
      }

      // Otherwise create new
      const saved = await (dbInstances as any).plannedTrip.create({
        data: {
          customerId,
          tripId: payload.id,
          origin: payload.from,
          destination: payload.to,
          result: payload.tripResult,
          planning: payload.planning,
          createdAt: new Date(payload.timestamp || Date.now()),
        }
      });
      return saved;
    } catch (err) {
      logger.error({ err }, "Failed to save trip history");
      throw AppError.internal("Could not save trip to history");
    }
  },

  async getTripHistory(customerId: string) {
    try {
      const trips = await (dbInstances as any).plannedTrip.findMany({
        where: { customerId, planning: { not: Prisma.DbNull } },
        orderBy: { createdAt: "desc" },
      });
      return trips;
    } catch (err) {
      logger.error({ err }, "Failed to fetch trip history");
      return [];
    }
  },

  async deleteTripHistory(customerId: string, tripId: string) {
    try {
      // Find the record first to ensure it belongs to the customer
      const existing = await (dbInstances as any).plannedTrip.findFirst({
        where: { 
          customerId,
          OR: [
            { tripId: tripId },
            { id: tripId }
          ]
        }
      });

      if (!existing) throw AppError.notFound("Trip not found");

      await (dbInstances as any).plannedTrip.delete({
        where: { id: existing.id }
      });
      return { success: true };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err }, "Failed to delete trip history");
      throw AppError.internal("Could not delete trip");
    }
  },

  /**
   * Refresh traffic and toll data for an existing trip
   */
  async refreshTripTraffic(tripId: string, customerId: string): Promise<TripExpenseResult> {
    const trip = await (dbInstances as any).plannedTrip.findFirst({
      where: { id: tripId, customerId },
    });
    if (!trip) throw AppError.notFound("Trip not found");

    // Re-run the calculation with current conditions
    return this.calculateTripExpense({
      from: trip.origin,
      to: trip.destination,
      waypoints: (trip.waypoints as string[]) || [],
      vehicleType: trip.vehicleType || "CAR",
      customerId,
    });
  },
};

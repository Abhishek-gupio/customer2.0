import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";
import { fuelPriceService } from "../../services/fuel-price.service";
import { AppError } from "../../utils/AppError";

/**
 * TRIP EXPENSE SERVICE
 * ====================
 * Calculates trip expenses (tolls, fuel, total cost) for a route
 * using TollGuru API + local fuel price intelligence.
 *
 * API: TollGuru Origin-Destination Waypoints
 * Docs: https://tollguru.com/developers/docs
 */

const TOLLGURU_API_KEY = process.env.TOLLGURU_API_KEY || "";
const TOLLGURU_BASE_URL = "https://apis.tollguru.com/toll/v2";

// ─── Vehicle Type Mapping ────────────────────────────────────────────────────
// Maps our app's vehicle types to TollGuru's vehicle classification
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

// ─── Default Fuel Efficiency (km/l) by vehicle type ──────────────────────────
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

// ─── Default fuel prices (fallback if DB cache is empty) ─────────────────────
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
}

export interface TripExpenseResult {
  from: string;
  to: string;
  vehicleType: string;
  fuelType: string;
  routes: RouteResult[];
  cheapestRoute: RouteResult | null;
  fastestRoute: RouteResult | null;
  calculatedAt: string;
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
  }): Promise<TripExpenseResult> {
    const { from, to } = params;

    // 1. Resolve vehicle details if vehicleId is provided
    let vehicleType = (params.vehicleType || "CAR").toUpperCase();
    let fuelType = (params.fuelType || "PETROL").toUpperCase();
    let fuelEfficiency = params.fuelEfficiency;
    let mileageFromVehicle: number | null = null;

    if (params.vehicleId && params.customerId) {
      try {
        const vehicle = await dbInstances.customerVehicle.findUnique({
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
        logger.warn({ err, vehicleId: params.vehicleId }, "Failed to fetch vehicle details, using defaults");
      }
    }

    // 2. Determine fuel efficiency
    if (!fuelEfficiency) {
      if (mileageFromVehicle !== null && mileageFromVehicle > 0) {
        // Use vehicle's stored mileage
        fuelEfficiency = {
          city: mileageFromVehicle * 0.8,  // City is ~80% of rated
          hwy: mileageFromVehicle,
        };
      } else {
        fuelEfficiency = DEFAULT_FUEL_EFFICIENCY[vehicleType] || DEFAULT_FUEL_EFFICIENCY.CAR;
      }
    }

    // 3. Get fuel price from our DB (real-time city price)
    const originCity = this.extractCity(from);
    let fuelPrice = await fuelPriceService.getPrice(originCity, fuelType);
    if (!fuelPrice || fuelPrice <= 0) {
      fuelPrice = FALLBACK_FUEL_PRICES[fuelType] || FALLBACK_FUEL_PRICES.PETROL;
    }

    // 4. Map vehicle type for TollGuru
    const tollGuruVehicleType = VEHICLE_TYPE_MAP[vehicleType] || "2AxlesAuto";

    // 5. Call TollGuru API
    const tollGuruResponse = await this.callTollGuruAPI({
      from,
      to,
      vehicleType: tollGuruVehicleType,
      fuelPrice,
      fuelEfficiency,
    });

    logger.info({ tollGuruResponse }, "TollGuru success response body");

    // 6. Parse and format response
    const routes = this.parseRoutes(tollGuruResponse, fuelType, fuelPrice, fuelEfficiency);

    // Find cheapest and fastest routes
    const cheapestRoute = routes.length > 0
      ? routes.reduce((min, r) => r.costs.total < min.costs.total ? r : min, routes[0])
      : null;

    const fastestRoute = routes.length > 0
      ? routes.reduce((min, r) => (r.duration.hours * 60 + r.duration.minutes) < (min.duration.hours * 60 + min.duration.minutes) ? r : min, routes[0])
      : null;

    return {
      from,
      to,
      vehicleType,
      fuelType,
      routes,
      cheapestRoute,
      fastestRoute,
      calculatedAt: new Date().toISOString(),
    };
  },

  /**
   * Call TollGuru Origin-Destination API
   */
  async callTollGuruAPI(params: {
    from: string;
    to: string;
    vehicleType: string;
    fuelPrice: number;
    fuelEfficiency: { city: number; hwy: number };
  }) {
    if (!TOLLGURU_API_KEY) {
      throw AppError.badRequest(
        "Trip expense calculation is not configured. Please contact support."
      );
    }

    const requestBody = {
      from: { address: params.from.includes(", India") ? params.from : `${params.from}, India` },
      to: { address: params.to.includes(", India") ? params.to : `${params.to}, India` },
      vehicleType: params.vehicleType,
      fuelPrice: params.fuelPrice,
      fuelEfficiency: {
        city: params.fuelEfficiency.city,
        hwy: params.fuelEfficiency.hwy,
      },
      units: { currency: "INR", distance: "km", fuelEfficiency: "kmpl" },
    };

    logger.info(
      { requestBody },
      "Calling TollGuru API with full body"
    );

    try {
      const response = await fetch(
        `${TOLLGURU_BASE_URL}/origin-destination-waypoints`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": TOLLGURU_API_KEY,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, errorText, requestBody },
          "TollGuru API error response"
        );
        throw AppError.badRequest(
          `Route calculation failed: ${response.status === 404 ? "Route not found between these locations" : "Unable to calculate route"}`
        );
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err }, "TollGuru API call failed");
      throw AppError.badRequest(
        "Unable to calculate trip expenses. Please check the locations and try again."
      );
    }
  },

  /**
   * Parse TollGuru routes response into our format
   */
  parseRoutes(
    tollGuruData: any,
    fuelType: string,
    fuelPrice: number,
    fuelEfficiency: { city: number; hwy: number }
  ): RouteResult[] {
    const routes: RouteResult[] = [];

    const routesList = tollGuruData?.routes || tollGuruData?.route
      ? [tollGuruData]
      : [];

    const rawRoutes = tollGuruData?.routes || routesList;

    for (const route of rawRoutes) {
      try {
        const summary = route?.summary || {};
        const costs = route?.costs || {};

        // Distance
        const distKmRaw =
          summary?.distance?.metric ||
          summary?.distance?.value ||
          route?.distance?.metric ||
          0;
        const distKm = typeof distKmRaw === "string" ? parseFloat(distKmRaw) : distKmRaw;

        // Duration (TollGuru returns seconds)
        const durationSec =
          summary?.duration?.value ||
          summary?.duration ||
          route?.duration?.value ||
          0;
        const hours = Math.floor(durationSec / 3600);
        const minutes = Math.floor((durationSec % 3600) / 60);

        // Fuel cost
        const fuelCost =
          costs?.fuel ||
          route?.costs?.fuel ||
          (distKm > 0 ? (distKm / ((fuelEfficiency.city + fuelEfficiency.hwy) / 2)) * fuelPrice : 0);

        // Toll costs
        const tollFastag = costs?.tag || costs?.tagAndETC || 0;
        const tollCash = costs?.cash || 0;

        // Fuel used in liters
        const avgEfficiency = (fuelEfficiency.city + fuelEfficiency.hwy) / 2;
        const litersUsed = distKm > 0 ? Math.round((distKm / avgEfficiency) * 100) / 100 : 0;

        // Parse toll plazas
        const tolls: TollPlaza[] = (route?.tolls || []).map((t: any) => ({
          name: t?.name || t?.tollName || "Unknown Toll",
          road: t?.road || t?.highway || "",
          state: t?.state || "",
          tagCost: t?.tagCost || t?.tagPrice || t?.cost?.tag || 0,
          cashCost: t?.cashCost || t?.cashPrice || t?.cost?.cash || 0,
          lat: t?.lat || t?.start?.lat || 0,
          lng: t?.lng || t?.start?.lng || 0,
        }));

        const totalWithFastag = Math.round((fuelCost + tollFastag) * 100) / 100;
        const totalWithCash = Math.round((fuelCost + tollCash) * 100) / 100;

        routes.push({
          routeName: summary?.name || route?.name || `Route ${routes.length + 1}`,
          distance: {
            km: Math.round(distKm * 10) / 10,
            text: `${Math.round(distKm * 10) / 10} km`,
          },
          duration: {
            hours,
            minutes,
            text: `${hours}h ${minutes}m`,
          },
          costs: {
            fuel: Math.round(fuelCost * 100) / 100,
            tollFastag: Math.round(tollFastag * 100) / 100,
            tollCash: Math.round(tollCash * 100) / 100,
            total: totalWithFastag,
            totalWithCash,
          },
          tolls,
          fuelUsed: { liters: litersUsed },
          fuelEfficiency: {
            city: fuelEfficiency.city,
            hwy: fuelEfficiency.hwy,
            unit: "km/l",
          },
          fuelPriceUsed: {
            price: fuelPrice,
            currency: "INR",
            type: fuelType,
          },
        });
      } catch (err) {
        logger.warn({ err }, "Failed to parse one route from TollGuru response");
      }
    }

    return routes;
  },

  /**
   * Extract city name from an address string
   */
  extractCity(address: string): string {
    if (!address) return "Delhi";
    // Take the first part before comma as the city
    const parts = address.split(",").map((p) => p.trim());
    return parts[0] || "Delhi";
  },

  /**
   * Get supported vehicle types for the frontend
   */
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
};

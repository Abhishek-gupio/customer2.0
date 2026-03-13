import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances as any;

/**
 * FUEL PRICE INTELLIGENCE SERVICE
 * =================================
 * - Fetches daily fuel prices by city/state from the database cache
 * - Database cache is populated by ContentScraperService from sources like GoodReturns
 * - Compares prices between cities in the same state
 */

export const fuelPriceService = {
  /**
   * Get current fuel price for a city and fuel type
   */
  async getPrice(city: string, fuelType: string): Promise<number | null> {
    const normalizedCity = this.normalizeCity(city);
    const normalizedFuel = fuelType.toUpperCase();

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Try today's price first
      const todayPrice = await db.fuelPriceCache.findFirst({
        where: {
          city: normalizedCity,
          fuelType: normalizedFuel,
          date: { gte: today },
        },
        orderBy: { date: "desc" },
      });

      if (todayPrice) {
        return todayPrice.price;
      }

      // 2. Fallback to most recent available price for this city
      const recentPrice = await db.fuelPriceCache.findFirst({
        where: {
          city: normalizedCity,
          fuelType: normalizedFuel,
        },
        orderBy: { date: "desc" },
      });

      if (recentPrice) {
        return recentPrice.price;
      }
    } catch (err) {
      logger.error({ err, city: normalizedCity }, "FuelPrice cache lookup failed");
    }

    // 3. Absolute fallback if no data exists
    const genericPrices: Record<string, number> = {
      PETROL: 100.0,
      DIESEL: 90.0,
      CNG: 75.0,
    };
    return genericPrices[normalizedFuel] || null;
  },

  /**
   * Get fuel prices for a specific state
   */
  async getByState(stateName: string) {
    if (!stateName) return null;

    const normalizedName = this.normalizeState(stateName);
    if (!normalizedName) return null;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Search cache for any city in this state
      const prices = await db.fuelPriceCache.findMany({
        where: {
          OR: [
            { state: { contains: normalizedName, mode: 'insensitive' } },
            { city: { contains: normalizedName, mode: 'insensitive' } }
          ],
          date: { gte: today }
        },
        distinct: ['fuelType']
      });

      if (prices.length > 0) {
        const result: any = { PETROL: null, DIESEL: null, CNG: null };
        prices.forEach((p: any) => {
          result[p.fuelType] = p.price;
        });
        return result;
      }

      // Fallback to most recent available data
      const recent = await db.fuelPriceCache.findMany({
        where: {
          OR: [
            { state: { contains: normalizedName, mode: 'insensitive' } },
            { city: { contains: normalizedName, mode: 'insensitive' } }
          ]
        },
        orderBy: { date: 'desc' },
        distinct: ['fuelType'],
        take: 5
      });

      if (recent.length > 0) {
        const result: any = { PETROL: null, DIESEL: null, CNG: null };
        recent.forEach((p: any) => {
          result[p.fuelType] = p.price;
        });
        return result;
      }
    } catch (err) {
      logger.error({ err, stateName: normalizedName }, "Failed to fetch state fuel prices");
    }

    return { PETROL: 100.0, DIESEL: 90.0, CNG: null };
  },

  /**
   * Calculate liters filled based on amount and city price
   */
  async calculateLiters(
    amount: number,
    city: string,
    fuelType: string,
  ): Promise<{
    liters: number;
    pricePerLiter: number;
    city: string;
  }> {
    const price = await this.getPrice(city, fuelType);
    if (!price || price <= 0) {
      return { liters: 0, pricePerLiter: 0, city };
    }

    return {
      liters: Math.round((amount / price) * 100) / 100,
      pricePerLiter: price,
      city: this.normalizeCity(city),
    };
  },

  /**
   * Compare fuel prices with other cities in the same state
   */
  async comparePrices(
    city: string,
    fuelType: string,
  ): Promise<{
    currentCity: { city: string; price: number };
    nearbyPrices: { city: string; price: number; saving: number }[];
    cheapest: { city: string; price: number; saving: number } | null;
    alert: string | null;
  }> {
    const normalizedCity = this.normalizeCity(city);
    const currentPrice = await this.getPrice(normalizedCity, fuelType);

    if (!currentPrice) {
      return {
        currentCity: { city: normalizedCity, price: 0 },
        nearbyPrices: [],
        cheapest: null,
        alert: null,
      };
    }

    const nearbyPrices: { city: string; price: number; saving: number }[] = [];

    try {
      const cityInfo = await db.fuelPriceCache.findFirst({
        where: { city: normalizedCity }
      });

      if (cityInfo?.state) {
        const others = await db.fuelPriceCache.findMany({
          where: {
            state: cityInfo.state,
            city: { not: normalizedCity },
            fuelType: fuelType.toUpperCase()
          },
          distinct: ['city'],
          orderBy: { date: 'desc' },
          take: 5
        });

        for (const other of others) {
          nearbyPrices.push({
            city: other.city,
            price: other.price,
            saving: Math.round((currentPrice - other.price) * 100) / 100,
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "Nearby price comparison failed");
    }

    nearbyPrices.sort((a, b) => b.saving - a.saving);
    const cheapest = nearbyPrices.find((p) => p.saving > 0) || null;
    let alert: string | null = null;

    if (cheapest && cheapest.saving >= 1) {
      alert = `${fuelType} is ₹${cheapest.saving} cheaper in ${cheapest.city} (₹${cheapest.price}/L vs ₹${currentPrice}/L).`;
    }

    return {
      currentCity: { city: normalizedCity, price: currentPrice },
      nearbyPrices,
      cheapest,
      alert,
    };
  },

  /**
   * Get fuel prices for all regions available in cache
   */
  async getAllPrices(
    fuelType: string = "PETROL",
  ): Promise<{ city: string; price: number }[]> {
    try {
      const allCached = await db.fuelPriceCache.findMany({
        where: { fuelType: fuelType.toUpperCase() },
        distinct: ['city'],
        orderBy: { date: 'desc' }
      });

      return allCached
        .map((c: any) => ({ city: c.city, price: c.price }))
        .sort((a: any, b: any) => a.price - b.price);
    } catch (err) {
      logger.error({ err }, "Failed to fetch all prices");
      return [];
    }
  },

  /**
   * Cache fuel prices
   */
  async cachePrices(
    prices: { city: string; state: string; fuelType: string; price: number }[],
  ): Promise<number> {
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const p of prices) {
      try {
        await db.fuelPriceCache.upsert({
          where: {
            city_fuelType_date: {
              city: p.city,
              fuelType: p.fuelType,
              date: today,
            },
          },
          update: { price: p.price },
          create: {
            city: p.city,
            state: p.state,
            fuelType: p.fuelType,
            price: p.price,
            date: today,
            source: "MANUAL_UPDATE",
          },
        });
        count++;
      } catch (err) {
        logger.error({ err, city: p.city }, "Failed to cache fuel price");
      }
    }
    return count;
  },

  /**
   * Utility: Normalize city name
   */
  normalizeCity(city: string): string {
    if (!city) return "Delhi";
    const mapping: Record<string, string> = {
      "new delhi": "Delhi",
      nct: "Delhi",
      bengaluru: "Bangalore",
      bombay: "Mumbai",
      calcutta: "Kolkata",
      madras: "Chennai",
      gurugram: "Gurgaon",
    };
    const lower = city.toLowerCase().trim();
    return (
      mapping[lower] ||
      city.charAt(0).toUpperCase() + city.slice(1).toLowerCase()
    );
  },

  /**
   * Normalize state name
   */
  normalizeState(state?: string): string | null {
    if (!state) return null;
    return state.trim();
  },

  /**
   * Enhance fuel expense with price intelligence
   */
  async enrichFuelExpense(
    amount: number,
    city: string,
    fuelType: string,
  ): Promise<{
    liters: number;
    pricePerLiter: number;
    comparison: {
      cheapest: { city: string; price: number; saving: number } | null;
      alert: string | null;
    };
  }> {
    const { liters, pricePerLiter } = await this.calculateLiters(amount, city, fuelType);
    const comparison = await this.comparePrices(city, fuelType);

    return {
      liters,
      pricePerLiter,
      comparison: {
        cheapest: comparison.cheapest,
        alert: comparison.alert
      },
    };
  },
};

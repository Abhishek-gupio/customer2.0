import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances as any;

/**
 * FUEL PRICE INTELLIGENCE SERVICE
 * =================================
 * - Fetches daily fuel prices by city (from public APIs / hardcoded fallback)
 * - Auto-calculates liters filled when user adds fuel expense
 * - Compares prices between nearby cities
 * - Alerts user if cheaper fuel is available nearby
 */

// Default fuel prices (fallback when API is unavailable)
// Updated periodically. These are approximate Jan 2026 prices.
const DEFAULT_PRICES: Record<string, Record<string, number>> = {
    "Delhi": { PETROL: 94.72, DIESEL: 87.62, CNG: 75.61 },
    "Mumbai": { PETROL: 103.44, DIESEL: 89.97, CNG: 78.00 },
    "Bangalore": { PETROL: 101.94, DIESEL: 87.89, CNG: 72.00 },
    "Chennai": { PETROL: 100.75, DIESEL: 92.34, CNG: 0 },
    "Kolkata": { PETROL: 104.95, DIESEL: 91.76, CNG: 73.50 },
    "Hyderabad": { PETROL: 107.41, DIESEL: 95.65, CNG: 70.00 },
    "Pune": { PETROL: 104.36, DIESEL: 90.23, CNG: 76.50 },
    "Ahmedabad": { PETROL: 94.32, DIESEL: 89.15, CNG: 72.00 },
    "Jaipur": { PETROL: 104.88, DIESEL: 90.36, CNG: 0 },
    "Lucknow": { PETROL: 94.65, DIESEL: 87.71, CNG: 75.00 },
    "Noida": { PETROL: 94.72, DIESEL: 87.62, CNG: 75.61 },
    "Gurgaon": { PETROL: 94.72, DIESEL: 87.62, CNG: 75.61 },
    "Chandigarh": { PETROL: 96.20, DIESEL: 84.26, CNG: 73.00 },
    "Indore": { PETROL: 107.96, DIESEL: 93.00, CNG: 0 },
    "Bhopal": { PETROL: 108.65, DIESEL: 93.22, CNG: 0 },
    "Patna": { PETROL: 107.24, DIESEL: 93.84, CNG: 0 },
    "Nagpur": { PETROL: 105.79, DIESEL: 91.49, CNG: 74.00 },
};

// Nearby city groups for price comparison
const NEARBY_CITIES: Record<string, string[]> = {
    "Delhi": ["Noida", "Gurgaon", "Ghaziabad"],
    "Noida": ["Delhi", "Ghaziabad", "Greater Noida"],
    "Gurgaon": ["Delhi", "Noida"],
    "Mumbai": ["Thane", "Navi Mumbai", "Pune"],
    "Pune": ["Mumbai", "Nashik"],
    "Bangalore": ["Mysore", "Tumkur"],
    "Hyderabad": ["Secunderabad"],
    "Chennai": ["Kanchipuram", "Vellore"],
    "Kolkata": ["Howrah", "Salt Lake"],
};

export const fuelPriceService = {
    /**
     * Get current fuel price for a city and fuel type
     */
    async getPrice(city: string, fuelType: string): Promise<number | null> {
        const normalizedCity = this.normalizeCity(city);
        const normalizedFuel = fuelType.toUpperCase();

        // 1. Try database cache first (today's price)
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const cached = await db.fuelPriceCache.findFirst({
                where: {
                    city: normalizedCity,
                    fuelType: normalizedFuel,
                    date: { gte: today }
                },
                orderBy: { date: "desc" }
            });

            if (cached) return cached.price;
        } catch (err) {
            logger.debug({ err }, "FuelPrice cache lookup failed, using defaults");
        }

        // 2. Fallback to defaults
        const cityPrices = DEFAULT_PRICES[normalizedCity];
        if (cityPrices && cityPrices[normalizedFuel]) {
            return cityPrices[normalizedFuel];
        }

        // 3. Generic fallback
        const genericPrices: Record<string, number> = { PETROL: 100, DIESEL: 90, CNG: 75 };
        return genericPrices[normalizedFuel] || null;
    },

    /**
     * Calculate liters filled based on amount and city price
     */
    async calculateLiters(amount: number, city: string, fuelType: string): Promise<{
        liters: number;
        pricePerLiter: number;
        city: string;
    }> {
        const price = await this.getPrice(city, fuelType);
        if (!price || price <= 0) {
            return { liters: 0, pricePerLiter: 0, city };
        }

        return {
            liters: Math.round((amount / price) * 100) / 100, // Round to 2 decimal
            pricePerLiter: price,
            city: this.normalizeCity(city),
        };
    },

    /**
     * Compare fuel prices with nearby cities
     */
    async comparePrices(city: string, fuelType: string): Promise<{
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

        // Get nearby cities
        const nearbyCities = NEARBY_CITIES[normalizedCity] || [];
        const nearbyPrices: { city: string; price: number; saving: number }[] = [];

        for (const nearbyCity of nearbyCities) {
            const price = await this.getPrice(nearbyCity, fuelType);
            if (price) {
                nearbyPrices.push({
                    city: nearbyCity,
                    price,
                    saving: Math.round((currentPrice - price) * 100) / 100,
                });
            }
        }

        // Sort by saving (most savings first)
        nearbyPrices.sort((a, b) => b.saving - a.saving);

        // Generate alert if significant saving
        const cheapest = nearbyPrices.find(p => p.saving > 0) || null;
        let alert: string | null = null;

        if (cheapest && cheapest.saving >= 1) {
            alert = `${fuelType} is ₹${cheapest.saving} cheaper in ${cheapest.city} (₹${cheapest.price}/L vs ₹${currentPrice}/L in ${normalizedCity}). Fill there if possible!`;
        }

        return {
            currentCity: { city: normalizedCity, price: currentPrice },
            nearbyPrices,
            cheapest,
            alert,
        };
    },

    /**
     * Get fuel prices for all major cities
     */
    async getAllPrices(fuelType: string = "PETROL"): Promise<{ city: string; price: number }[]> {
        const results: { city: string; price: number }[] = [];
        for (const city of Object.keys(DEFAULT_PRICES)) {
            const price = await this.getPrice(city, fuelType);
            if (price) results.push({ city, price });
        }
        return results.sort((a, b) => a.price - b.price);
    },

    /**
     * Cache fuel prices (called by cron job or manual trigger)
     */
    async cachePrices(prices: { city: string; state: string; fuelType: string; price: number }[]): Promise<number> {
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
                        }
                    },
                    update: { price: p.price },
                    create: {
                        city: p.city,
                        state: p.state,
                        fuelType: p.fuelType,
                        price: p.price,
                        date: today,
                        source: "MANUAL_UPDATE",
                    }
                });
                count++;
            } catch (err) {
                logger.error({ err, city: p.city }, "Failed to cache fuel price");
            }
        }

        logger.info(`Cached ${count} fuel prices`);
        return count;
    },

    /**
     * Utility: Normalize city name
     */
    normalizeCity(city: string): string {
        if (!city) return "Delhi"; // Default fallback
        const mapping: Record<string, string> = {
            "new delhi": "Delhi",
            "nct": "Delhi",
            "bengaluru": "Bangalore",
            "bombay": "Mumbai",
            "calcutta": "Kolkata",
            "madras": "Chennai",
            "gurugram": "Gurgaon",
        };
        const lower = city.toLowerCase().trim();
        return mapping[lower] || city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    },

    /**
     * Enhance fuel expense with price intelligence
     * Called after a FUEL expense is created
     */
    async enrichFuelExpense(amount: number, city: string, fuelType: string): Promise<{
        liters: number;
        pricePerLiter: number;
        comparison: {
            cheapest: { city: string; price: number; saving: number } | null;
            alert: string | null;
        };
    }> {
        const { liters, pricePerLiter } = await this.calculateLiters(amount, city, fuelType);
        const { cheapest, alert } = await this.comparePrices(city, fuelType);

        return {
            liters,
            pricePerLiter,
            comparison: { cheapest, alert },
        };
    },
};

import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";

interface WeatherData {
    condition: string;
    temp_c: number;
    wind_kph: number;
    precip_mm: number;
    visibility_km: number;
    is_day: boolean;
}

export const weatherService = {
    /**
     * Fetch current weather from WeatherAPI.com
     * Returns a simplified object for AI context.
     */
    async getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
        if (!env.WEATHER_API_KEY) {
            logger.warn("WEATHER_API_KEY not configured, skipping weather fetch");
            return null;
        }

        try {
            const url = `http://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`;
            const response = await axios.get(url, { timeout: 3000 }); // Fast timeout

            const current = response.data.current;

            return {
                condition: current.condition.text,
                temp_c: current.temp_c,
                wind_kph: current.wind_kph,
                precip_mm: current.precip_mm,
                visibility_km: current.vis_km,
                is_day: current.is_day === 1
            };
        } catch (error) {
            logger.error({ error }, "Failed to fetch weather data");
            return null;
        }
    }
};

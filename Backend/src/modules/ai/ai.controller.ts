import { Request, Response } from "express";
import { aiService } from "../../services/ai.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";

import { weatherService } from "../../services/weather.service";

export const aiController = {
    /**
     * POST /v1/ai/coach
     * Generates driving advice based on recent events
     */
    coach: asyncHandler(async (req: Request, res: Response) => {
        const { events, context } = req.body;

        if (!events || !Array.isArray(events)) {
            throw AppError.badRequest("Events array is required");
        }

        // Auto-fetch weather if lat/lon provided but weather missing
        if (!context?.weather && context?.lat && context?.lon) {
            const weather = await weatherService.getCurrentWeather(context.lat, context.lon);
            if (weather) {
                context.weather = weather.condition;
                context.visibility = `${weather.visibility_km} km`;
                context.isDay = weather.is_day;
            }
        }

        const advice = await aiService.generateDrivingCoachAdvice(events, context || {});

        success(res, { advice });
    })
};

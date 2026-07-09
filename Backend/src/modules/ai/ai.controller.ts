import { Request, Response } from "express";
import { aiService } from "../../services/ai.service";
import { voiceService } from "../../services/voice.service";
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
      const weather = await weatherService.getCurrentWeather(
        context.lat,
        context.lon,
      );
      if (weather) {
        context.weather = weather.condition;
        context.visibility = `${weather.visibility_km} km`;
        context.isDay = weather.is_day;
      }
    }

    const advice = await aiService.generateDrivingCoachAdvice(
      events,
      context || {},
    );

    success(res, { advice });
  }),

  transcribe: asyncHandler(async (req: Request, res: Response) => {
    let buffer: Buffer;
    let mimeType = "audio/wav";
    let originalName = "audio.wav";

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
      originalName = req.file.originalname;
    } else if (req.body.audio) {
      buffer = Buffer.from(req.body.audio, "base64");
      mimeType = req.body.mimeType || "audio/wav";
    } else {
      throw AppError.badRequest("No audio file or base64 audio provided");
    }

    const transcript = await voiceService.transcribe(buffer, mimeType, originalName);
    success(res, { transcript });
  }),

  intent: asyncHandler(async (req: Request, res: Response) => {
    const customerId = (req as any).user?.id; // Assuming authMiddleware sets req.user.id
    
    // Check if we already have text transcript
    if (req.body.text) {
      const intent = await voiceService.extractIntent(req.body.text);
      const result = await aiService.processIntent(customerId, intent);
      return success(res, {
        success: true,
        transcript: req.body.text,
        intent: intent.intent,
        result,
      });
    }

    // Otherwise, transcribe audio first
    let buffer: Buffer;
    let mimeType = "audio/wav";
    let originalName = "audio.wav";

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
      originalName = req.file.originalname;
    } else if (req.body.audio) {
      buffer = Buffer.from(req.body.audio, "base64");
      mimeType = req.body.mimeType || "audio/wav";
    } else {
      throw AppError.badRequest("Provide audio file, base64 audio, or text transcript");
    }

    const response = await voiceService.handleAudio(buffer, mimeType, originalName, customerId);
    success(res, response);
  }),
};

import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { placesService, type NearbyPlaceType } from "../../services/places.service";

const VALID_TYPES: NearbyPlaceType[] = [
  "gas_station",
  "car_wash",
  "electric_charging_station",
  "hospital",
  "police",
  "car_repair",
  "parking",
  "lodging",
  "tourist_attraction",
  "park",
  "museum",
  "restaurant",
  "car_rental",
  "bicycle_store",
  "insurance_agency",
  "local_government_office",
];

export const placesController = {
  getNearby: asyncHandler(async (req: Request, res: Response) => {
    const latStr = (req.query.latitude ?? req.query.lat) as string | undefined;
    const lngStr = (req.query.longitude ?? req.query.lng) as string | undefined;
    const type = req.query.type as string | undefined;
    const radius = Math.min(
      25000,
      Math.max(500, parseInt((req.query.radius as string) || "10000", 10) || 10000),
    );

    if (!latStr || !lngStr) {
      return res.status(400).json({
        success: false,
        error: { message: "latitude and longitude are required" },
      });
    }

    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid latitude or longitude" },
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: { message: "Place type is required" },
      });
    }

    if (!VALID_TYPES.includes(type as NearbyPlaceType)) {
      return res.status(400).json({
        success: false,
        error: { message: "Requested place type is not available" },
      });
    }

    const placeType = type as NearbyPlaceType;

    const places = await placesService.getNearbyPlaces(
      latitude,
      longitude,
      placeType,
      radius,
    );
    return success(res, { places, location: { latitude, longitude } });
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: { message: "query (q) is required" },
      });
    }

    const suggestions = await placesService.searchPlaces(query);
    return success(res, { suggestions });
  }),
};

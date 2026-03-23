import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { fuelPriceService } from "../../services/fuel-price.service";

/**
 * FUEL CONTROLLER
 * Handles fetching current fuel prices for specific states/cities.
 */
export const fuelController = {
  /**
   * GET /v1/fuel/state?name=Karnataka or ?state=Karnataka
   * Fetches fuel prices for a state by looking up the average in cache.
   */
  getStateFuel: asyncHandler(async (req: Request, res: Response) => {
    const state = ((req.query.name as string) || (req.query.state as string) || "").trim();

    if (!state) {
      return success(res, { state: null, petrol: null, diesel: null }, 200);
    }

    // Use the unified fuelPriceService
    const data = await fuelPriceService.getByState(state);

    if (!data) {
      return success(res, { state: state, petrol: null, diesel: null }, 200);
    }

    return success(res, {
      state: state,
      petrol: data.PETROL,
      diesel: data.DIESEL,
      cng: data.CNG
    }, 200);
  }),
};

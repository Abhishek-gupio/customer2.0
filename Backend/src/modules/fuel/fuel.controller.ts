import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { stateFuelService } from "../../services/state-fuel.service";

export const fuelController = {
  // GET /v1/fuel/state?name=Karnataka or ?state=Karnataka
  getStateFuel: asyncHandler(async (req: Request, res: Response) => {
    const state = ((req.query.name as string) || (req.query.state as string) || "").trim();
    const data = await stateFuelService.getByState(state);
    if (!data) {
      return success(res, { state: null, petrol: null, diesel: null }, 200);
    }
    success(res, { state: state || null, petrol: data.PETROL, diesel: data.DIESEL }, 200);
  }),
};

import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { tripExpenseService } from "./trip-expense.service";
import { calculateTripExpenseSchema } from "./trip-expense.validators";
import { vehicleService } from "../vehicle/vehicle.service";

/**
 * TRIP EXPENSE CONTROLLER
 * =======================
 * Handles trip expense calculation endpoints.
 *
 * POST /v1/trip-expense/calculate
 *   - Calculates toll, fuel, and total cost for a route
 *   - Optionally uses customer's vehicle for accurate calculations
 *
 * GET /v1/trip-expense/vehicle-types
 *   - Returns supported vehicle types for the UI dropdown
 */
export const tripExpenseController = {
  /**
   * POST /v1/trip-expense/calculate
   *
   * Body: { from, to, vehicleId?, vehicleType?, fuelType?, fuelEfficiency? }
   *
   * If vehicleId is provided, auto-detects vehicleType, fuelType, and mileage
   * from the customer's primary vehicle.
   */
  calculate: asyncHandler(async (req: Request, res: Response) => {
    const parsed = calculateTripExpenseSchema.parse(req.body);
    const customerId = (req as any).customerId;

    // If vehicleId not provided but user is authenticated, try primary vehicle
    let vehicleId = parsed.vehicleId;
    if (!vehicleId && customerId) {
      try {
        vehicleId = await vehicleService.resolveVehicleId(customerId) ?? undefined;
      } catch {
        // No vehicle found, proceed without
      }
    }

    const result = await tripExpenseService.calculateTripExpense({
      from: parsed.from,
      to: parsed.to,
      vehicleId,
      customerId,
      vehicleType: parsed.vehicleType,
      fuelType: parsed.fuelType,
      fuelEfficiency: parsed.fuelEfficiency,
    });

    return success(res, result, 200);
  }),

  /**
   * GET /v1/trip-expense/vehicle-types
   *
   * Returns the list of supported vehicle types for the frontend dropdown.
   */
  getVehicleTypes: asyncHandler(async (_req: Request, res: Response) => {
    const types = tripExpenseService.getSupportedVehicleTypes();
    return success(res, { vehicleTypes: types }, 200);
  }),
};

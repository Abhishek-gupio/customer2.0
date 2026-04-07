import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { tripExpenseService } from "./trip-expense.service";
import { calculateTripExpenseSchema } from "./trip-expense.validators";
import { vehicleService } from "../vehicle/vehicle.service";
import { AppError } from "../../utils/AppError";

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
    const customerId = req.customer?.id;

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
      waypoints: parsed.waypoints,
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

  /**
   * POST /v1/trip-expense/refresh/:tripId
   *
   * Re-calculates an existing trip to update traffic and toll data.
   */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    const { tripId } = req.params;
    if (!customerId) throw AppError.unauthorized();
    if (!tripId || typeof tripId !== 'string') throw AppError.badRequest("Trip ID is required");

    const result = await tripExpenseService.refreshTripTraffic(tripId as string, customerId);
    return success(res, result, 200);
  }),

  /**
   * POST /v1/trip-expense/save
   * Saves the entire trip context (route, tolls, planning) into the user's history
   */
  saveHistory: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) throw AppError.unauthorized();
    
    const result = await tripExpenseService.saveTripHistory(customerId, req.body);
    return success(res, result, 201);
  }),

  /**
   * GET /v1/trip-expense/history
   * Retrieves the user's saved trips
   */
  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) throw AppError.unauthorized();

    const trips = await tripExpenseService.getTripHistory(customerId);
    
    // Map the database structure back into the `HistoryEntry` format the app expects
    const formatted = trips.map((t: any) => ({
      id: t.tripId || t.id,
      from: t.origin,
      to: t.destination,
      tripResult: t.result,
      planning: t.planning,
      timestamp: t.createdAt.getTime(),
    }));

    return success(res, formatted, 200);
  }),

  /**
   * DELETE /v1/trip-expense/history/:tripId
   * Removes a trip from the user's history
   */
  deleteHistory: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    const { tripId } = req.params;
    if (!customerId) throw AppError.unauthorized();
    if (!tripId) throw AppError.badRequest("Trip ID is required");

    await tripExpenseService.deleteTripHistory(customerId, tripId as string);
    return success(res, { message: "Trip deleted successfully" }, 200);
  }),
};

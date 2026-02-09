import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { vehicleService } from "./vehicle.service";
import { addVehicleSchema, updateVehicleSchema } from "./vehicle.validators";
import { AppError } from "../../utils/AppError";

function parseBody<T>(
    req: Request,
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }
): T {
    const result = schema.safeParse(req.body);
    if (!result.success && result.error) {
        const first = result.error.issues[0]?.message ?? "Validation failed";
        throw AppError.badRequest(first);
    }
    return result.data!;
}

export const vehicleController = {
    add: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const body = parseBody(req, addVehicleSchema);
        const vehicle = await vehicleService.addVehicle(req.customer.id, body);
        success(res, vehicle, 201);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicles = await vehicleService.listVehicles(req.customer.id);
        success(res, vehicles);
    }),

    getById: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicle = await vehicleService.getVehicle(req.customer.id, req.params.id as string);
        success(res, vehicle);
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const body = parseBody(req, updateVehicleSchema);
        const vehicle = await vehicleService.updateVehicle(req.customer.id, req.params.id as string, body);
        success(res, vehicle);
    }),

    delete: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        await vehicleService.deleteVehicle(req.customer.id, req.params.id as string);
        success(res, { message: "Vehicle deleted successfully" });
    }),

    setPrimary: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const vehicle = await vehicleService.setPrimary(req.customer.id, req.params.id as string);
        success(res, vehicle);
    }),

    recalculateHealth: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        // Verify ownership first
        await vehicleService.getVehicle(req.customer.id, req.params.id as string);
        const health = await vehicleService.calculateHealthScore(req.params.id as string);
        success(res, health);
    }),
};

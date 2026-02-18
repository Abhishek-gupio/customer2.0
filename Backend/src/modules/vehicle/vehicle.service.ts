import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import {
  AddVehicleInput,
  UpdateVehicleInput,
  AddOdometerInput,
} from "./vehicle.validators";
import { logger } from "../../config/logger";
import { predictionService } from "../../services/prediction.service";
import { ocrService } from "../../services/ocr.service";

export const vehicleService = {
  async addVehicle(customerId: string, input: AddVehicleInput) {
    // ... (existing addVehicle code)
    // Check if registration number already exists
    const existing = await dbInstances.customerVehicle.findUnique({
      where: { registrationNumber: input.registrationNumber },
    });

    if (existing) {
      throw AppError.conflict(
        "Vehicle with this registration number already exists",
      );
    }

    // Create vehicle
    const vehicle = await dbInstances.customerVehicle.create({
      data: {
        ...input,
        customerId,
      },
    });

    // Initialize health score (default 100)
    await dbInstances.vehicleHealthScore.create({
      data: {
        vehicleId: vehicle.id,
        overallScore: 100,
        explanations: ["New vehicle added. Health calculation pending."],
      },
    });

    // If odometer provided, add first log
    if (input.currentOdometer) {
      await this.addOdometerLog(customerId, vehicle.id, {
        reading: input.currentOdometer,
        date: new Date(),
      });
    }

    return vehicle;
  },

  async addOdometerLog(
    customerId: string,
    vehicleId: string,
    input: AddOdometerInput,
  ) {
    await this.getVehicle(customerId, vehicleId); // Ownership check

    // 1. Get last log to prevent "Rewinding" odometer
    const lastLog = await (dbInstances as any).odometerLog.findFirst({
      where: { vehicleId },
      orderBy: { date: "desc" },
    });

    if (lastLog && input.reading < lastLog.reading) {
      throw AppError.badRequest(
        `New reading (${input.reading}) cannot be lower than the previous reading (${lastLog.reading})`,
      );
    }

    const log = await (dbInstances as any).odometerLog.create({
      data: {
        vehicleId,
        reading: input.reading,
        date: input.date,
      },
    });

    // Update current odometer on vehicle
    await dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: { currentOdometer: input.reading },
    });

    // Trigger health recalculation
    this.calculateHealthScore(vehicleId);

    return log;
  },

  async listVehicles(customerId: string) {
    // ... (rest of the service)
    return dbInstances.customerVehicle.findMany({
      where: {
        OR: [
          { customerId, isActive: true },
          { accessList: { some: { customerId } }, isActive: true },
        ],
      },
      include: {
        healthScore: true,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
  },

  async getVehicle(customerId: string, vehicleId: string) {
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      include: {
        healthScore: true,
        accessList: {
          where: { customerId },
        },
      },
    });

    if (
      !vehicle ||
      (vehicle.customerId !== customerId && vehicle.accessList.length === 0)
    ) {
      throw AppError.notFound("Vehicle not found");
    }

    return vehicle;
  },

  async updateVehicle(
    customerId: string,
    vehicleId: string,
    input: UpdateVehicleInput,
  ) {
    await this.getVehicle(customerId, vehicleId);

    return dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: input,
    });
  },

  async deleteVehicle(customerId: string, vehicleId: string) {
    await this.getVehicle(customerId, vehicleId);

    // Soft delete
    return dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });
  },

  async setPrimary(customerId: string, vehicleId: string) {
    // 1. Unset existing primary
    await dbInstances.customerVehicle.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });

    // 2. Set new primary
    return dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: { isPrimary: true },
    });
  },

  async calculateHealthScore(vehicleId: string) {
    logger.info({ vehicleId }, "Predicting advanced vehicle health score...");
    return predictionService.calculateAdvancedHealthScore(vehicleId);
  },

  async updateOdometerViaAI(
    customerId: string,
    vehicleId: string,
    file: Express.Multer.File,
  ) {
    const reading = await ocrService.parseOdometer(file.buffer, file.mimetype);

    if (!reading) {
      throw AppError.badRequest(
        "Could not extract odometer reading from photo. Please ensure the dashboard is clear.",
      );
    }

    return this.addOdometerLog(customerId, vehicleId, {
      reading,
      date: new Date(),
    });
  },
};

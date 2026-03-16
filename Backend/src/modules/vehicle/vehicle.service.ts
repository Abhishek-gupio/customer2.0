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
import { fetchAndSaveIntervalsForVehicle } from "../../services/oem-scraper.service";

// ─── Vehicle Images (Curated Static list) ───────────────────────────────────
const CAR_IMAGES = [
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800",
];

const BIKE_IMAGES = [
  "https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1614705139031-6e828114f86d?auto=format&fit=crop&q=80&w=800",
];

const FALLBACK_CAR_IMAGE = CAR_IMAGES[0];

export const vehicleService = {
  async addVehicle(customerId: string, input: AddVehicleInput) {
    logger.info({ customerId, registrationNumber: input.registrationNumber }, "Attempting to add vehicle");
    
    // Check if registration number already exists
    const existing = await dbInstances.customerVehicle.findUnique({
      where: { registrationNumber: input.registrationNumber },
    });

    if (existing) {
      logger.warn({ registrationNumber: input.registrationNumber }, "Vehicle already exists");
      throw AppError.conflict(
        "Vehicle with this registration number already exists",
      );
    }

    // Pick a random image based on type
    let imageUrl = FALLBACK_CAR_IMAGE;
    if (input.vehicleType === "BIKE") {
      imageUrl = BIKE_IMAGES[Math.floor(Math.random() * BIKE_IMAGES.length)];
    } else {
      imageUrl = CAR_IMAGES[Math.floor(Math.random() * CAR_IMAGES.length)];
    }

    // Create vehicle with imageUrl
    const [vehicle] = await dbInstances.$transaction([
      dbInstances.customerVehicle.create({
        data: { ...input, customerId, imageUrl },
      }),
    ]);

    logger.info({ vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber }, "Vehicle successfully created in DB");

    const vehicleWithImage = { ...vehicle, imageUrl };

    // Initialize health score (default 100)
    await dbInstances.vehicleHealthScore.create({
      data: {
        vehicleId: vehicle.id,
        overallScore: 100,
        explanations: ["New vehicle added."],
      },
    });

    // If odometer provided, add first log
    if (input.currentOdometer) {
      await this.addOdometerLog(customerId, vehicle.id, {
        reading: input.currentOdometer,
        date: new Date(),
      });
    }

    // Fetch OEM intervals in background
    fetchAndSaveIntervalsForVehicle(vehicle.id).catch((err) =>
      logger.warn({ err, vehicleId: vehicle.id }, "OEM interval fetch failed (non-blocking)"),
    );

    return vehicleWithImage;
  },

  async addOdometerLog(
    customerId: string,
    vehicleId: string,
    input: AddOdometerInput,
  ) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    const isOwner = vehicle.customerId === customerId;
    const hasWriteAccess =
      vehicle.accessList?.some(
        (a: any) => a.role === "EDITOR" || a.role === "DRIVER",
      ) ?? false;

    if (!isOwner && !hasWriteAccess) {
      throw AppError.forbidden(
        "You have view-only access to this vehicle and cannot update the odometer",
      );
    }

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

    // A4: Explainability – add scoreChangeReason and components for "Why this score?" and "What to do next?"
    if (vehicle.healthScore) {
      const recs = Array.isArray(vehicle.healthScore.recommendations)
        ? (vehicle.healthScore.recommendations as string[])
        : [];
      const expls = Array.isArray(vehicle.healthScore.explanations)
        ? (vehicle.healthScore.explanations as string[])
        : [];
      const scoreChangeReason =
        recs[0] ?? expls[0] ?? "Score based on maintenance, documents, and driving data.";
      const components: { name: string; score: number | null; label: string }[] = [
        {
          name: "maintenance",
          score: vehicle.healthScore.maintenanceScore ?? null,
          label: "Maintenance",
        },
        {
          name: "driving",
          score: vehicle.healthScore.drivingScore ?? null,
          label: "Driving",
        },
        {
          name: "age",
          score: vehicle.healthScore.ageScore ?? null,
          label: "Age",
        },
        {
          name: "mileage",
          score: vehicle.healthScore.mileageScore ?? null,
          label: "Mileage",
        },
      ];
      (vehicle as any).healthScore = {
        ...vehicle.healthScore,
        scoreChangeReason,
        components,
        recommendations: recs,
        explanations: expls,
      };
    }

    return vehicle;
  },

  async updateVehicle(
    customerId: string,
    vehicleId: string,
    input: UpdateVehicleInput,
  ) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can update vehicle details");
    }

    const updated = await dbInstances.customerVehicle.update({
      where: { id: vehicleId },
      data: input,
    });

    if (input.make !== undefined || input.model !== undefined || input.year !== undefined) {
      fetchAndSaveIntervalsForVehicle(vehicleId).catch((err) =>
        logger.warn({ err, vehicleId }, "OEM interval fetch failed on update (non-blocking)"),
      );
    }

    return updated;
  },

  async deleteVehicle(customerId: string, vehicleId: string) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can delete this vehicle");
    }

    return dbInstances.$transaction(async (tx) => {
      await tx.customerDocument.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      await tx.expense.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      await tx.documentEmbedding.deleteMany({
        where: { entityId: vehicleId, entityType: "VEHICLE" },
      });

      return tx.customerVehicle.delete({
        where: { id: vehicleId },
      });
    });
  },

  async setPrimary(customerId: string, vehicleId: string) {
    const vehicle = await this.getVehicle(customerId, vehicleId);

    if (vehicle.customerId !== customerId) {
      throw AppError.forbidden("Only the owner can set a primary vehicle");
    }

    // 1. Unset existing primary
    await dbInstances.customerVehicle.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });

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
        "Could not extract odometer reading from photo.",
      );
    }

    return this.addOdometerLog(customerId, vehicleId, {
      reading,
      date: new Date(),
    });
  },

  /**
   * Stubbed lookupRTO — Gemini removed as per user request.
   */
  async lookupRTO(plate: string, model?: string) {
    logger.info({ plate, model }, "lookupRTO called (Gemini disabled)");
    // We return minimal dummy data to avoid breaking the frontend totally,
    // though the frontend lookup step should be removed.
    return {
      registrationNumber: plate,
      brand: "Unknown",
      model: "Unknown",
      fuelType: "PETROL",
      imageUrl: FALLBACK_CAR_IMAGE
    };
  },

  async generateVehicleImage(type: string): Promise<string> {
    if (type.toLowerCase().includes("bike")) {
      return BIKE_IMAGES[Math.floor(Math.random() * BIKE_IMAGES.length)];
    }
    return CAR_IMAGES[Math.floor(Math.random() * CAR_IMAGES.length)];
  },
};

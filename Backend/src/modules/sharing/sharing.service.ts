import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { ShareVehicleInput } from "./sharing.validators";
import { logger } from "../../config/logger";
import { getSMSService } from "../../services/sms.service";

export const sharingService = {
  async shareVehicle(ownerId: string, input: ShareVehicleInput) {
    // Normalize phone number to match auth module behavior (last 10 digits)
    const digits = input.phoneNumber.replace(/\D/g, "");
    const normalizedPhone = digits.slice(-10);

    // 1. Verify ownership and get owner info
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: input.vehicleId },
      include: { customer: true },
    });

    if (!vehicle || vehicle.customerId !== ownerId) {
      throw AppError.unauthorized("You do not own this vehicle");
    }

    // 2. Find or auto-create target customer by phone
    let targetCustomer = await dbInstances.customer.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!targetCustomer) {
      // Auto-register a minimal customer so future login works without "not registered"
      targetCustomer = await dbInstances.customer.create({
        data: {
          phoneNumber: normalizedPhone,
        },
      });

      // Still send invitation SMS with download link
      const smsService = getSMSService();
      const inviterName = vehicle.customer.fullName || "Someone";
      const message = `${inviterName} wants to share their vehicle documents with you on Gupio! Download the app now to view: https://gupio.app/download. GUPIO.`;

      await smsService.sendSMS(input.phoneNumber, message);
      logger.info(
        { phoneNumber: input.phoneNumber },
        "Auto-registered customer and sent invitation SMS",
      );
    }

    if (targetCustomer.id === ownerId) {
      throw AppError.badRequest("You cannot share a vehicle with yourself");
    }

    // 3. Create or update access
    const access = await dbInstances.vehicleAccess.upsert({
      where: {
        vehicleId_customerId: {
          vehicleId: input.vehicleId,
          customerId: targetCustomer.id,
        },
      },
      update: {
        role: input.role as any,
      },
      create: {
        vehicleId: input.vehicleId,
        customerId: targetCustomer.id,
        role: input.role as any,
      },
    });

    logger.info(
      { vehicleId: input.vehicleId, sharedWith: targetCustomer.id },
      "Vehicle shared successfully",
    );
    return access;
  },

  async listSharedWithMe(customerId: string) {
    return dbInstances.vehicleAccess.findMany({
      where: { customerId },
      include: {
        vehicle: {
          include: {
            healthScore: true,
            documents: true,
          },
        },
      },
    });
  },

  async revokeAccess(
    ownerId: string,
    vehicleId: string,
    targetCustomerId: string,
  ) {
    // Verify the requester owns the vehicle
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.customerId !== ownerId) {
      throw AppError.unauthorized("You do not own this vehicle");
    }

    await dbInstances.vehicleAccess.delete({
      where: {
        vehicleId_customerId: {
          vehicleId,
          customerId: targetCustomerId,
        },
      },
    });

    return { success: true };
  },

  async listVehicleSharings(ownerId: string, vehicleId: string) {
    // Verify ownership
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.customerId !== ownerId) {
      throw AppError.unauthorized("You do not own this vehicle");
    }

    return dbInstances.vehicleAccess.findMany({
      where: { vehicleId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            profilePic: true,
          },
        },
      },
    });
  },
};

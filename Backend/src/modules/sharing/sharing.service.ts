import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { ShareVehicleInput } from "./sharing.validators";
import { logger } from "../../config/logger";
import { getSMSService } from "../../services/sms.service";

export const sharingService = {
    async shareVehicle(ownerId: string, input: ShareVehicleInput) {
        // 1. Verify ownership and get owner info
        const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: input.vehicleId },
            include: { customer: true },
        });

        if (!vehicle || vehicle.customerId !== ownerId) {
            throw AppError.unauthorized("You do not own this vehicle");
        }

        // 2. Find target customer by phone
        const targetCustomer = await dbInstances.customer.findUnique({
            where: { phoneNumber: input.phoneNumber },
        });

        if (!targetCustomer) {
            // Smart Improvisation: If user not found, send invitation link
            const smsService = getSMSService();
            const inviterName = vehicle.customer.fullName || "Someone";
            const message = `${inviterName} wants to share their vehicle documents with you on Gupio! Download the app now to view: https://gupio.app/download. GUPIO.`;

            await smsService.sendSMS(input.phoneNumber, message);
            logger.info({ phoneNumber: input.phoneNumber }, "Sent invitation SMS to non-registered user");

            return { invited: true, message: "Invitation SMS sent to the user" };
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

        logger.info({ vehicleId: input.vehicleId, sharedWith: targetCustomer.id }, "Vehicle shared successfully");
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

    async revokeAccess(ownerId: string, vehicleId: string, targetCustomerId: string) {
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

import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { notificationService } from "./notification.service";

export const challanService = {
    /**
     * MOCK: Fetches any new challans for a car from an external source
     * In production, this would call E-Challan / Parivahan APIs.
     */
    async syncChallans(vehicleId: string) {
        const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: vehicleId },
            include: { customer: true }
        });

        if (!vehicle) return;

        logger.info({ vehicleId, regNo: vehicle.registrationNumber }, "Checking for new traffic challans...");

        // Simulate API check
        // For demonstration, let's say we found a new challan if the last 4 digits are "1234"
        if (vehicle.registrationNumber.endsWith("1234")) {
            const challanNo = `GUP-${Math.floor(Math.random() * 900000) + 100000}`;

            // Check if already exists
            const existing = await (dbInstances as any).challan.findUnique({
                where: { challanNumber: challanNo }
            });

            if (!existing) {
                const newChallan = await (dbInstances as any).challan.create({
                    data: {
                        vehicleId,
                        challanNumber: challanNo,
                        amount: 500,
                        status: "UNPAID",
                        date: new Date(),
                        violationType: "Speeding / Invalid Parking",
                        location: "Main Street, Mumbai",
                        source: "E-CHALLAN MOCK"
                    }
                });

                // Proactive Notification
                await notificationService.notifyCustomer(vehicle.customerId, {
                    title: "⚠️ New Traffic Challan Found",
                    body: `A new challan (${challanNo}) of ₹500 for ${vehicle.make} ${vehicle.model} has been detected. Pay soon to avoid penalties.`,
                    type: "ERROR",
                    sendSMS: true,
                    phoneNumber: vehicle.customer.phoneNumber || undefined,
                    link: `/vehicles/${vehicleId}/challans`,
                    metadata: { challanId: newChallan.id, vehicleId }
                });

                logger.info({ challanNo }, "New challan detected and user notified");
            }
        }
    },

    /**
     * Runs a full sync for all active vehicles
     * Usually triggered by a cron job
     */
    async syncAllVehicles() {
        const vehicles = await dbInstances.customerVehicle.findMany({
            where: { isActive: true }
        });

        for (const v of vehicles) {
            try {
                await this.syncChallans(v.id);
            } catch (err) {
                logger.error({ err, vehicleId: v.id }, "Failed to sync challans for vehicle");
            }
        }
    },

    async getChallans(vehicleId: string) {
        return (dbInstances as any).challan.findMany({
            where: { vehicleId },
            orderBy: { date: "desc" }
        });
    },

    async markAsPaid(challanId: string) {
        return (dbInstances as any).challan.update({
            where: { id: challanId },
            data: { status: "PAID", updatedAt: new Date() }
        });
    }
};

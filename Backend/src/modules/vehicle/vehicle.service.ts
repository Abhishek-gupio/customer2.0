import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { AddVehicleInput, UpdateVehicleInput } from "./vehicle.validators";
import { logger } from "../../config/logger";

export const vehicleService = {
    async addVehicle(customerId: string, input: AddVehicleInput) {
        // Check if registration number already exists
        const existing = await dbInstances.customerVehicle.findUnique({
            where: { registrationNumber: input.registrationNumber },
        });

        if (existing) {
            throw AppError.conflict("Vehicle with this registration number already exists");
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

        return vehicle;
    },

    async listVehicles(customerId: string) {
        return dbInstances.customerVehicle.findMany({
            where: { customerId, isActive: true },
            include: {
                healthScore: true,
            },
            orderBy: { isPrimary: "desc" },
        });
    },

    async getVehicle(customerId: string, vehicleId: string) {
        const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: vehicleId },
            include: {
                healthScore: true,
            },
        });

        if (!vehicle || vehicle.customerId !== customerId) {
            throw AppError.notFound("Vehicle not found");
        }

        return vehicle;
    },

    async updateVehicle(customerId: string, vehicleId: string, input: UpdateVehicleInput) {
        await this.getVehicle(customerId, vehicleId);

        return dbInstances.customerVehicle.update({
            where: { id: vehicleId },
            data: input,
        });
    },

    async deleteVehicle(customerId: string, vehicleId: string) {
        const vehicle = await this.getVehicle(customerId, vehicleId);

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
        const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: vehicleId },
        });

        if (!vehicle) throw AppError.notFound("Vehicle not found");

        // Simple placeholder algorithm for now
        // logic: Age-based decline + Odometer-based decline
        let score = 100;
        const explanations: string[] = [];

        // Age factor
        if (vehicle.year) {
            const age = new Date().getFullYear() - vehicle.year;
            if (age > 10) {
                score -= 20;
                explanations.push("Vehicle is over 10 years old");
            } else if (age > 5) {
                score -= 10;
                explanations.push("Vehicle is over 5 years old");
            }
        }

        // Mileage factor
        if (vehicle.currentOdometer && vehicle.currentOdometer > 100000) {
            score -= 30;
            explanations.push("High mileage (over 100k km)");
        } else if (vehicle.currentOdometer && vehicle.currentOdometer > 50000) {
            score -= 15;
            explanations.push("Moderate mileage (over 50k km)");
        }

        // Ensure score doesn't go below 10
        score = Math.max(10, score);

        return dbInstances.vehicleHealthScore.update({
            where: { vehicleId },
            data: {
                overallScore: score,
                explanations: explanations as any,
                lastCalculated: new Date(),
            },
        });
    },
};

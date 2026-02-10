import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

export const predictionService = {
    /**
     * Calculates the Average Daily Running (ADR) in KM
     * Requires at least 2 odometer logs
     */
    async calculateADR(vehicleId: string): Promise<number | null> {
        const logs = await (dbInstances as any).odometerLog.findMany({
            where: { vehicleId },
            orderBy: { date: "asc" },
            take: 10, // Consider last 10 logs
        });

        if (logs.length < 2) return null;

        const firstLog = logs[0];
        const lastLog = logs[logs.length - 1];

        const kmDiff = lastLog.reading - firstLog.reading;
        const timeDiff = lastLog.date.getTime() - firstLog.date.getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        if (daysDiff === 0) return null;

        const adr = kmDiff / daysDiff;
        return adr;
    },

    /**
     * Predicts the current odometer reading based on the last log and ADR
     */
    async predictCurrentOdometer(vehicleId: string): Promise<number | null> {
        const lastLog = await (dbInstances as any).odometerLog.findFirst({
            where: { vehicleId },
            orderBy: { date: "desc" },
        });

        if (!lastLog) return null;

        const adr = await this.calculateADR(vehicleId);
        if (!adr) return lastLog.reading; // Fallback to last known reading

        const daysSinceLastLog = (new Date().getTime() - lastLog.date.getTime()) / (1000 * 60 * 60 * 24);
        const predictedKM = Math.round(lastLog.reading + (adr * daysSinceLastLog));

        return predictedKM;
    },

    /**
     * Predicts when the car will reach a certain milestone (e.g., next 10,000km service)
     */
    async predictNextServiceDate(vehicleId: string, serviceInterval = 10000): Promise<Date | null> {
        const currentKM = await this.predictCurrentOdometer(vehicleId);
        const adr = await this.calculateADR(vehicleId);

        if (!currentKM || !adr || adr <= 0) return null;

        const nextMilestone = Math.ceil(currentKM / serviceInterval) * serviceInterval;
        if (nextMilestone === currentKM) {
            // Already at milestone, next one is interval away
            const target = currentKM + serviceInterval;
            const daysToReach = (target - currentKM) / adr;
            const date = new Date();
            date.setDate(date.getDate() + daysToReach);
            return date;
        }

        const kmRemaining = nextMilestone - currentKM;
        const daysToReach = kmRemaining / adr;

        const predictionDate = new Date();
        predictionDate.setDate(predictionDate.getDate() + daysToReach);

        return predictionDate;
    },

    /**
     * Advanced Health Score: Dynamic and Multi-factor
     */
    async calculateAdvancedHealthScore(vehicleId: string) {
        const vehicle = await dbInstances.customerVehicle.findUnique({
            where: { id: vehicleId },
            include: {
                documents: {
                    where: { verificationStatus: "VERIFIED" }
                }
            }
        });

        if (!vehicle) return;

        let score = 100;
        const explanations: string[] = [];
        const recommendations: string[] = [];

        // 1. Compliance Audit (Critical Impact)
        const now = new Date();
        const activeInsurance = vehicle.documents.find(d => d.type === "INSURANCE" && d.expiryDate && d.expiryDate > now);
        const activePUC = vehicle.documents.find(d => d.type === "PUC" && d.expiryDate && d.expiryDate > now);

        if (!activeInsurance) {
            score -= 40;
            explanations.push("Insurance is expired or missing. High financial/legal risk.");
            recommendations.push("Renew insurance immediately.");
        }

        if (!activePUC) {
            score -= 15;
            explanations.push("PUC (Pollution) certificate is expired or missing.");
            recommendations.push("Get a PUC test at the nearest certified center.");
        }

        // 2. Usage Impact (Predicted Odometer)
        const predictedKM = await this.predictCurrentOdometer(vehicleId) || vehicle.currentOdometer || 0;
        if (predictedKM > 100000) {
            score -= 20;
            explanations.push("High usage: Vehicle has crossed 100,000 km.");
        } else if (predictedKM > 50000) {
            score -= 10;
            explanations.push("Moderate usage: Vehicle has crossed 50,000 km.");
        }

        // 3. Age Impact
        if (vehicle.registrationDate) {
            const ageYears = (now.getTime() - vehicle.registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
            if (ageYears > 15) {
                score -= 30;
                explanations.push("Vintage Status: Vehicle is over 15 years old (check fitness).");
            } else if (ageYears > 10) {
                score -= 15;
                explanations.push("Old Age: Vehicle is over 10 years old.");
            }
        }

        // 4. Maintenance Regularity
        const adr = await this.calculateADR(vehicleId);
        if (adr && adr > 100) {
            score -= 5;
            explanations.push("Extreme Usage: Carrying high daily average running (>100 km/day).");
            recommendations.push("Consider more frequent oil checks.");
        }

        score = Math.max(5, score); // Absolute floor

        // Predict next service to add as recommendation
        const nextService = await this.predictNextServiceDate(vehicleId);
        if (nextService) {
            recommendations.push(`Next service predicted around: ${nextService.toLocaleDateString()}`);
        }

        return dbInstances.vehicleHealthScore.update({
            where: { vehicleId },
            data: {
                overallScore: score,
                explanations: explanations as any,
                recommendations: recommendations as any,
                lastCalculated: now,
                nextDueDate: nextService,
            }
        });
    }
};

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

    const daysSinceLastLog =
      (new Date().getTime() - lastLog.date.getTime()) / (1000 * 60 * 60 * 24);
    const predictedKM = Math.round(lastLog.reading + adr * daysSinceLastLog);

    return predictedKM;
  },

  /**
   * Predicts when the car will reach a certain milestone (e.g., next 10,000km service)
   */
  async predictNextServiceDate(
    vehicleId: string,
    serviceInterval = 10000,
  ): Promise<Date | null> {
    const currentKM = await this.predictCurrentOdometer(vehicleId);
    const adr = await this.calculateADR(vehicleId);

    if (!currentKM || !adr || adr <= 0) return null;

    const nextMilestone =
      Math.ceil(currentKM / serviceInterval) * serviceInterval;
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
          where: { verificationStatus: "VERIFIED" },
        },
        healthScore: true,
        serviceRecords: {
          orderBy: { serviceDate: "desc" },
          take: 1,
        },
      },
    });

    if (!vehicle) return;

    let complianceScore = 100;
    let maintenanceScore = 100;
    const explanations: string[] = [];
    const recommendations: string[] = [];

    // 1. Compliance Audit (20% Weight)
    const now = new Date();
    const activeInsurance = vehicle.documents.find(
      (d) => d.type === "INSURANCE" && d.expiryDate && d.expiryDate > now,
    );
    const activePUC = vehicle.documents.find(
      (d) => d.type === "PUC" && d.expiryDate && d.expiryDate > now,
    );

    if (!activeInsurance) {
      complianceScore -= 50;
      explanations.push("Critical: Valid Insurance not found.");
      recommendations.push("Renew insurance immediately to avoid fines.");
    }
    if (!activePUC) {
      complianceScore -= 20;
      explanations.push("Warning: Valid PUC not found.");
      recommendations.push("Get a pollution check done.");
    }

    // 2. Maintenance Audit - Age, Mileage, Service + Individual Parts (Heavily Weighted)
    const predictedKM =
      (await this.predictCurrentOdometer(vehicleId)) ||
      vehicle.currentOdometer ||
      0;

    let partHealthSum = 0;
    let partsWithData = 0;
    const partExplanations: string[] = [];

    // Part Health Integration (The "Real" health tracker)
    try {
      const { warrantyService } = await import("./warranty.service");
      const partStatus = await warrantyService.getUpcomingReplacements(vehicleId);

      if (partStatus.length > 0) {
        for (const p of partStatus) {
          const lifecycleKm = p.lifecycleKm || 10000;
          const kmSince = p.kmSinceReplacement || 0;
          const health = Math.max(0, Math.min(100, Math.round((1 - (kmSince / lifecycleKm)) * 100)));

          partHealthSum += health;
          partsWithData++;

          // Only add to explanations if it's not perfect or for top few
          if (health < 100) {
            partExplanations.push(`${p.partType.replace(/_/g, ' ')}: ${health}%`);
          }
          if (health < 40) {
            recommendations.push(`Critical: ${p.partType.replace(/_/g, ' ')} needs urgent attention.`);
          }
        }

        const avgPartHealth = partHealthSum / partsWithData;
        // maintenanceScore is now primarily the average of your actual parts
        maintenanceScore = Math.round(avgPartHealth);

        explanations.push(`Maintenance: Average part health is ${maintenanceScore}%.`);
        if (partExplanations.length > 0) {
          explanations.push(...partExplanations.slice(0, 3));
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to integrate detailed part health");
      maintenanceScore = 100;
    }

    // Mileage score: gradual scale so it's not always 100% under 100k (0–50k=100%, 50–75k=90%, 75–100k=80%, 100–125k=60%, 125–150k=40%, 150k+=20%)
    const mileageScore =
      predictedKM <= 50000 ? 100
        : predictedKM <= 75000 ? 90
        : predictedKM <= 100000 ? 80
        : predictedKM <= 125000 ? 60
        : predictedKM <= 150000 ? 40
        : Math.max(20, 40 - Math.floor((predictedKM - 150000) / 10000));

    // Secondary Penalties (Mileage/Age) — still apply to maintenanceScore for overall
    if (predictedKM > 100000) maintenanceScore -= 10;
    if (vehicle.registrationDate) {
      const ageYears = (now.getTime() - vehicle.registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (ageYears > 15) maintenanceScore -= 15;
    }

    // 3. Driving Score (Telematics)
    const drivingScore = vehicle.healthScore?.drivingScore || null;

    let overallScore = 0;

    if (drivingScore !== null) {
      // 50% Parts/Maintenance, 30% Driving, 20% Compliance
      overallScore =
        drivingScore * 0.3 + complianceScore * 0.2 + maintenanceScore * 0.5;
    } else {
      // 80% Maintenance (Parts), 20% Compliance
      overallScore = maintenanceScore * 0.8 + complianceScore * 0.2;
    }

    // Predict next service to add as recommendation
    const nextServiceDate = await this.predictNextServiceDate(vehicleId);
    if (nextServiceDate) {
      recommendations.push(
        `Next service predicted: ${nextServiceDate.toLocaleDateString()}`,
      );
    }

    return dbInstances.vehicleHealthScore.upsert({
      where: { vehicleId },
      update: {
        overallScore: Math.round(overallScore),
        ageScore: Math.max(
          0,
          100 - (maintenanceScore < 100 ? 100 - maintenanceScore : 0),
        ), // Simplified
        mileageScore,
        maintenanceScore: Math.max(0, maintenanceScore),
        explanations: explanations as any,
        recommendations: recommendations as any,
        lastCalculated: now,
        nextDueDate: nextServiceDate,
      },
      create: {
        vehicleId,
        overallScore: Math.round(overallScore),
        maintenanceScore: Math.max(0, maintenanceScore),
        explanations: explanations as any,
        recommendations: recommendations as any,
        lastCalculated: now,
      },
    });
  },
};

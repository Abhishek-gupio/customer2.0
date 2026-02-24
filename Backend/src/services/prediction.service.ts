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

    // 2. Maintenance Audit (20% Weight) - Age, Mileage, Service
    const predictedKM =
      (await this.predictCurrentOdometer(vehicleId)) ||
      vehicle.currentOdometer ||
      0;

    // Mileage Impact
    if (predictedKM > 100000) maintenanceScore -= 20;
    else if (predictedKM > 50000) maintenanceScore -= 10;

    // Age Impact
    if (vehicle.registrationDate) {
      const ageYears =
        (now.getTime() - vehicle.registrationDate.getTime()) /
        (1000 * 60 * 60 * 24 * 365);
      if (ageYears > 15) maintenanceScore -= 30;
      else if (ageYears > 10) maintenanceScore -= 15;

      explanations.push(`Vehicle is ${ageYears.toFixed(1)} years old.`);
    }

    // Service Impact
    const lastService = vehicle.serviceRecords[0];
    if (lastService) {
      const monthsSinceService =
        (now.getTime() - lastService.serviceDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (monthsSinceService > 12) {
        maintenanceScore -= 20;
        explanations.push(
          "Service overdue: Last service was more than a year ago.",
        );
        recommendations.push("Schedule a general service.");
      }
    }

    // 3. Driving Score (60% Weight) - From Telematics
    const drivingScore = vehicle.healthScore?.drivingScore || null;

    let overallScore = 0;

    if (drivingScore !== null) {
      // Weighted Average: 60% Driving, 20% Compliance, 20% Maintenance
      overallScore =
        drivingScore * 0.6 + complianceScore * 0.2 + maintenanceScore * 0.2;
      explanations.push(
        `Driving Score impact: ${drivingScore}/100 based on recent trips.`,
      );
    } else {
      // Fallback Weights: 50% Compliance, 50% Maintenance
      overallScore = complianceScore * 0.5 + maintenanceScore * 0.5;
      explanations.push(
        "Driving Score pending: Connect App to track trips for better accuracy.",
      );
      recommendations.push(
        "Link the Gupio App to start tracking your driving score.",
      );
    }

    // Predict next service to add as recommendation
    const nextServiceDate = await this.predictNextServiceDate(vehicleId);
    if (nextServiceDate) {
      recommendations.push(
        `Next service predicted around: ${nextServiceDate.toLocaleDateString()}`,
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
        mileageScore: predictedKM > 100000 ? 50 : 100,
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

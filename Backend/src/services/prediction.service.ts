import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const parseExpiryDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  // Support common Indian date formats like DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;

    const parsed = new Date(year, month, day);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() === year &&
      parsed.getMonth() === month &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
  }

  return null;
};

const hasExplicitExpiryValue = (value: unknown): boolean => {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value !== "string") return false;
  const raw = value.trim();
  if (!raw) return false;

  const normalized = raw.toUpperCase();
  const placeholders = new Set([
    "N/A",
    "NA",
    "NONE",
    "NIL",
    "UNKNOWN",
    "NOT AVAILABLE",
    "NOT APPLICABLE",
    "--",
    "-",
  ]);

  return !placeholders.has(normalized);
};

const latestExpiryByType = (
  docs: Array<{ type: string; expiryDate: Date | null }>,
  targetType: "INSURANCE" | "PUC",
): Date | null => {
  let latest: Date | null = null;

  for (const doc of docs) {
    if ((doc.type || "").toUpperCase() !== targetType) continue;
    const expiry = parseExpiryDate(doc.expiryDate);
    if (!expiry) continue;
    if (!latest || expiry > latest) latest = expiry;
  }

  return latest;
};

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
      select: {
        id: true,
        currentOdometer: true,
        registrationDate: true,
        insuranceUpto: true,
        pollutionUpto: true,
        healthScore: true,
        serviceRecords: {
          orderBy: { serviceDate: "desc" },
          take: 1,
        },
      },
    });

    if (!vehicle) return;

    let documents: Array<{ type: string; expiryDate: Date | null }> = [];
    try {
      documents = await (dbInstances as any).vehicleDocument.findMany({
        where: {
          vehicleId,
        },
        select: {
          type: true,
          expiryDate: true,
        },
      });
    } catch (err) {
      logger.warn({ err, vehicleId }, "VehicleDocument table unavailable; skipping compliance document check");
    }

    let complianceScore = 100;
    let maintenanceScore = 100;
    const explanations: string[] = [];
    const recommendations: string[] = [];
    const penalties = {
      insuranceExpired: 50,
      insuranceMissing: 25,
      pucExpired: 20,
      pucMissing: 10,
    };

    // 1. Compliance Audit (20% Weight)
    // Priority:
    // 1) Garage vehicle details (insuranceUpto/pollutionUpto)
    // 2) Uploaded documents (INSURANCE/PUC)
    // 3) If still unavailable, continue health prediction without forcing compliance penalty
    const now = new Date();
    const hasGarageInsuranceExpiry = hasExplicitExpiryValue(vehicle.insuranceUpto);
    const hasGaragePucExpiry = hasExplicitExpiryValue(vehicle.pollutionUpto);

    const insuranceExpiry = hasGarageInsuranceExpiry
      ? parseExpiryDate(vehicle.insuranceUpto)
      : latestExpiryByType(documents, "INSURANCE");
    const pucExpiry = hasGaragePucExpiry
      ? parseExpiryDate(vehicle.pollutionUpto)
      : latestExpiryByType(documents, "PUC");

    if (insuranceExpiry && insuranceExpiry <= now) {
      complianceScore -= penalties.insuranceExpired;
      explanations.push("Critical: Insurance is expired.");
      recommendations.push("Renew insurance immediately to avoid fines.");
    } else if (!insuranceExpiry) {
      complianceScore -= penalties.insuranceMissing;
      if (hasGarageInsuranceExpiry) {
        explanations.push(
          "Compliance: Insurance expiry exists in garage details but date format is invalid.",
        );
      } else {
        explanations.push(
          "Compliance: Insurance expiry not found in garage details or uploaded documents.",
        );
      }
      recommendations.push("Add/update insurance expiry in Garage details or upload insurance document.");
    }

    if (pucExpiry && pucExpiry <= now) {
      complianceScore -= penalties.pucExpired;
      explanations.push("Warning: PUC is expired.");
      recommendations.push("Get a pollution check done.");
    } else if (!pucExpiry) {
      complianceScore -= penalties.pucMissing;
      if (hasGaragePucExpiry) {
        explanations.push(
          "Compliance: PUC expiry exists in garage details but date format is invalid.",
        );
      } else {
        explanations.push(
          "Compliance: PUC expiry not found in garage details or uploaded documents.",
        );
      }
      recommendations.push("Add/update PUC expiry in Garage details or upload PUC document.");
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

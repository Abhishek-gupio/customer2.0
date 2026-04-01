import { dbInstances, ServicePartType } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances;

/**
 * WARRANTY & PARTS TRACKER SERVICE
 * ==================================
 * - Track vehicle service records (when, where, what was done)
 * - Track individual parts replaced (Battery, Tyres, Oil, etc.)
 * - Calculate warranty expiry dates
 * - Smart alerts for upcoming part replacements based on time/km
 * - Predict when parts need replacement based on driving patterns
 */

import { fetchAndSaveIntervalsForVehicle } from "./oem-scraper.service";

export interface CreateServiceRecordInput {
  vehicleId: string;
  expenseId?: string;
  serviceType: string; // REGULAR_SERVICE, REPAIR, ACCIDENT, MODIFICATION
  garageName?: string;
  odometerAtService?: number;
  serviceDate?: string; // ISO
  nextServiceKm?: number;
  notes?: string;
  parts: CreateServicePartInput[];
}

export interface CreateServicePartInput {
  partType: string; // ENGINE_OIL, BATTERY, etc.
  partName?: string; // Custom name
  brand?: string;
  cost?: number;
  warrantyMonths?: number;
  warrantyKm?: number;
}

export interface FailedServicePart {
  partType: string;
  reason: string;
}

function normalizeServiceParts(parts: CreateServicePartInput[]): CreateServicePartInput[] {
  const normalized: CreateServicePartInput[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const baseType = String(part.partType || "").trim().toUpperCase();
    const expandedTypes =
      baseType === "TYRES"
        ? ["TYRES_FRONT", "TYRES_REAR"]
        : [baseType || "OTHER_PART"];

    for (const partType of expandedTypes) {
      const key = [
        partType,
        part.partName ?? "",
        part.brand ?? "",
        part.cost ?? "",
        part.warrantyMonths ?? "",
        part.warrantyKm ?? "",
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({
        ...part,
        partType,
      });
    }
  }

  return normalized;
}

/** Lifecycle for one part type (months, km, warranty). */
export type PartLifecycle = {
  months: number;
  km: number;
  defaultWarrantyMonths: number;
  source?: string;
};

/**
 * Get replacement interval for a part on a specific vehicle.
 * Uses PartReplacementInterval (vehicle-specific) then DEFAULT rows, then in-memory fallback.
 */
async function getLifecycleForVehiclePart(
  vehicleId: string,
  partType: string,
): Promise<PartLifecycle> {
  const vehicle = await db.customerVehicle.findUnique({
    where: { id: vehicleId },
    select: { make: true, model: true, manufacturingMonthYear: true, registrationDate: true },
  });

  const make = (vehicle?.make ?? "").trim() || null;
  const model = (vehicle?.model ?? "").trim() || null;
  
  // Use explicit year first; fallback to registration year.
  let year: number | null = null;
  if (vehicle?.manufacturingMonthYear) {
    const parts = vehicle.manufacturingMonthYear.split("/");
    if (parts.length === 2) {
      year = parseInt(parts[1], 10);
    } else if (parts.length === 1) {
      year = parseInt(parts[0], 10);
    }
  }
  if (!year && vehicle?.registrationDate) {
    year = new Date(vehicle.registrationDate).getFullYear();
    if (!Number.isFinite(year)) year = null;
  }

  try {
    const partTypeForDb =
      partType === "TYRES" ? "TYRES_FRONT" : (partType as ServicePartType);
    let rows = await db.partReplacementInterval.findMany({
      where: { partType: partTypeForDb },
    });

    const matches = rows.filter((r: any) => {
      // Seeded DEFAULT row uses model='', yearMin=0, yearMax=9999 for unique constraint
      const isDefault =
        r.make === "DEFAULT" &&
        (r.model == null || r.model === "") &&
        (r.yearMin == null || r.yearMin === 0) &&
        (r.yearMax == null || r.yearMax === 9999);
      if (isDefault) return true;
      if (!make) return false;
      if (r.make.toLowerCase() !== make.toLowerCase()) return false;
      if (r.model != null && (model == null || r.model.toLowerCase() !== model.toLowerCase()))
        return false;
      if (r.yearMin != null && (year == null || year < r.yearMin)) return false;
      if (r.yearMax != null && (year == null || year > r.yearMax)) return false;
      return true;
    });

    if (matches.length === 0) {
      // Check if we already have ANY intervals for this make/model (excluding DEFAULT)
      // to avoid calling AI repeatedly for part types that AI doesn't know about.
      const existingForVehicle = make ? await db.partReplacementInterval.findFirst({
        where: {
          make: { equals: make, mode: "insensitive" },
          model: model ? { equals: model, mode: "insensitive" } : undefined,
        },
      }) : null;

      if (existingForVehicle) {
        logger.debug({ vehicleId, make, model, partType }, "Some intervals already exist for vehicle, skipping redundant fetch for missing part type");
      } else {
        // Trigger OEM/AI fetch on-the-fly if no matching intervals found at all for this vehicle
        logger.info({ vehicleId, make, model, partType }, "No DB intervals found for this vehicle, triggering OEM/AI fetch");
        const fetchResult = await fetchAndSaveIntervalsForVehicle(vehicleId);
        
        if (fetchResult.saved > 0) {
          // Retry fetch after save
          rows = await db.partReplacementInterval.findMany({
            where: { partType: partTypeForDb },
          });
          // Filter again with new rows
          const newMatches = rows.filter((r: any) => {
            if (r.make === "DEFAULT") return true;
            if (!make) return r.make === "Generic";
            if (r.make.toLowerCase() !== make.toLowerCase()) return false;
            return true;
          });
          if (newMatches.length > 0) {
            matches.push(...newMatches);
          }
        }
      }
    }

    if (matches.length === 0) {
      return { 
        months: 12, 
        km: 10000, 
        defaultWarrantyMonths: 0, 
        source: "FALLBACK" 
      };
    }

    // Prefer OEM_WEBSITE (scraped from original OEM) over DEFAULT or other sources; then by specificity
    const score = (r: any) => {
      const fromOem = (r.source || "").toUpperCase() === "OEM_WEBSITE" ? 100 : 0;
      if (r.make === "DEFAULT") return fromOem;
      let s = 1;
      if (r.model) s += 2;
      if (r.yearMin != null || r.yearMax != null) s += 4;
      return fromOem + s;
    };
    matches.sort((a: any, b: any) => score(b) - score(a));

    const best = matches[0];
    return {
      months: best.intervalMonths,
      km: best.intervalKm,
      defaultWarrantyMonths: best.defaultWarrantyMonths,
      source: best.source ?? (best.make === "DEFAULT" ? "DEFAULT" : "OEM"),
    };
  } catch (e) {
    logger.warn({ err: e, vehicleId, partType }, "PartReplacementInterval lookup failed");
    return { 
      months: 12, 
      km: 10000, 
      defaultWarrantyMonths: 0, 
      source: "FALLBACK" 
    };
  }
}

function pickLatestSavedPart(existing: any, candidate: any) {
  if (!existing) return candidate;

  const existingCreatedAt = new Date(existing.createdAt || 0).getTime();
  const candidateCreatedAt = new Date(candidate.createdAt || 0).getTime();
  if (candidateCreatedAt !== existingCreatedAt) {
    return candidateCreatedAt > existingCreatedAt ? candidate : existing;
  }

  const existingReplacedAt = new Date(existing.lastReplacedAt || 0).getTime();
  const candidateReplacedAt = new Date(candidate.lastReplacedAt || 0).getTime();
  return candidateReplacedAt > existingReplacedAt ? candidate : existing;
}

export const warrantyService = {
  /**
   * Create a full service record with parts
   */
  async createServiceRecord(input: CreateServiceRecordInput) {
    const serviceDate = input.serviceDate
      ? new Date(input.serviceDate)
      : new Date();
    const normalizedParts = normalizeServiceParts(input.parts);

    if (normalizedParts.length === 0) {
      throw new Error("No valid parts provided for service record");
    }

    // 1. Create the Service Record
    const record = await db.serviceRecord.create({
      data: {
        vehicleId: input.vehicleId,
        expenseId: input.expenseId || null,
        serviceType: input.serviceType,
        garageName: input.garageName,
        odometerAtService: input.odometerAtService,
        serviceDate,
        nextServiceKm: input.nextServiceKm,
        notes: input.notes,
      },
    });

    // 2. Add Parts (use vehicle-specific interval when available)
    const partsCreated = [];
    const failedParts: FailedServicePart[] = [];
    for (const part of normalizedParts) {
      try {
        const lifecycle = await getLifecycleForVehiclePart(
          input.vehicleId,
          part.partType,
        );
        const warrantyMonths =
          part.warrantyMonths ?? lifecycle.defaultWarrantyMonths;

        let warrantyExpiresAt: Date | null = null;
        if (warrantyMonths > 0) {
          warrantyExpiresAt = new Date(serviceDate);
          warrantyExpiresAt.setMonth(
            warrantyExpiresAt.getMonth() + warrantyMonths,
          );
        }

        const nextReplacementDue = new Date(serviceDate);
        nextReplacementDue.setMonth(
          nextReplacementDue.getMonth() + lifecycle.months,
        );

        const createdPart = await db.servicePart.create({
          data: {
            serviceRecordId: record.id,
            partType: part.partType as ServicePartType,
            partName: part.partName || null,
            brand: part.brand || null,
            cost: part.cost || null,
            warrantyMonths,
            warrantyKm: part.warrantyKm ?? lifecycle.km,
            warrantyExpiresAt,
            lastReplacedAt: serviceDate,
            nextReplacementDue,
          },
        });
        partsCreated.push(createdPart);
      } catch (err) {
        failedParts.push({
          partType: part.partType,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
        logger.warn(
          { err, vehicleId: input.vehicleId, partType: part.partType, expenseId: input.expenseId },
          "Skipping invalid service part while creating service record",
        );
      }
    }

    if (partsCreated.length === 0) {
      await db.serviceRecord.delete({
        where: { id: record.id },
      }).catch((err: unknown) => {
        logger.warn(
          { err, serviceRecordId: record.id, vehicleId: input.vehicleId },
          "Failed to clean up empty service record after part creation failure",
        );
      });
      throw new Error("Failed to create any service parts for this record");
    }

    return {
      ...record,
      parts: partsCreated,
      failedParts,
    };
  },

  /**
   * Get all service records for a vehicle
   */
  async getServiceHistory(vehicleId: string) {
    return db.serviceRecord.findMany({
      where: { vehicleId },
      include: { parts: true },
      orderBy: { serviceDate: "desc" },
    });
  },

  /**
   * Get warranty status for all parts of a vehicle
   */
  async getWarrantyStatus(vehicleId: string): Promise<{
    active: any[];
    expiring: any[];
    expired: any[];
  }> {
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    // Get all parts across all service records
    const allParts = await db.servicePart.findMany({
      where: {
        serviceRecord: { vehicleId },
      },
      include: {
        serviceRecord: {
          select: { vehicleId: true, serviceDate: true, garageName: true },
        },
      },
      orderBy: [{ lastReplacedAt: "desc" }, { createdAt: "desc" }],
    });

    // Deduplicate — only keep latest entry per partType
    const latestParts = new Map<string, any>();
    for (const part of allParts) {
      latestParts.set(
        part.partType,
        pickLatestSavedPart(latestParts.get(part.partType), part),
      );
    }

    const active: any[] = [];
    const expiring: any[] = [];
    const expired: any[] = [];

    for (const part of latestParts.values()) {
      if (!part.warrantyExpiresAt) {
        // No warranty
        continue;
      }

      const expiresAt = new Date(part.warrantyExpiresAt);

      if (expiresAt < now) {
        expired.push({
          ...part,
          status: "EXPIRED",
          message: `${part.partType} warranty expired on ${expiresAt.toLocaleDateString("en-IN")}`,
        });
      } else if (expiresAt <= thirtyDaysLater) {
        expiring.push({
          ...part,
          status: "EXPIRING_SOON",
          daysLeft: Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
          message: `${part.partType} warranty expires in ${Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days`,
        });
      } else {
        active.push({
          ...part,
          status: "ACTIVE",
          daysLeft: Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
          message: `${part.partType} warranty valid until ${expiresAt.toLocaleDateString("en-IN")}`,
        });
      }
    }

    return { active, expiring, expired };
  },

  /**
   * Get parts that are DUE for replacement (based on time + km)
   */
  async getUpcomingReplacements(vehicleId: string): Promise<any[]> {
    const now = new Date();
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);

    // Get current odometer
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      select: { currentOdometer: true, make: true, model: true, registrationDate: true },
    });

    const currentOdo = vehicle?.currentOdometer || 0;

    // Get latest parts
    const allParts = await db.servicePart.findMany({
      where: {
        serviceRecord: { vehicleId },
      },
      include: {
        serviceRecord: {
          select: {
            odometerAtService: true,
            serviceDate: true,
            garageName: true,
            serviceType: true,
            notes: true
          },
        },
      },
      orderBy: [{ lastReplacedAt: "desc" }, { createdAt: "desc" }],
    });

    // Deduplicate
    const latestParts = new Map<string, any>();
    for (const part of allParts) {
      latestParts.set(
        part.partType,
        pickLatestSavedPart(latestParts.get(part.partType), part),
      );
    }

    const latestTyresAggregate = [latestParts.get("TYRES_FRONT"), latestParts.get("TYRES_REAR")]
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const createdDiff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (createdDiff !== 0) return createdDiff;
        return new Date(b.lastReplacedAt).getTime() - new Date(a.lastReplacedAt).getTime();
      })[0];

    const due: any[] = [];
    const trackedPartTypes = [
      "ENGINE_OIL", "OIL_FILTER", "AIR_FILTER", "BRAKE_PADS", "BRAKE_DISCS", 
      "BATTERY", "TYRES", "CLUTCH_PLATE", "SPARK_PLUGS", "COOLANT", 
      "TIMING_BELT", "AC_FILTER", "WIPER_BLADES", "HEADLIGHT_BULB"
    ];

    for (const partType of trackedPartTypes) {
      let part =
        partType === "TYRES"
          ? latestTyresAggregate ?? latestParts.get(partType)
          : latestParts.get(partType);
      const lifecycle = await getLifecycleForVehiclePart(vehicleId, partType);

      let replacedAt: Date;
      let odoAtService: number;

      if (part) {
        replacedAt = new Date(part.lastReplacedAt);
        odoAtService = part.serviceRecord?.odometerAtService || 0;
      } else {
        // No service record found, assume original part from registration date
        replacedAt = vehicle?.registrationDate ? new Date(vehicle.registrationDate) : new Date();
        odoAtService = 0;
        // Mock a part object for the loop
        part = { partType, brand: "Original", lastReplacedAt: replacedAt };
      }

      // Check time-based due
      const timeDue = new Date(replacedAt);
      timeDue.setMonth(timeDue.getMonth() + lifecycle.months);
      const isTimeDue = timeDue <= sixtyDaysLater;

      // Check km-based due
      const kmSinceReplacement = currentOdo - odoAtService;
      const isKmDue = kmSinceReplacement >= lifecycle.km * 0.8; // 80% of lifecycle

      // If it's not due, we still push it but with 'ACTIVE' status for the UI to show data
      const overdueByKm = kmSinceReplacement >= lifecycle.km ? kmSinceReplacement - lifecycle.km : 0;
      const isOverdueByKm = overdueByKm > 0;

      if (isTimeDue || isKmDue) {
        const daysOverdue = Math.ceil(
          (now.getTime() - timeDue.getTime()) / (1000 * 60 * 60 * 24),
        );
        // Prefer OVERDUE for time; else if overdue by km use OVERDUE; else DUE_BY_KM / DUE_SOON
        const urgency =
          daysOverdue > 0
            ? "OVERDUE"
            : isOverdueByKm
              ? "OVERDUE"
              : isKmDue
                ? "DUE_BY_KM"
                : "DUE_SOON";

        let message: string;
        if (urgency === "OVERDUE") {
          if (daysOverdue > 0) {
            message = `⚠️ ${partType} is ${Math.abs(daysOverdue)} days overdue for replacement!`;
          } else {
            message = `⚠️ ${partType} interval is ${lifecycle.km.toLocaleString()} km. ${kmSinceReplacement.toLocaleString()} km since last change (${overdueByKm.toLocaleString()} km overdue).`;
          }
        } else {
          message = `🔔 Due at ${lifecycle.km.toLocaleString()} km. ${kmSinceReplacement.toLocaleString()} km since last change.`;
        }

        due.push({
          partType: part.partType || partType,
          partName: part.partName,
          brand: part.brand,
          lastReplacedAt: replacedAt,
          lastReplacedOdo: odoAtService,
          kmSinceReplacement,
          lifecycleKm: lifecycle.km,
          lifecycleMonths: lifecycle.months,
          recommendedReplacementDate: timeDue,
          urgency,
          garageName: part.serviceRecord?.garageName,
          serviceType: part.serviceRecord?.serviceType,
          warrantyMonths: part.warrantyMonths || lifecycle.defaultWarrantyMonths,
          message,
          overdueByKm: isOverdueByKm ? overdueByKm : undefined,
          intervalSource: lifecycle.source || "FALLBACK",
        });
      } else {
        // Active/Good status
        due.push({
          partType: part.partType || partType,
          partName: part.partName,
          brand: part.brand,
          lastReplacedAt: replacedAt,
          lastReplacedOdo: odoAtService,
          kmSinceReplacement,
          lifecycleKm: lifecycle.km,
          lifecycleMonths: lifecycle.months,
          recommendedReplacementDate: timeDue,
          urgency: "ACTIVE",
          garageName: part.serviceRecord?.garageName,
          serviceType: part.serviceRecord?.serviceType,
          warrantyMonths: part.warrantyMonths || lifecycle.defaultWarrantyMonths,
          message: `✅ ${partType} is in good condition.`,
          intervalSource: lifecycle.source || "FALLBACK",
        });
      }
    }

    // Sort: OVERDUE first
    due.sort((a, b) => {
      const order: Record<string, number> = {
        OVERDUE: 0,
        DUE_BY_KM: 1,
        DUE_SOON: 2,
      };
      return (order[a.urgency] || 3) - (order[b.urgency] || 3);
    });

    // Calculate Average Daily Running (ADR) to predict future dates
    const adr = await this.calculateAverageDailyRunning(vehicleId);

    const dueWithPredictions = due.map((d) => {
      // If we have ADR and it's a KM-based due, predict the date
      if (adr > 0 && d.kmSinceReplacement < d.lifecycleKm) {
        const kmRemaining = d.lifecycleKm - d.kmSinceReplacement;
        const daysRemaining = Math.ceil(kmRemaining / adr);
        const predictedDate = new Date();
        predictedDate.setDate(predictedDate.getDate() + daysRemaining);

        // If predicted date is sooner than the time-based recommendation, suggest it
        if (predictedDate < d.recommendedReplacementDate) {
          d.predictedReplacementDate = predictedDate;
          d.predictionReason = `Based on your daily usage of ~${Math.round(adr)} km/day`;
          // Update message if prediction is sooner
          if (d.urgency !== "OVERDUE") {
            d.message += ` Projected due date: ${predictedDate.toLocaleDateString("en-IN")} (${d.predictionReason}).`;
          }
        }
      } else if (adr > 0 && d.kmSinceReplacement >= d.lifecycleKm) {
        // Already overdue by KM
        d.predictionReason = `Overdue by KM (Usage: ~${Math.round(adr)} km/day)`;
      }
      return d;
    });

    // Final Deduplication: Only one entry per partType (keep the most urgent)
    const finalMap = new Map<string, any>();
    for (const d of dueWithPredictions) {
      const existing = finalMap.get(d.partType);
      if (!existing) {
        finalMap.set(d.partType, d);
        continue;
      }
      // If candidate is OVERDUE but existing is not, prefer candidate
      if (d.urgency === "OVERDUE" && existing.urgency !== "OVERDUE") {
        finalMap.set(d.partType, d);
      }
    }

    return Array.from(finalMap.values()).sort((a, b) => {
      const order: Record<string, number> = {
        OVERDUE: 0,
        DUE_BY_KM: 1,
        DUE_SOON: 2,
      };
      return (order[a.urgency] || 3) - (order[b.urgency] || 3);
    });
  },

  /**
   * Calculate Average Daily Running (ADR) in km/day
   * based on odometer logs from the last 90 days.
   */
  async calculateAverageDailyRunning(vehicleId: string): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const logs = await dbInstances.odometerLog.findMany({
      where: {
        vehicleId,
        date: { gte: ninetyDaysAgo },
      },
      orderBy: { date: "asc" },
    });

    if (logs.length < 2) return 0; // Not enough data

    const first = logs[0];
    const last = logs[logs.length - 1];

    const daysDiff =
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
      (1000 * 60 * 60 * 24);
    const kmDiff = last.reading - first.reading;

    if (daysDiff < 1 || kmDiff < 0) return 0;

    return kmDiff / daysDiff;
  },

  /**
   * Check warranty and replacement alerts for a vehicle
   * Used by notification cron job
   */
  async checkAlerts(vehicleId: string, customerId: string): Promise<string[]> {
    const alerts: string[] = [];

    // 1. Warranty expiring
    const { expiring } = await this.getWarrantyStatus(vehicleId);
    for (const part of expiring) {
      alerts.push(part.message);
      // Create in-app notification
      await db.inAppNotification.create({
        data: {
          customerId,
          title: "Warranty Expiring Soon",
          body: part.message,
          type: "WARNING",
          link: `/vehicles/${vehicleId}/warranty`,
          metadata: { partType: part.partType, daysLeft: part.daysLeft },
        },
      });
    }

    // 2. Parts due for replacement
    const replacements = await this.getUpcomingReplacements(vehicleId);
    for (const part of replacements.filter((p) => p.urgency === "OVERDUE")) {
      alerts.push(part.message);
      await db.inAppNotification.create({
        data: {
          customerId,
          title: "Part Replacement Overdue",
          body: part.message,
          type: "ERROR",
          link: `/vehicles/${vehicleId}/service`,
          metadata: { partType: part.partType, urgency: part.urgency },
        },
      });
    }

    return alerts;
  },

  /**
   * Get lifespan summary for all common parts (default/fallback values).
   * For vehicle-specific intervals use getLifecycleForVehiclePart(vehicleId, partType).
   */
  getPartLifecycleInfo() {
    return [
      "ENGINE_OIL", "OIL_FILTER", "AIR_FILTER", "BRAKE_PADS", "BRAKE_DISCS", 
      "BATTERY", "TYRES", "CLUTCH_PLATE", "SPARK_PLUGS", "COOLANT", 
      "TIMING_BELT", "AC_FILTER", "WIPER_BLADES", "HEADLIGHT_BULB"
    ].map((partType) => ({
      partType,
      recommendedIntervalMonths: 12,
      recommendedIntervalKm: 10000,
      defaultWarrantyMonths: 0,
    }));
  },

  /**
   * Get replacement interval for a part on a vehicle (vehicle-specific or default).
   */
  getLifecycleForVehiclePart,

  /**
   * Get list of service providers (garages) used by the customer
   */
  async getServiceProviders(customerId: string): Promise<string[]> {
    const serviceExpenseCategories = ["SERVICE", "REPAIR"] as const;

    // 1. From Service Records
    const records = await db.serviceRecord.findMany({
      where: { vehicle: { customerId: customerId }, garageName: { not: null } },
      distinct: ["garageName"],
      select: { garageName: true },
    });

    // 2. From Expenses (Category = SERVICE/REPAIR)
    const expenses = await db.expense.findMany({
      where: {
        customerId,
        category: { in: [...serviceExpenseCategories] as any },
        merchantName: { not: null },
      },
      distinct: ["merchantName"],
      select: { merchantName: true },
    });

    const names = new Set<string>();
    records.forEach((r: any) => {
      if (r.garageName) names.add(r.garageName);
    });
    expenses.forEach((e: any) => {
      if (e.merchantName) names.add(e.merchantName);
    });

    return Array.from(names).sort();
  },

  /**
   * Automatically initializes all tracked parts to 100% health at the current odometer reading.
   * Useful when adding a new vehicle to establish a baseline.
   */
  async initializeMaintenance(vehicleId: string, odometer: number) {
    const trackedPartTypes = [
      "ENGINE_OIL", "OIL_FILTER", "AIR_FILTER", "BRAKE_PADS", "BRAKE_DISCS", 
      "BATTERY", "TYRES", "CLUTCH_PLATE", "SPARK_PLUGS", "COOLANT", 
      "TIMING_BELT", "AC_FILTER", "WIPER_BLADES", "HEADLIGHT_BULB"
    ];

    logger.info({ vehicleId, odometer }, "Initializing maintenance state for new vehicle");
    
    try {
      return await this.createServiceRecord({
        vehicleId,
        serviceType: "INITIAL_CHECKUP",
        garageName: "System Initialization",
        odometerAtService: odometer,
        serviceDate: new Date().toISOString(),
        notes: "Auto-initialized: All parts assumed healthy at time of addition.",
        parts: trackedPartTypes.map(pt => ({ 
          partType: pt, 
          brand: "Original/Genuine",
          warrantyMonths: 0,
          warrantyKm: 0
        }))
      });
    } catch (err) {
      logger.warn({ err, vehicleId }, "Maintenance initialization failed (non-critical)");
      return null;
    }
  }
};

import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances as any;

/**
 * WARRANTY & PARTS TRACKER SERVICE
 * ==================================
 * - Track vehicle service records (when, where, what was done)
 * - Track individual parts replaced (Battery, Tyres, Oil, etc.)
 * - Calculate warranty expiry dates
 * - Smart alerts for upcoming part replacements based on time/km
 * - Predict when parts need replacement based on driving patterns
 */

// Default replacement intervals for common parts
const PART_LIFECYCLE: Record<string, { months: number; km: number; defaultWarrantyMonths: number }> = {
    ENGINE_OIL: { months: 6, km: 10000, defaultWarrantyMonths: 0 },
    OIL_FILTER: { months: 6, km: 10000, defaultWarrantyMonths: 0 },
    AIR_FILTER: { months: 12, km: 15000, defaultWarrantyMonths: 0 },
    BRAKE_PADS: { months: 24, km: 30000, defaultWarrantyMonths: 6 },
    BRAKE_DISCS: { months: 36, km: 60000, defaultWarrantyMonths: 12 },
    BATTERY: { months: 36, km: 80000, defaultWarrantyMonths: 24 },
    TYRES_FRONT: { months: 36, km: 40000, defaultWarrantyMonths: 12 },
    TYRES_REAR: { months: 36, km: 40000, defaultWarrantyMonths: 12 },
    CLUTCH_PLATE: { months: 48, km: 60000, defaultWarrantyMonths: 6 },
    SPARK_PLUGS: { months: 24, km: 30000, defaultWarrantyMonths: 0 },
    COOLANT: { months: 24, km: 40000, defaultWarrantyMonths: 0 },
    TIMING_BELT: { months: 48, km: 60000, defaultWarrantyMonths: 6 },
    AC_FILTER: { months: 12, km: 15000, defaultWarrantyMonths: 0 },
    WIPER_BLADES: { months: 12, km: 20000, defaultWarrantyMonths: 3 },
    HEADLIGHT_BULB: { months: 24, km: 50000, defaultWarrantyMonths: 6 },
    OTHER_PART: { months: 12, km: 20000, defaultWarrantyMonths: 0 },
};

export interface CreateServiceRecordInput {
    vehicleId: string;
    expenseId?: string;
    serviceType: string;  // REGULAR_SERVICE, REPAIR, ACCIDENT, MODIFICATION
    garageName?: string;
    odometerAtService?: number;
    serviceDate?: string; // ISO
    nextServiceKm?: number;
    notes?: string;
    parts: CreateServicePartInput[];
}

export interface CreateServicePartInput {
    partType: string;     // ENGINE_OIL, BATTERY, etc.
    partName?: string;    // Custom name
    brand?: string;
    cost?: number;
    warrantyMonths?: number;
    warrantyKm?: number;
}

export const warrantyService = {
    /**
     * Create a full service record with parts
     */
    async createServiceRecord(input: CreateServiceRecordInput) {
        const serviceDate = input.serviceDate ? new Date(input.serviceDate) : new Date();

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
            }
        });

        // 2. Add Parts
        const partsCreated = [];
        for (const part of input.parts) {
            const lifecycle = PART_LIFECYCLE[part.partType] || PART_LIFECYCLE.OTHER_PART;
            const warrantyMonths = part.warrantyMonths || lifecycle.defaultWarrantyMonths;

            // Calculate warranty expiry
            let warrantyExpiresAt: Date | null = null;
            if (warrantyMonths > 0) {
                warrantyExpiresAt = new Date(serviceDate);
                warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + warrantyMonths);
            }

            // Calculate next replacement due (based on lifecycle)
            const nextReplacementDue = new Date(serviceDate);
            nextReplacementDue.setMonth(nextReplacementDue.getMonth() + lifecycle.months);

            const createdPart = await db.servicePart.create({
                data: {
                    serviceRecordId: record.id,
                    partType: part.partType,
                    partName: part.partName || null,
                    brand: part.brand || null,
                    cost: part.cost || null,
                    warrantyMonths,
                    warrantyKm: part.warrantyKm || lifecycle.km,
                    warrantyExpiresAt,
                    lastReplacedAt: serviceDate,
                    nextReplacementDue,
                }
            });
            partsCreated.push(createdPart);
        }

        return {
            ...record,
            parts: partsCreated,
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
                serviceRecord: { vehicleId }
            },
            include: {
                serviceRecord: {
                    select: { vehicleId: true, serviceDate: true, garageName: true }
                }
            },
            orderBy: { lastReplacedAt: "desc" },
        });

        // Deduplicate — only keep latest entry per partType
        const latestParts = new Map<string, any>();
        for (const part of allParts) {
            if (!latestParts.has(part.partType)) {
                latestParts.set(part.partType, part);
            }
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
                    daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                    message: `${part.partType} warranty expires in ${Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days`,
                });
            } else {
                active.push({
                    ...part,
                    status: "ACTIVE",
                    daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
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
            select: { currentOdometer: true, make: true, model: true }
        });

        const currentOdo = vehicle?.currentOdometer || 0;

        // Get latest parts
        const allParts = await db.servicePart.findMany({
            where: {
                serviceRecord: { vehicleId }
            },
            include: {
                serviceRecord: {
                    select: { odometerAtService: true, serviceDate: true }
                }
            },
            orderBy: { lastReplacedAt: "desc" },
        });

        // Deduplicate
        const latestParts = new Map<string, any>();
        for (const part of allParts) {
            if (!latestParts.has(part.partType)) {
                latestParts.set(part.partType, part);
            }
        }

        const due: any[] = [];

        for (const part of latestParts.values()) {
            const lifecycle = PART_LIFECYCLE[part.partType] || PART_LIFECYCLE.OTHER_PART;
            const replacedAt = new Date(part.lastReplacedAt);
            const odoAtService = part.serviceRecord?.odometerAtService || 0;

            // Check time-based due
            const timeDue = new Date(replacedAt);
            timeDue.setMonth(timeDue.getMonth() + lifecycle.months);
            const isTimeDue = timeDue <= sixtyDaysLater;

            // Check km-based due
            const kmSinceReplacement = currentOdo - odoAtService;
            const isKmDue = kmSinceReplacement >= (lifecycle.km * 0.8); // 80% of lifecycle

            if (isTimeDue || isKmDue) {
                const daysOverdue = Math.ceil((now.getTime() - timeDue.getTime()) / (1000 * 60 * 60 * 24));
                const urgency = daysOverdue > 0 ? "OVERDUE" : (isKmDue ? "DUE_BY_KM" : "DUE_SOON");

                due.push({
                    partType: part.partType,
                    brand: part.brand,
                    lastReplacedAt: part.lastReplacedAt,
                    lastReplacedOdo: odoAtService,
                    kmSinceReplacement,
                    lifecycleKm: lifecycle.km,
                    recommendedReplacementDate: timeDue,
                    urgency,
                    message: urgency === "OVERDUE"
                        ? `⚠️ ${part.partType} is ${Math.abs(daysOverdue)} days overdue for replacement! (Last changed: ${replacedAt.toLocaleDateString("en-IN")})`
                        : `🔔 ${part.partType} replacement recommended soon. ${kmSinceReplacement} km since last change (lifecycle: ${lifecycle.km} km).`,
                });
            }
        }

        // Sort: OVERDUE first
        due.sort((a, b) => {
            const order: Record<string, number> = { OVERDUE: 0, DUE_BY_KM: 1, DUE_SOON: 2 };
            return (order[a.urgency] || 3) - (order[b.urgency] || 3);
        });

        return due;
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
                }
            });
        }

        // 2. Parts due for replacement
        const replacements = await this.getUpcomingReplacements(vehicleId);
        for (const part of replacements.filter(p => p.urgency === "OVERDUE")) {
            alerts.push(part.message);
            await db.inAppNotification.create({
                data: {
                    customerId,
                    title: "Part Replacement Overdue",
                    body: part.message,
                    type: "ERROR",
                    link: `/vehicles/${vehicleId}/service`,
                    metadata: { partType: part.partType, urgency: part.urgency },
                }
            });
        }

        return alerts;
    },

    /**
     * Get lifespan summary for all common parts
     */
    getPartLifecycleInfo() {
        return Object.entries(PART_LIFECYCLE).map(([partType, lifecycle]) => ({
            partType,
            recommendedIntervalMonths: lifecycle.months,
            recommendedIntervalKm: lifecycle.km,
            defaultWarrantyMonths: lifecycle.defaultWarrantyMonths,
        }));
    },
};
